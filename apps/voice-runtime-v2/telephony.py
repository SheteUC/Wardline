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
        self._assistant_playback_ready = asyncio.Event()
        self._assistant_playback_ready.set()
        self._mark_to_assistant_message: dict[str, str] = {}
        self._mark_counter = 0
        self._closed = False
        self._failure_reason: Optional[str] = None

    async def run(self):
        await self.websocket.accept()
        try:
            while True:
                try:
                    raw_message = await self.websocket.receive_text()
                except WebSocketDisconnect:
                    await self._record_disconnect_event()
                    break
                except RuntimeError as error:
                    if 'WebSocket is not connected' in str(error):
                        await self._record_disconnect_event(reason="not_connected")
                        break
                    raise
                payload = json.loads(raw_message)
                should_continue = await self._handle_payload(payload)
                if not should_continue or self._closed:
                    break
        except Exception as error:
            self._failure_reason = self._failure_reason or f"{type(error).__name__}: {error}"
            await self._record_disconnect_event(reason="runtime_error")
            raise
        finally:
            await self._shutdown()

    async def _record_disconnect_event(self, *, reason: Optional[str] = None):
        if self.session_id:
            metadata: dict[str, Any] = {"twilioStreamSid": self.stream_sid}
            if reason:
                metadata["reason"] = reason
            await self.runtime.persist_transport_event(
                self.session_id,
                "twilio_stream_disconnected",
                metadata,
            )

    async def _handle_payload(self, payload: dict[str, Any]) -> bool:
        event_type = payload.get("event")
        if event_type == "connected":
            if self.session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "twilio_stream_connected",
                    {},
                )
            return True

        if event_type == "start":
            await self._handle_start(payload.get("start") or {})
            return not self._closed

        if event_type == "media":
            await self._handle_media(payload.get("media") or {})
            return True

        if event_type == "mark":
            mark_name = (payload.get("mark") or {}).get("name")
            assistant_message_id = self._mark_to_assistant_message.pop(str(mark_name), None) if mark_name else None
            self._assistant_playback_ready.set()
            if self.session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "twilio_mark",
                    {
                        "twilioStreamSid": self.stream_sid,
                        "name": mark_name,
                        "assistantMessageId": assistant_message_id,
                    },
                )
            return True

        if event_type == "stop":
            if self.session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "twilio_stream_stopped",
                    {"twilioStreamSid": self.stream_sid},
                )
            await self.websocket.close()
            self._closed = True
            return False

        if self.session_id:
            await self.runtime.persist_transport_event(
                self.session_id,
                "twilio_stream_event",
                {"twilioStreamSid": self.stream_sid, "eventType": str(event_type or "unknown")},
            )
        return True

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
            self._closed = True
            return

        self.runtime.update_transport_metadata(
            self.session_id,
            providerSessionId=self.stream_sid or self.call_sid,
            twilioStreamSid=self.stream_sid or None,
        )
        await self.runtime.persist_transport_event(
            self.session_id,
            "twilio_stream_started",
            {
                "twilioStreamSid": self.stream_sid,
                "providerSessionId": self.stream_sid or self.call_sid,
                "callSid": self.call_sid,
                "track": start_payload.get("track"),
                "mediaFormat": start_payload.get("mediaFormat"),
            },
            status="ONGOING",
        )

        await self._ensure_deepgram_socket()
        if not self._greeting_sent:
            greeting_message = self.runtime.get_session(self.session_id).messages[-1]
            await self._speak(
                greeting_message.text,
                assistant_message_id=getattr(greeting_message, "messageId", None),
                mark_name_prefix="greeting",
            )
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
            await self.runtime.persist_transport_event(
                self.session_id,
                "deepgram_unavailable",
                {"reason": "DEEPGRAM_API_KEY is not configured"},
            )
            return

        try:
            import websockets
        except ImportError:
            await self.runtime.persist_transport_event(
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

        await self.runtime.persist_transport_event(
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
                    await self.runtime.persist_transport_event(
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
                    await self._speak(
                        str(response["reply"]),
                        assistant_message_id=response.get("assistantMessageId"),
                        mark_name_prefix="assistant-reply",
                    )
        except Exception:
            if self.session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "deepgram_stream_closed",
                    {"twilioStreamSid": self.stream_sid},
                )

    async def _speak(
        self,
        text: str,
        *,
        assistant_message_id: Optional[str],
        mark_name_prefix: str,
    ):
        if not self.stream_sid or not text.strip():
            return

        await self._assistant_playback_ready.wait()
        self._assistant_playback_ready.clear()

        audio = await self.runtime.synthesize_reply(text)
        if not audio:
            self._assistant_playback_ready.set()
            if self.session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "tts_unavailable",
                    {"provider": settings.managed_tts_provider},
                )
            return

        self._mark_counter += 1
        mark_name = f"{mark_name_prefix}-{self._mark_counter}"
        if assistant_message_id:
            self._mark_to_assistant_message[mark_name] = assistant_message_id

        try:
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
        except Exception:
            self._mark_to_assistant_message.pop(mark_name, None)
            self._assistant_playback_ready.set()
            if self.session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "tts_send_failed",
                    {"provider": settings.managed_tts_provider, "markName": mark_name},
                )
            raise

    async def _shutdown(self):
        if self._deepgram_task:
            self._deepgram_task.cancel()
            try:
                await self._deepgram_task
            except asyncio.CancelledError:
                pass

        self._assistant_playback_ready.set()

        if self._deepgram_socket:
            try:
                await self._deepgram_socket.close()
            except Exception:
                pass

        if self.session_id:
            try:
                await self.runtime.finalize_session(
                    self.session_id,
                    failure_reason=self._failure_reason,
                )
            except Exception:
                return
