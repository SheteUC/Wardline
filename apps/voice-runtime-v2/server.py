"""
FastAPI control plane for Voice Runtime V2.

This service is the new internal multi-agent runtime. The local text/session
endpoints remain the proof surface, and the Twilio bootstrap + media endpoints
provide the real provider-backed cutover path for V2.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Response, WebSocket
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel, Field
from twilio.request_validator import RequestValidator

from config import settings
from observability.logging_setup import configure_logging, get_logger
from observability.middleware import ObservabilityMiddleware
from preflight import default_bootstrap_error_message
from service import VoiceRuntimeV2
from telephony import TwilioMediaSession

configure_logging()

runtime = VoiceRuntimeV2()
logger = get_logger(__name__)


def _rethrow_session_errors(error: BaseException) -> None:
    if isinstance(error, KeyError):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, RuntimeError) and "shutting down" in str(error).lower():
        raise HTTPException(status_code=503, detail=str(error)) from error
    raise error


def _twilio_request_url(request: Request) -> str:
    base = settings.twilio_webhook_public_url.strip().rstrip("/")
    if base:
        path = request.url.path
        query = request.url.query
        return f"{base}{path}" + (f"?{query}" if query else "")
    return str(request.url)


def _twilio_form_params(form_data) -> dict[str, str]:
    return {str(k): str(v) for k, v in form_data.items()}


def _twilio_signature_ok(request: Request, params: dict[str, str]) -> bool:
    if settings.twilio_skip_signature_validation:
        return True
    auth = settings.twilio_auth_token.strip()
    if not auth:
        logger.error("Twilio auth token is not configured; rejecting webhook")
        return False
    sig = (
        request.headers.get("X-Twilio-Signature") or request.headers.get("x-twilio-signature") or ""
    ).strip()
    if not sig:
        return False
    url = _twilio_request_url(request)
    return RequestValidator(auth).validate(url, params, sig)


class StartSessionRequest(BaseModel):
    callSid: str
    callerPhone: str
    calledPhone: str


class TextTurnRequest(BaseModel):
    text: str


class VoicemailRequest(BaseModel):
    recordingUrl: str
    transcription: Optional[str] = None


class TranscriptTurnRequest(BaseModel):
    text: str
    final: bool = True
    providerSessionId: Optional[str] = None


class SessionEventRequest(BaseModel):
    type: str
    payload: dict = Field(default_factory=dict)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    runtime.begin_shutdown()
    await runtime.wait_for_inflight()
    await runtime.close()


app = FastAPI(
    title="Wardline Voice Runtime V2",
    description="Internal multi-agent voice runtime for Wardline",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(ObservabilityMiddleware)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "voice-runtime-v2",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready")
async def ready():
    return {
        "ready": True,
        "providers": runtime.readiness(),
        "preflight": runtime.real_call_preflight(),
    }


@app.post("/sessions")
async def start_session(request: StartSessionRequest):
    try:
        session = await runtime.start_session(
            call_sid=request.callSid,
            caller_phone=request.callerPhone,
            called_phone=request.calledPhone,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return {
        "sessionId": session.sessionId,
        "callId": session.callId,
        "businessId": session.businessId,
        "greeting": session.messages[-1].text if session.messages else "",
        "transport": session.transport.model_dump(),
        "providers": runtime.readiness(),
    }


@app.post("/telephony/twilio/bootstrap")
async def bootstrap_twilio_session(request: Request):
    form_data = await request.form()
    params = _twilio_form_params(form_data)
    if not _twilio_signature_ok(request, params):
        logger.error("Rejected Twilio bootstrap: invalid or missing signature")
        return Response(
            content=runtime.twilio.build_error_twiml(
                "We're sorry, but we could not verify this call request. Please try again shortly."
            ),
            media_type="text/xml",
        )

    call_sid = str(form_data.get("CallSid") or "")
    caller_phone = str(form_data.get("From") or "")
    called_phone = str(form_data.get("To") or "")

    preflight = runtime.real_call_preflight()
    if not preflight["ok"]:
        logger.error(
            "Voice Runtime V2 bootstrap preflight failed",
            extra={"errors": preflight["errors"], "callbackUrl": preflight["callbackUrl"]},
        )
        return Response(
            content=runtime.twilio.build_error_twiml(default_bootstrap_error_message()),
            media_type="text/xml",
        )

    if not call_sid or not caller_phone or not called_phone:
        logger.error(
            "Voice Runtime V2 bootstrap request was missing Twilio fields",
            extra={"callSid": call_sid, "fromNumber": caller_phone, "toNumber": called_phone},
        )
        return Response(
            content=runtime.twilio.build_error_twiml(
                "We're sorry, but we could not connect your call. Please try again shortly."
            ),
            media_type="text/xml",
        )

    try:
        session = await runtime.start_session(
            call_sid=call_sid,
            caller_phone=caller_phone,
            called_phone=called_phone,
        )
        twiml = await runtime.build_twilio_bootstrap_response(session.sessionId)
    except ValueError as error:
        logger.error(
            "Voice Runtime V2 bootstrap rejected the inbound call",
            extra={
                "callSid": call_sid,
                "fromNumber": caller_phone,
                "toNumber": called_phone,
                "error": str(error),
            },
        )
        return Response(
            content=runtime.twilio.build_error_twiml(
                "We're sorry, but we could not connect your call to the virtual receptionist right now."
            ),
            media_type="text/xml",
        )
    except Exception:
        logger.exception(
            "Voice Runtime V2 bootstrap failed unexpectedly",
            extra={"callSid": call_sid, "fromNumber": caller_phone, "toNumber": called_phone},
        )
        return Response(
            content=runtime.twilio.build_error_twiml(
                "We're sorry, but we're having trouble connecting your call right now."
            ),
            media_type="text/xml",
        )

    return Response(content=twiml, media_type="text/xml")


@app.post("/telephony/twilio/transfer-action")
async def twilio_transfer_action(request: Request):
    form_data = await request.form()
    params = _twilio_form_params(form_data)
    if not _twilio_signature_ok(request, params):
        logger.error("Rejected Twilio transfer-action: invalid or missing signature")
        return Response(
            content=runtime.twilio.build_error_twiml(
                "We're sorry, but we could not verify that transfer callback."
            ),
            media_type="text/xml",
        )

    session_id = str(request.query_params.get("sessionId") or form_data.get("sessionId") or "")
    if not session_id:
        return Response(
            content=runtime.twilio.build_error_twiml(
                "We're sorry, but we could not finish that transfer request."
            ),
            media_type="text/xml",
        )

    try:
        twiml = await runtime.handle_transfer_action_callback(
            session_id,
            {key: value for key, value in form_data.items()},
        )
    except KeyError:
        twiml = runtime.twilio.build_error_twiml(
            "We're sorry, but we could not match that transfer request to the live call."
        )
    except Exception:
        logger.exception("Voice Runtime V2 transfer action failed", extra={"sessionId": session_id})
        twiml = runtime.twilio.build_error_twiml(
            "We're sorry, but we could not complete that transfer request."
        )

    return Response(content=twiml, media_type="text/xml")


@app.websocket("/telephony/twilio/media")
async def twilio_media_stream(websocket: WebSocket):
    bridge = TwilioMediaSession(websocket, runtime)
    await bridge.run()


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        return await runtime.get_session_dump(session_id)
    except (KeyError, RuntimeError) as error:
        _rethrow_session_errors(error)


@app.post("/sessions/{session_id}/turn")
async def process_turn(session_id: str, request: TextTurnRequest):
    try:
        return await runtime.process_text_turn(session_id, request.text)
    except (KeyError, RuntimeError) as error:
        _rethrow_session_errors(error)


@app.post("/sessions/{session_id}/transcript")
async def process_transcript_turn(session_id: str, request: TranscriptTurnRequest):
    try:
        return await runtime.process_transcript_turn(
            session_id,
            request.text,
            final=request.final,
            provider_session_id=request.providerSessionId,
        )
    except (KeyError, RuntimeError) as error:
        _rethrow_session_errors(error)


@app.post("/sessions/{session_id}/events")
async def record_session_event(session_id: str, request: SessionEventRequest):
    try:
        return await runtime.persist_transport_event(session_id, request.type, request.payload)
    except (KeyError, RuntimeError) as error:
        _rethrow_session_errors(error)


@app.post("/sessions/{session_id}/voicemail")
async def capture_voicemail(session_id: str, request: VoicemailRequest):
    try:
        return await runtime.capture_voicemail(
            session_id,
            recording_url=request.recordingUrl,
            transcription=request.transcription,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (KeyError, RuntimeError) as error:
        _rethrow_session_errors(error)


@app.get("/metrics")
async def prometheus_metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


from observability.otel import instrument_app

instrument_app(app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info",
    )
