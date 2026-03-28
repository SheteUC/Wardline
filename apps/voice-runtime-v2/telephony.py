"""
Twilio/Deepgram telephony bridge for Voice Runtime V2.
"""
from __future__ import annotations

import asyncio
import base64
import json
from typing import Any, Optional

from fastapi import WebSocket, WebSocketDisconnect

from config import settings
from service import VoiceRuntimeV2


class TwilioMediaSession:
    def __init__(self, websocket: WebSocket, runtime: VoiceRuntimeV2):
        self.websocket = websocket
        self.runtime = runtime
        self.session_id: Optional[str] = websocket.query_params.get("sessionId")
        self.call_sid: Optional[str] = websocket.query_params.get("callSid")
        self.stream_sid: Optional[str] = None
        self._deepgram_socket: Any = None
        self._deepgram_task: Optional[asyncio.Task[None]] = None
        self._greeting_sent = False

    async def run(self):
        await self.websocket.accept()
        try:
            while True:
                raw_message = await self.websocket.receive_text()
                payload = json.loads(raw_message)
                await self._handle_payload(payload)
        except WebSocketDisconnect:
            if self.session_id:
                self.runtime.record_transport_event(
                    self.session_id,
                    "twilio_stream_disconnected",
                    {"twilioStreamSid": self.stream_sid},
                )
        finally:
            await self._shutdown()

    async def _handle_payload(self, payload: dict[str, Any]):
        event_type = payload.get("event")
        if event_type == "connected":
            if self.session_id:
                self.runtime.record_transport_event(self.session_id, "twilio_stream_connected", {})
            return

        if event_type == "start":
            await self._handle_start(payload.get("start") or {})
            return

        if event_type == "media":
            await self._handle_media(payload.get("media") or {})
            return

        if event_type == "mark":
            if self.session_id:
                self.runtime.record_transport_event(
                    self.session_id,
                    "twilio_mark",
                    {"twilioStreamSid": self.stream_sid, "name": (payload.get("mark") or {}).get("name")},
                )
            return

        if event_type == "stop":
            if self.session_id:
                self.runtime.record_transport_event(
                    self.session_id,
                    "twilio_stream_stopped",
                    {"twilioStreamSid": self.stream_sid},
                )
            await self.websocket.close()
            return

        if self.session_id:
            self.runtime.record_transport_event(
                self.session_id,
                "twilio_stream_event",
                {"twilioStreamSid": self.stream_sid, "eventType": str(event_type or "unknown")},
            )

    async def _handle_start(self, start_payload: dict[str, Any]):
        custom_parameters = start_payload.get("customParameters") or {}
        if isinstance(custom_parameters, list):
            custom_parameters = {
                entry.get("name"): entry.get("value")
                for entry in custom_parameters
                if isinstance(entry, dict) and entry.get("name")
            }

        self.session_id = str(custom_parameters.get("sessionId") or self.session_id or "")
        self.call_sid = str(start_payload.get("callSid") or custom_parameters.get("callSid") or self.call_sid or "")
        self.stream_sid = str(start_payload.get("streamSid") or "")

        if not self.session_id:
            await self.websocket.close(code=4400, reason="Missing sessionId")
            return

        self.runtime.update_transport_metadata(
            self.session_id,
            providerSessionId=self.stream_sid or self.call_sid,
            twilioStreamSid=self.stream_sid or None,
        )
        self.runtime.record_transport_event(
            self.session_id,
            "twilio_stream_started",
            {
                "twilioStreamSid": self.stream_sid,
                "providerSessionId": self.stream_sid or self.call_sid,
                "callSid": self.call_sid,
                "track": start_payload.get("track"),
                "mediaFormat": start_payload.get("mediaFormat"),
            },
        )

        await self._ensure_deepgram_socket()
        if not self._greeting_sent:
            greeting = self.runtime.get_session(self.session_id).messages[-1].text
            await self._speak(greeting, mark_name="greeting")
            self._greeting_sent = True

    async def _handle_media(self, media_payload: dict[str, Any]):
        if not self.session_id:
            return

        audio_payload = media_payload.get("payload")
        if not isinstance(audio_payload, str) or not audio_payload:
            return

        if not self._deepgram_socket:
            await self._ensure_deepgram_socket()
        if not self._deepgram_socket:
            return

        await self._deepgram_socket.send(base64.b64decode(audio_payload))

    async def _ensure_deepgram_socket(self):
        if self._deepgram_socket or not self.session_id:
            return

        if not self.runtime.deepgram.validate().get("configured"):
            self.runtime.record_transport_event(
                self.session_id,
                "deepgram_unavailable",
                {"reason": "DEEPGRAM_API_KEY is not configured"},
            )
            return

        try:
            import websockets
        except ImportError:
            self.runtime.record_transport_event(
                self.session_id,
                "deepgram_unavailable",
                {"reason": "websockets dependency is not installed"},
            )
            return

        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
        try:
            self._deepgram_socket = await websockets.connect(
                self.runtime.deepgram.websocket_url(),
                additional_headers=headers,
            )
        except TypeError:
            self._deepgram_socket = await websockets.connect(
                self.runtime.deepgram.websocket_url(),
                extra_headers=headers,
            )

        self.runtime.record_transport_event(
            self.session_id,
            "deepgram_connected",
            {"provider": "deepgram"},
        )
        self._deepgram_task = asyncio.create_task(self._receive_deepgram_results())

    async def _receive_deepgram_results(self):
        if not self._deepgram_socket or not self.session_id:
            return

        try:
            while True:
                raw_message = await self._deepgram_socket.recv()
                if isinstance(raw_message, bytes):
                    continue

                payload = json.loads(raw_message)
                transcript = self.runtime.deepgram.normalize_message(payload)
                if not transcript or not transcript.text:
                    continue

                response = await self.runtime.process_transcript_turn(
                    self.session_id,
                    transcript.text,
                    final=transcript.final,
                    provider_session_id=transcript.provider_session_id or self.stream_sid,
                )
                if transcript.provider_session_id:
                    self.runtime.record_transport_event(
                        self.session_id,
                        "deepgram_transcript",
                        {
                            "deepgramRequestId": transcript.provider_session_id,
                            "providerSessionId": transcript.provider_session_id,
                            "final": transcript.final,
                            "confidence": transcript.confidence,
                        },
                    )

                if transcript.final and response.get("reply"):
                    await self._speak(str(response["reply"]), mark_name="assistant-reply")
        except Exception:
            if self.session_id:
                self.runtime.record_transport_event(
                    self.session_id,
                    "deepgram_stream_closed",
                    {"twilioStreamSid": self.stream_sid},
                )

    async def _speak(self, text: str, *, mark_name: str):
        if not self.stream_sid or not text.strip():
            return

        audio = await self.runtime.synthesize_reply(text)
        if not audio:
            if self.session_id:
                self.runtime.record_transport_event(
                    self.session_id,
                    "tts_unavailable",
                    {"provider": settings.managed_tts_provider},
                )
            return

        await self.websocket.send_json(
            {
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {
                    "payload": base64.b64encode(audio).decode("ascii"),
                },
            }
        )
        await self.websocket.send_json(
            {
                "event": "mark",
                "streamSid": self.stream_sid,
                "mark": {"name": mark_name},
            }
        )

    async def _shutdown(self):
        if self._deepgram_task:
            self._deepgram_task.cancel()
            try:
                await self._deepgram_task
            except asyncio.CancelledError:
                pass

        if self._deepgram_socket:
            try:
                await self._deepgram_socket.close()
            except Exception:
                pass

        if self.session_id:
            try:
                await self.runtime.finalize_session(self.session_id)
            except Exception:
                return
