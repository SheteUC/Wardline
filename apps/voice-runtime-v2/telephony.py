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
from observability.metrics import (
    record_deepgram_reconnect_attempt,
    record_deepgram_reconnect_failure,
    record_provider_error,
)
from retry_async import retry_async
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
        self._utterance_buffer: list[str] = []
        self._utterance_timer: Optional[asyncio.Task[None]] = None
        self._latest_provider_session_id: Optional[str] = None
        self._deepgram_ready = asyncio.Event()

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

        stream_token = str(custom_parameters.get("streamToken") or "")
        try:
            greeting_text, greeting_message_id = await self.runtime.authorize_twilio_media_and_sync_transport(
                self.session_id,
                stream_token=stream_token,
                provider_session_id=self.stream_sid or self.call_sid,
                twilio_stream_sid=self.stream_sid or None,
            )
        except (KeyError, PermissionError):
            await self.websocket.close(code=4401, reason="Invalid media stream token")
            self._closed = True
            return

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
        if not self._greeting_sent and greeting_text:
            await self._speak(
                greeting_text,
                assistant_message_id=greeting_message_id,
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

    async def _open_deepgram_websocket(self):
        import websockets

        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
        url = self.runtime.deepgram.websocket_url()

        async def _connect_once():
            try:
                return await websockets.connect(url, additional_headers=headers)
            except TypeError:
                return await websockets.connect(url, extra_headers=headers)

        return await retry_async(
            _connect_once,
            attempts=3,
            operation="deepgram_connect",
            circuit_name="deepgram_stt",
        )

    async def _ensure_deepgram_socket(self):
        if not self.session_id or self._closed:
            return

        if not self.runtime.deepgram.validate().get("configured"):
            record_provider_error("deepgram_stt", "not_configured")
            await self.runtime.persist_transport_event(
                self.session_id,
                "deepgram_unavailable",
                {"reason": "DEEPGRAM_API_KEY is not configured"},
            )
            return

        try:
            import websockets  # noqa: F401
        except ImportError:
            record_provider_error("deepgram_stt", "missing_dependency")
            await self.runtime.persist_transport_event(
                self.session_id,
                "deepgram_unavailable",
                {"reason": "websockets dependency is not installed"},
            )
            return

        if self._deepgram_task and not self._deepgram_task.done():
            # Reconnect in progress; avoid blocking media frames on the ready event.
            return

        self._deepgram_ready.clear()
        self._deepgram_task = asyncio.create_task(self._deepgram_receive_loop())
        try:
            await asyncio.wait_for(self._deepgram_ready.wait(), timeout=15.0)
        except asyncio.TimeoutError:
            pass

    async def _deepgram_receive_loop(self):
        attempt = 0
        max_attempts = max(1, settings.voice_deepgram_reconnect_attempts)

        while not self._closed and self.session_id and attempt < max_attempts:
            try:
                self._deepgram_socket = await self._open_deepgram_websocket()
            except Exception as exc:
                record_deepgram_reconnect_attempt()
                record_deepgram_reconnect_failure()
                record_provider_error("deepgram_stt", "connect_failed")
                if self.session_id:
                    await self.runtime.persist_transport_event(
                        self.session_id,
                        "deepgram_connect_failed",
                        {"error": f"{type(exc).__name__}: {exc}", "attempt": attempt + 1},
                    )
                attempt += 1
                if self._closed or attempt >= max_attempts:
                    break
                await asyncio.sleep(min(5.0, 0.25 * (2 ** min(attempt, 4))))
                continue

            self._deepgram_ready.set()
            await self.runtime.persist_transport_event(
                self.session_id,
                "deepgram_connected",
                {"provider": "deepgram", "attempt": attempt + 1},
            )

            try:
                await self._receive_deepgram_results()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                if self.session_id:
                    await self.runtime.persist_transport_event(
                        self.session_id,
                        "deepgram_stream_closed",
                        {"twilioStreamSid": self.stream_sid, "error": f"{type(exc).__name__}: {exc}"},
                    )
            finally:
                self._deepgram_ready.clear()
                if self._deepgram_socket:
                    try:
                        await self._deepgram_socket.close()
                    except Exception:
                        pass
                    self._deepgram_socket = None

            if self._closed:
                break

            attempt += 1
            if attempt >= max_attempts:
                break
            record_deepgram_reconnect_attempt()
            if self.session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "deepgram_reconnecting",
                    {"attempt": attempt, "maxAttempts": max_attempts},
                )
            await asyncio.sleep(min(5.0, 0.25 * (2 ** min(attempt, 4))))

    async def _receive_deepgram_results(self):
        if not self._deepgram_socket or not self.session_id:
            return

        while not self._closed:
            raw_message = await self._deepgram_socket.recv()
            if isinstance(raw_message, bytes):
                continue

            payload = json.loads(raw_message)

            if payload.get("type") == "UtteranceEnd":
                await self._flush_utterance_buffer()
                continue

            transcript = self.runtime.deepgram.normalize_message(payload)
            if not transcript or not transcript.text:
                continue

            if transcript.provider_session_id:
                self._latest_provider_session_id = transcript.provider_session_id

            if not transcript.final:
                await self.runtime.process_transcript_turn(
                    self.session_id,
                    transcript.text,
                    final=False,
                    provider_session_id=transcript.provider_session_id or self.stream_sid,
                )
                continue

            self._utterance_buffer.append(transcript.text)

            if transcript.provider_session_id:
                await self.runtime.persist_transport_event(
                    self.session_id,
                    "deepgram_transcript",
                    {
                        "deepgramRequestId": transcript.provider_session_id,
                        "providerSessionId": transcript.provider_session_id,
                        "final": True,
                        "confidence": transcript.confidence,
                    },
                )

            if self._utterance_timer and not self._utterance_timer.done():
                self._utterance_timer.cancel()
            self._utterance_timer = asyncio.create_task(self._utterance_settle_then_flush())

    async def _utterance_settle_then_flush(self):
        """Wait for a brief settle period, then flush the accumulated buffer."""
        await asyncio.sleep(settings.voice_utterance_settle_seconds)
        await self._flush_utterance_buffer()

    async def _flush_utterance_buffer(self):
        if not self._utterance_buffer or not self.session_id:
            return

        if self._utterance_timer and not self._utterance_timer.done():
            self._utterance_timer.cancel()
            self._utterance_timer = None

        merged_text = " ".join(self._utterance_buffer)
        self._utterance_buffer.clear()

        response = await self.runtime.process_transcript_turn(
            self.session_id,
            merged_text,
            final=True,
            provider_session_id=self._latest_provider_session_id or self.stream_sid,
        )

        if response.get("reply"):
            await self._speak(
                str(response["reply"]),
                assistant_message_id=response.get("assistantMessageId"),
                mark_name_prefix="assistant-reply",
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
            record_provider_error("deepgram_tts", "unavailable")
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
            record_provider_error("twilio", "send_failed")
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
