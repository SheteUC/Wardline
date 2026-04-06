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
from observability.logging_setup import get_logger
from retry_async import retry_async
from service import VoiceRuntimeV2

logger = get_logger(__name__)


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
        self._media_frames_dropped = 0
        self._media_frames_sent = 0

    def _schedule_background(self, coro: Any) -> None:
        task = asyncio.create_task(coro)
        task.add_done_callback(lambda t: None if t.cancelled() else t.exception())

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

    def _describe_error(self, error: Exception) -> str:
        return f"{type(error).__name__}: {error}"

    def _is_connection_closed_error(self, error: Exception) -> bool:
        name = type(error).__name__
        return name in {"ConnectionClosed", "ConnectionClosedError", "ConnectionClosedOK"}

    async def _persist_transport_event(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        *,
        status: str | None = None,
    ) -> None:
        if not self.session_id:
            return
        try:
            kwargs = {"status": status} if status is not None else {}
            await self.runtime.persist_transport_event(
                self.session_id,
                event_type,
                payload,
                **kwargs,
            )
        except Exception as exc:
            logger.warning(
                "transport_event_persist_failed",
                session_id=self.session_id,
                call_sid=self.call_sid,
                event_type=event_type,
                error=self._describe_error(exc),
            )

    async def _close_deepgram_connection(self) -> None:
        self._deepgram_ready.clear()
        if self._deepgram_task and not self._deepgram_task.done():
            self._deepgram_task.cancel()
            try:
                await self._deepgram_task
            except asyncio.CancelledError:
                pass
            except Exception as exc:
                logger.warning(
                    "deepgram_task_shutdown_failed",
                    session_id=self.session_id,
                    call_sid=self.call_sid,
                    error=self._describe_error(exc),
                )
        self._deepgram_task = None

        if self._deepgram_socket:
            try:
                await self._deepgram_socket.close()
            except Exception:
                pass
            self._deepgram_socket = None

    async def _record_disconnect_event(self, *, reason: Optional[str] = None):
        metadata: dict[str, Any] = {"twilioStreamSid": self.stream_sid}
        if reason:
            metadata["reason"] = reason
        await self._persist_transport_event(
            "twilio_stream_disconnected",
            metadata,
        )

    async def _handle_payload(self, payload: dict[str, Any]) -> bool:
        event_type = payload.get("event")
        if event_type == "connected":
            await self._persist_transport_event(
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
            await self._persist_transport_event(
                "twilio_mark",
                {
                    "twilioStreamSid": self.stream_sid,
                    "name": mark_name,
                    "assistantMessageId": assistant_message_id,
                },
            )
            return True

        if event_type == "stop":
            await self._persist_transport_event(
                "twilio_stream_stopped",
                {"twilioStreamSid": self.stream_sid},
            )
            await self.websocket.close()
            self._closed = True
            return False

        await self._persist_transport_event(
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

        await self._persist_transport_event(
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
            self._media_frames_dropped += 1
            if self._media_frames_dropped in (1, 10, 50, 200):
                logger.warning(
                    "deepgram_audio_dropped",
                    session_id=self.session_id,
                    frames_dropped=self._media_frames_dropped,
                    reason="deepgram_socket_unavailable",
                )
            return

        audio_bytes = base64.b64decode(audio_payload)
        try:
            self._media_frames_sent += 1
            await self._deepgram_socket.send(audio_bytes)
            if self._media_frames_sent == 1:
                logger.info(
                    "deepgram_first_audio_sent",
                    session_id=self.session_id,
                )
            return
        except Exception as exc:
            if not self._is_connection_closed_error(exc):
                raise

        record_provider_error("deepgram_stt", "stream_closed")
        await self._persist_transport_event(
            "deepgram_stream_closed",
            {
                "twilioStreamSid": self.stream_sid,
                "error": "send_failed_on_closed_socket",
            },
        )
        await self._close_deepgram_connection()
        await self._ensure_deepgram_socket()
        if not self._deepgram_socket:
            return
        try:
            await self._deepgram_socket.send(audio_bytes)
        except Exception as exc:
            if self._is_connection_closed_error(exc):
                record_provider_error("deepgram_stt", "reconnect_send_failed")
                await self._persist_transport_event(
                    "deepgram_reconnect_failed",
                    {
                        "twilioStreamSid": self.stream_sid,
                        "error": self._describe_error(exc),
                    },
                )
                await self._close_deepgram_connection()
                return
            raise

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
            logger.error(
                "deepgram_stt_not_configured",
                session_id=self.session_id,
            )
            await self._persist_transport_event(
                "deepgram_unavailable",
                {"reason": "DEEPGRAM_API_KEY is not configured"},
            )
            return

        try:
            import websockets  # noqa: F401
        except ImportError:
            record_provider_error("deepgram_stt", "missing_dependency")
            logger.error(
                "deepgram_stt_missing_websockets",
                session_id=self.session_id,
            )
            await self._persist_transport_event(
                "deepgram_unavailable",
                {"reason": "websockets dependency is not installed"},
            )
            return

        if self._deepgram_task and not self._deepgram_task.done():
            return

        logger.info(
            "deepgram_stt_connecting",
            session_id=self.session_id,
        )
        self._deepgram_ready.clear()
        self._deepgram_task = asyncio.create_task(self._deepgram_receive_loop())
        try:
            await asyncio.wait_for(self._deepgram_ready.wait(), timeout=15.0)
        except asyncio.TimeoutError:
            logger.warning(
                "deepgram_stt_connect_timeout",
                session_id=self.session_id,
            )

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
                logger.error(
                    "deepgram_stt_connect_failed",
                    session_id=self.session_id,
                    attempt=attempt + 1,
                    max_attempts=max_attempts,
                    error=self._describe_error(exc),
                )
                await self._persist_transport_event(
                    "deepgram_connect_failed",
                    {"error": self._describe_error(exc), "attempt": attempt + 1},
                )
                attempt += 1
                if self._closed or attempt >= max_attempts:
                    break
                await asyncio.sleep(min(5.0, 0.25 * (2 ** min(attempt, 4))))
                continue

            logger.info(
                "deepgram_stt_connected",
                session_id=self.session_id,
                attempt=attempt + 1,
            )
            self._deepgram_ready.set()
            await self._persist_transport_event(
                "deepgram_connected",
                {"provider": "deepgram", "attempt": attempt + 1},
            )

            try:
                await self._receive_deepgram_results()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                await self._persist_transport_event(
                    "deepgram_stream_closed",
                    {"twilioStreamSid": self.stream_sid, "error": self._describe_error(exc)},
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
            await self._persist_transport_event(
                "deepgram_reconnecting",
                {"attempt": attempt, "maxAttempts": max_attempts},
            )
            await asyncio.sleep(min(5.0, 0.25 * (2 ** min(attempt, 4))))

    async def _receive_deepgram_results(self):
        if not self._deepgram_socket or not self.session_id:
            return

        msg_count = 0
        while not self._closed:
            raw_message = await self._deepgram_socket.recv()
            if isinstance(raw_message, bytes):
                continue

            msg_count += 1
            payload = json.loads(raw_message)

            if payload.get("type") == "UtteranceEnd":
                logger.info(
                    "deepgram_utterance_end",
                    session_id=self.session_id,
                    buffer_size=len(self._utterance_buffer),
                )
                await self._flush_utterance_buffer()
                continue

            transcript = self.runtime.deepgram.normalize_message(payload)
            if not transcript or not transcript.text:
                if msg_count == 1:
                    logger.debug(
                        "deepgram_first_message_no_transcript",
                        session_id=self.session_id,
                        msg_type=payload.get("type"),
                    )
                continue

            logger.info(
                "deepgram_transcript",
                session_id=self.session_id,
                text=transcript.text[:80],
                final=transcript.final,
                confidence=transcript.confidence,
            )

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
                self._schedule_background(
                    self._persist_transport_event(
                        "deepgram_transcript",
                        {
                            "deepgramRequestId": transcript.provider_session_id,
                            "providerSessionId": transcript.provider_session_id,
                            "final": True,
                            "confidence": transcript.confidence,
                        },
                    )
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

        current_task = asyncio.current_task()
        if self._utterance_timer is current_task:
            # The settle timer is executing this flush, so clearing the reference
            # must not cancel the active task before reply generation completes.
            self._utterance_timer = None
        elif self._utterance_timer:
            if not self._utterance_timer.done():
                self._utterance_timer.cancel()
            self._utterance_timer = None

        merged_text = " ".join(self._utterance_buffer)
        self._utterance_buffer.clear()

        logger.info(
            "deepgram_flush_utterance",
            session_id=self.session_id,
            text=merged_text[:120],
        )

        response = await self.runtime.process_transcript_turn(
            self.session_id,
            merged_text,
            final=True,
            provider_session_id=self._latest_provider_session_id or self.stream_sid,
        )

        reply = response.get("reply", "")
        if reply:
            logger.info(
                "assistant_reply_speaking",
                session_id=self.session_id,
                reply_length=len(reply),
                reply_preview=reply[:80],
            )
            await self._speak(
                str(reply),
                assistant_message_id=response.get("assistantMessageId"),
                mark_name_prefix="assistant-reply",
            )
        else:
            logger.warning(
                "assistant_reply_empty",
                session_id=self.session_id,
                ignored=response.get("ignored", False),
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
            await self._persist_transport_event(
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
            await self._persist_transport_event(
                "tts_send_failed",
                {"provider": settings.managed_tts_provider, "markName": mark_name},
            )
            raise

    async def _shutdown(self):
        await self._close_deepgram_connection()
        self._assistant_playback_ready.set()

        if self.session_id:
            try:
                await self.runtime.finalize_session(
                    self.session_id,
                    failure_reason=self._failure_reason,
                )
            except Exception:
                return
