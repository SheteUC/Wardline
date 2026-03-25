"""
Twilio Media Stream ↔ Pipecat bridge adapter.

Translates Twilio's WebSocket media stream protocol (mulaw audio in JSON
messages) into Pipecat InputAudioRawFrame / OutputAudioRawFrame so the
Pipecat pipeline can process voice calls in real time.

Architecture:
    Twilio WebSocket ──► TwilioInputTransport ──► Pipecat Pipeline
                                                         │
    Twilio WebSocket ◄── TwilioOutputTransport ◄─────────┘

Usage (inside the FastAPI WebSocket handler):
    from twilio_transport import TwilioMediaStreamAdapter

    adapter = TwilioMediaStreamAdapter(websocket, call_sid)
    await adapter.run_pipeline(context, flow_manager)
"""
import asyncio
import base64
import json
from typing import Optional

from loguru import logger
from config import settings

try:
    from pipecat.frames.frames import (
        Frame,
        AudioRawFrame,
        EndFrame,
        StartInterruptionFrame,
    )
    from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineTask, PipelineParams
    PIPECAT_AVAILABLE = True
except ImportError:
    PIPECAT_AVAILABLE = False
    logger.warning("Pipecat not available — TwilioMediaStreamAdapter will run in passthrough mode")


# Twilio media stream settings for mulaw 8000 Hz
TWILIO_SAMPLE_RATE = 8000
TWILIO_CHANNELS = 1
TWILIO_SAMPLE_WIDTH = 1  # 8-bit mulaw


class TwilioInputTransport:
    """
    Feeds Twilio mulaw audio frames into the Pipecat pipeline.

    Twilio sends base64-encoded mulaw 8000 Hz audio in JSON messages:
    {
        "event": "media",
        "sequenceNumber": "1",
        "media": {
            "track": "inbound",
            "chunk": "0",
            "timestamp": "5",
            "payload": "<base64 mulaw>"
        },
        "streamSid": "..."
    }
    """

    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._stream_sid: Optional[str] = None

    def feed(self, payload_b64: str):
        """Decode base64 mulaw payload and push to queue."""
        try:
            audio_bytes = base64.b64decode(payload_b64)
            if PIPECAT_AVAILABLE:
                frame = AudioRawFrame(
                    audio=audio_bytes,
                    sample_rate=TWILIO_SAMPLE_RATE,
                    num_channels=TWILIO_CHANNELS,
                )
                self._queue.put_nowait(frame)
        except Exception as e:
            logger.error(f"TwilioInputTransport.feed error: {e}")

    async def get_frame(self) -> Optional[Frame]:
        """Get the next audio frame (blocks if empty)."""
        if not PIPECAT_AVAILABLE:
            return None
        return await self._queue.get()

    def set_stream_sid(self, stream_sid: str):
        self._stream_sid = stream_sid


class TwilioOutputTransport:
    """
    Takes Pipecat output audio frames and sends them back to Twilio
    as base64-encoded mulaw in the Twilio Media Stream protocol.
    """

    def __init__(self, websocket, stream_sid: Optional[str] = None):
        self._websocket = websocket
        self._stream_sid = stream_sid

    def set_stream_sid(self, stream_sid: str):
        self._stream_sid = stream_sid

    async def send_audio(self, audio_bytes: bytes):
        """Send audio bytes back to Twilio as a media message."""
        if not self._stream_sid:
            logger.warning("TwilioOutputTransport: no stream_sid set, skipping send")
            return
        try:
            payload = base64.b64encode(audio_bytes).decode("utf-8")
            message = {
                "event": "media",
                "streamSid": self._stream_sid,
                "media": {"payload": payload},
            }
            await self._websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"TwilioOutputTransport.send_audio error: {e}")

    async def send_clear(self):
        """Tell Twilio to clear any queued audio (used for barge-in)."""
        if not self._stream_sid:
            return
        try:
            await self._websocket.send_text(
                json.dumps({"event": "clear", "streamSid": self._stream_sid})
            )
        except Exception as e:
            logger.error(f"TwilioOutputTransport.send_clear error: {e}")


