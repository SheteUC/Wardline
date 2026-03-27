"""
FastAPI control plane for Voice Runtime V2.

This service is the new internal multi-agent runtime. Twilio/LiveKit ingress is
intended to target this runtime over time, but the text-turn endpoints provide a
stable integration surface for local validation before full telephony cutover.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import settings
from service import VoiceRuntimeV2

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
        "providers": runtime.readiness(),
    }


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
