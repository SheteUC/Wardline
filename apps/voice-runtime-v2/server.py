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
from pydantic import BaseModel, Field

from config import settings
from service import VoiceRuntimeV2
from telephony import TwilioMediaSession

runtime = VoiceRuntimeV2()


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
    await runtime.close()


app = FastAPI(
    title="Wardline Voice Runtime V2",
    description="Internal multi-agent voice runtime for Wardline",
    version="0.1.0",
    lifespan=lifespan,
)


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
    call_sid = str(form_data.get("CallSid") or "")
    caller_phone = str(form_data.get("From") or "")
    called_phone = str(form_data.get("To") or "")

    if not call_sid or not caller_phone or not called_phone:
        raise HTTPException(status_code=400, detail="Missing Twilio bootstrap fields")

    session = await runtime.start_session(
        call_sid=call_sid,
        caller_phone=caller_phone,
        called_phone=called_phone,
    )
    twiml = runtime.build_twilio_bootstrap_response(session.sessionId)
    return Response(content=twiml, media_type="text/xml")


@app.websocket("/telephony/twilio/media")
async def twilio_media_stream(websocket: WebSocket):
    bridge = TwilioMediaSession(websocket, runtime)
    await bridge.run()


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        session = runtime.get_session(session_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return session.model_dump()


@app.post("/sessions/{session_id}/turn")
async def process_turn(session_id: str, request: TextTurnRequest):
    try:
        return await runtime.process_text_turn(session_id, request.text)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/sessions/{session_id}/transcript")
async def process_transcript_turn(session_id: str, request: TranscriptTurnRequest):
    try:
        return await runtime.process_transcript_turn(
            session_id,
            request.text,
            final=request.final,
            provider_session_id=request.providerSessionId,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/sessions/{session_id}/events")
async def record_session_event(session_id: str, request: SessionEventRequest):
    try:
        return runtime.record_transport_event(session_id, request.type, request.payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/sessions/{session_id}/voicemail")
async def capture_voicemail(session_id: str, request: VoicemailRequest):
    try:
        return await runtime.capture_voicemail(
            session_id,
            recording_url=request.recordingUrl,
            transcription=request.transcription,
        )
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info",
    )