class TwilioMediaStreamAdapter:
    """
    High-level adapter that connects a Twilio Media Stream WebSocket to
    a Pipecat bot pipeline.

    If Pipecat is unavailable (ImportError), falls back to the existing
    Gather-based AI response approach.
    """

    def __init__(self, websocket, call_sid: str):
        self._websocket = websocket
        self._call_sid = call_sid
        self._input = TwilioInputTransport()
        self._output: Optional[TwilioOutputTransport] = None
        self._pipeline_task: Optional[PipelineTask] = None
        self._runner_task: Optional[asyncio.Task] = None

    async def run(self, context=None, flow_manager=None):
        """
        Main loop: read Twilio messages and drive the Pipecat pipeline.
        Falls back to graceful no-op if Pipecat is unavailable.
        """
        logger.info(f"TwilioMediaStreamAdapter starting for call {self._call_sid}")

        if not PIPECAT_AVAILABLE:
            logger.warning(
                f"Pipecat is not installed — streaming mode unavailable for {self._call_sid}. "
                "Install 'pipecat-ai' or set USE_STREAMING=false to use Gather mode."
            )
            # Drain the WebSocket so Twilio doesn't get a closed connection immediately
            async for _ in self._ws_iter():
                pass
            return

        try:
            async for raw_message in self._ws_iter():
                # Guard against malformed JSON from Twilio
                try:
                    message = json.loads(raw_message)
                except json.JSONDecodeError as e:
                    logger.warning(f"Received non-JSON message for {self._call_sid}: {e}")
                    continue

                event = message.get("event")

                if event == "connected":
                    logger.info("Twilio stream protocol connected")

                elif event == "start":
                    start_data = message.get("start", {})
                    stream_sid = start_data.get("streamSid", "")
                    sample_rate = start_data.get("mediaFormat", {}).get("sampleRate", TWILIO_SAMPLE_RATE)
                    logger.info(f"Twilio stream started: sid={stream_sid} rate={sample_rate}Hz")

                    self._input.set_stream_sid(stream_sid)
                    self._output = TwilioOutputTransport(self._websocket, stream_sid)

                    if context and flow_manager:
                        await self._start_pipecat_pipeline(context, flow_manager)

                elif event == "media":
                    payload = message.get("media", {}).get("payload", "")
                    track = message.get("media", {}).get("track", "inbound")
                    if track == "inbound" and payload:
                        self._input.feed(payload)

                elif event == "stop":
                    logger.info(f"Twilio stream stop event for {self._call_sid}")
                    break

                elif event == "mark":
                    # Twilio mark event — used to sync audio playback completion
                    mark_name = message.get("mark", {}).get("name", "")
                    logger.debug(f"Twilio mark received: {mark_name} for {self._call_sid}")

        except Exception as e:
            logger.error(f"TwilioMediaStreamAdapter.run error: {e}", exc_info=True)
        finally:
            await self._shutdown()

    async def _start_pipecat_pipeline(self, context, flow_manager):
        """Start the Pipecat bot pipeline in the background."""
        try:
            from bot import create_bot_pipeline

            # Validate required credentials before creating the pipeline
            if not settings.azure_speech_key:
                raise ValueError("AZURE_SPEECH_KEY is not configured — cannot start streaming pipeline")
            if not settings.azure_openai_key and settings.agent_type != "azure_ai_foundry":
                raise ValueError("AZURE_OPENAI_KEY is not configured — cannot start streaming pipeline")

            class _TwilioTransportShim:
                """Minimal shim so create_bot_pipeline accepts our adapter."""
                def input(self_):
                    return _AudioInputProcessor(self._input)

                def output(self_):
                    return _AudioOutputProcessor(self._output)

            transport_shim = _TwilioTransportShim()
            result = await create_bot_pipeline(context, transport_shim, flow_manager)

            # create_bot_pipeline may return (pipeline, messages) or just pipeline
            if isinstance(result, tuple):
                pipeline, initial_messages = result
            else:
                pipeline = result
                initial_messages = []

            self._pipeline_task = PipelineTask(
                pipeline,
                params=PipelineParams(
                    allow_interruptions=True,
                    enable_metrics=True,
                ),
            )

            if initial_messages:
                from pipecat.frames.frames import LLMMessagesFrame
                await self._pipeline_task.queue_frames([LLMMessagesFrame(initial_messages)])

            runner = PipelineRunner()
            self._runner_task = asyncio.create_task(runner.run(self._pipeline_task))
            logger.info(f"Pipecat pipeline started for {self._call_sid}")

        except ValueError as e:
            # Configuration errors — log clearly and let the call continue in Gather mode
            logger.error(f"Pipecat pipeline configuration error for {self._call_sid}: {e}")
            self._pipeline_task = None
        except Exception as e:
            logger.error(f"Failed to start Pipecat pipeline for {self._call_sid}: {e}", exc_info=True)
            self._pipeline_task = None

    async def _shutdown(self):
        """Gracefully shut down the pipeline."""
        if self._pipeline_task is not None and PIPECAT_AVAILABLE:
            try:
                await self._pipeline_task.queue_frames([EndFrame()])
                # Give the pipeline up to 3 seconds to flush remaining frames
                await asyncio.wait_for(asyncio.shield(asyncio.sleep(3)), timeout=3)
            except (asyncio.TimeoutError, Exception):
                pass
        if self._runner_task is not None:
            self._runner_task.cancel()
            try:
                await self._runner_task
            except (asyncio.CancelledError, Exception):
                pass
        self._pipeline_task = None
        self._runner_task = None
        logger.info(f"TwilioMediaStreamAdapter shut down for {self._call_sid}")

    async def _ws_iter(self):
        """Async iterator over WebSocket text messages."""
        from fastapi import WebSocketDisconnect
        try:
            while True:
                yield await self._websocket.receive_text()
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for {self._call_sid}")
        except Exception as e:
            logger.error(f"WebSocket receive error: {e}")


# ---------------------------------------------------------------------------
# Pipecat FrameProcessor shims for Twilio audio I/O
# ---------------------------------------------------------------------------

if PIPECAT_AVAILABLE:
    class _AudioInputProcessor(FrameProcessor):
        """Reads frames from TwilioInputTransport and pushes them downstream."""

        def __init__(self, transport: TwilioInputTransport):
            super().__init__()
            self._transport = transport
            self._task: Optional[asyncio.Task] = None

        async def process_frame(self, frame: Frame, direction: FrameDirection):
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)

        async def start(self, *args, **kwargs):
            self._task = asyncio.create_task(self._pump())

        async def stop(self, *args, **kwargs):
            if self._task:
                self._task.cancel()

        async def _pump(self):
            while True:
                frame = await self._transport.get_frame()
                if frame:
                    await self.push_frame(frame)

    class _AudioOutputProcessor(FrameProcessor):
        """Sends AudioRawFrame output to TwilioOutputTransport."""

        def __init__(self, transport: Optional[TwilioOutputTransport]):
            super().__init__()
            self._transport = transport

        async def process_frame(self, frame: Frame, direction: FrameDirection):
            await super().process_frame(frame, direction)
            if self._transport and isinstance(frame, AudioRawFrame):
                await self._transport.send_audio(frame.audio)
            elif self._transport and isinstance(frame, StartInterruptionFrame):
                await self._transport.send_clear()
            else:
                await self.push_frame(frame, direction)
