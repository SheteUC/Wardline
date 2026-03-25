"""
End-to-end tests for Pipecat streaming mode.

These tests mock the Twilio WebSocket connection and verify that the
TwilioMediaStreamAdapter correctly handles the full message lifecycle:
  connected → start → media → stop

Run with:
    pytest tests/integration/test_streaming_e2e.py -v
"""
import asyncio
import base64
import importlib
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_media_payload(duration_ms: int = 20, sample_rate: int = 8000) -> str:
    """Generate a minimal mulaw silent audio payload."""
    num_samples = int(sample_rate * duration_ms / 1000)
    # Mulaw silence is represented by 0xFF bytes
    audio_bytes = bytes([0xFF] * num_samples)
    return base64.b64encode(audio_bytes).decode("utf-8")


def _twilio_messages(stream_sid: str = "MX_test_stream") -> list:
    """Return a realistic sequence of Twilio WebSocket messages."""
    return [
        json.dumps({"event": "connected", "protocol": "Call", "version": "1.0.0"}),
        json.dumps({
            "event": "start",
            "sequenceNumber": "1",
            "start": {
                "streamSid": stream_sid,
                "accountSid": "AC_test",
                "callSid": "CA_test",
                "tracks": ["inbound"],
                "mediaFormat": {
                    "encoding": "audio/x-mulaw",
                    "sampleRate": 8000,
                    "channels": 1,
                },
            },
        }),
        # Simulate a few 20 ms audio frames
        *[
            json.dumps({
                "event": "media",
                "sequenceNumber": str(i + 2),
                "media": {
                    "track": "inbound",
                    "chunk": str(i),
                    "timestamp": str(i * 20),
                    "payload": _make_media_payload(),
                },
                "streamSid": stream_sid,
            })
            for i in range(5)
        ],
        json.dumps({
            "event": "stop",
            "sequenceNumber": "8",
            "stop": {"accountSid": "AC_test", "callSid": "CA_test"},
            "streamSid": stream_sid,
        }),
    ]


class MockWebSocket:
    """Fake FastAPI WebSocket that yields pre-canned messages."""

    def __init__(self, messages: list):
        self._messages = iter(messages)
        self.sent_messages: list = []

    async def receive_text(self) -> str:
        try:
            return next(self._messages)
        except StopIteration:
            from fastapi.websockets import WebSocketDisconnect
            raise WebSocketDisconnect(code=1000)

    async def send_text(self, data: str):
        self.sent_messages.append(data)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestTwilioInputTransport:
    """Unit tests for audio ingestion."""

    def test_feed_decodes_base64_payload(self):
        from twilio_transport import TwilioInputTransport, PIPECAT_AVAILABLE
        transport = TwilioInputTransport()
        payload = _make_media_payload()
        # Should not raise even if Pipecat is unavailable
        transport.feed(payload)
        if PIPECAT_AVAILABLE:
            assert not transport._queue.empty()

    def test_feed_handles_invalid_base64(self):
        from twilio_transport import TwilioInputTransport
        transport = TwilioInputTransport()
        # Should not raise
        transport.feed("!!!invalid_base64!!!")

    def test_set_stream_sid(self):
        from twilio_transport import TwilioInputTransport
        transport = TwilioInputTransport()
        transport.set_stream_sid("MX_test")
        assert transport._stream_sid == "MX_test"


class TestTwilioOutputTransport:
    """Unit tests for audio output."""

    @pytest.mark.asyncio
    async def test_send_audio_without_stream_sid(self):
        from twilio_transport import TwilioOutputTransport
        ws = MockWebSocket([])
        transport = TwilioOutputTransport(ws)
        # Should not raise; just log a warning
        await transport.send_audio(b"\xff" * 160)
        assert ws.sent_messages == []

    @pytest.mark.asyncio
    async def test_send_audio_with_stream_sid(self):
        from twilio_transport import TwilioOutputTransport
        ws = MockWebSocket([])
        transport = TwilioOutputTransport(ws, stream_sid="MX_test")
        await transport.send_audio(b"\xff" * 160)
        assert len(ws.sent_messages) == 1
        msg = json.loads(ws.sent_messages[0])
        assert msg["event"] == "media"
        assert msg["streamSid"] == "MX_test"

    @pytest.mark.asyncio
    async def test_send_clear(self):
        from twilio_transport import TwilioOutputTransport
        ws = MockWebSocket([])
        transport = TwilioOutputTransport(ws, stream_sid="MX_test")
        await transport.send_clear()
        assert len(ws.sent_messages) == 1
        msg = json.loads(ws.sent_messages[0])
        assert msg["event"] == "clear"


class TestTwilioMediaStreamAdapter:
    """Integration tests for the full adapter lifecycle."""

    @pytest.mark.asyncio
    async def test_run_without_pipecat_drains_websocket(self):
        """When Pipecat is unavailable, the adapter should drain the WebSocket cleanly."""
        from twilio_transport import TwilioMediaStreamAdapter
        messages = _twilio_messages()
        ws = MockWebSocket(messages)
        adapter = TwilioMediaStreamAdapter(ws, "CA_test")

        with patch("twilio_transport.PIPECAT_AVAILABLE", False):
            await adapter.run(context=None, flow_manager=None)
        # Should complete without raising

    @pytest.mark.asyncio
    async def test_run_processes_all_events(self):
        """Adapter should handle connected, start, media, and stop without errors."""
        from twilio_transport import TwilioMediaStreamAdapter, PIPECAT_AVAILABLE

        messages = _twilio_messages()
        ws = MockWebSocket(messages)
        adapter = TwilioMediaStreamAdapter(ws, "CA_test")

        mock_context = MagicMock()
        mock_context.call_sid = "CA_test"

        # Patch pipeline start to be a no-op so we don't need real Azure creds
        with patch.object(adapter, "_start_pipecat_pipeline", new=AsyncMock()):
            if PIPECAT_AVAILABLE:
                await adapter.run(context=mock_context, flow_manager=MagicMock())
            else:
                with patch("twilio_transport.PIPECAT_AVAILABLE", False):
                    await adapter.run(context=None, flow_manager=None)

    @pytest.mark.asyncio
    async def test_run_handles_malformed_json(self):
        """Adapter should skip malformed JSON messages gracefully."""
        from twilio_transport import TwilioMediaStreamAdapter

        bad_messages = [
            "this is not json",
            json.dumps({"event": "connected"}),
            json.dumps({"event": "stop"}),
        ]
        ws = MockWebSocket(bad_messages)
        adapter = TwilioMediaStreamAdapter(ws, "CA_test")

        with patch("twilio_transport.PIPECAT_AVAILABLE", True):
            with patch.object(adapter, "_start_pipecat_pipeline", new=AsyncMock()):
                await adapter.run(context=MagicMock(), flow_manager=MagicMock())
        # Should complete without raising

    @pytest.mark.asyncio
    async def test_shutdown_is_idempotent(self):
        """Calling _shutdown multiple times should not raise."""
        from twilio_transport import TwilioMediaStreamAdapter
        ws = MockWebSocket([])
        adapter = TwilioMediaStreamAdapter(ws, "CA_test")
        await adapter._shutdown()
        await adapter._shutdown()

    @pytest.mark.asyncio
    async def test_pipeline_start_fails_on_missing_credentials(self):
        """Missing Azure credentials should not crash the adapter."""
        from twilio_transport import TwilioMediaStreamAdapter, PIPECAT_AVAILABLE

        if not PIPECAT_AVAILABLE:
            pytest.skip("Pipecat not installed")

        ws = MockWebSocket([])
        adapter = TwilioMediaStreamAdapter(ws, "CA_test")
        mock_context = MagicMock()

        with patch("twilio_transport.settings") as mock_settings:
            mock_settings.azure_speech_key = ""
            mock_settings.azure_openai_key = ""
            mock_settings.agent_type = "conversational"
            await adapter._start_pipecat_pipeline(mock_context, MagicMock())

        # Pipeline task should remain None after config error
        assert adapter._pipeline_task is None

    @pytest.mark.asyncio
    async def test_cleanup_after_disconnect(self):
        """After WebSocket disconnect, pipeline task should be cleaned up."""
        from twilio_transport import TwilioMediaStreamAdapter

        # Only connected + stop (triggers disconnect)
        messages = [
            json.dumps({"event": "connected"}),
            json.dumps({"event": "stop"}),
        ]
        ws = MockWebSocket(messages)
        adapter = TwilioMediaStreamAdapter(ws, "CA_test")

        with patch("twilio_transport.PIPECAT_AVAILABLE", True):
            with patch.object(adapter, "_start_pipecat_pipeline", new=AsyncMock()):
                await adapter.run(context=MagicMock(), flow_manager=MagicMock())

        assert adapter._pipeline_task is None
        assert adapter._runner_task is None


def _fresh_streaming_server(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_test")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "auth_test")
    monkeypatch.setenv("TWILIO_PHONE_NUMBER", "+15551230001")
    monkeypatch.setenv("AZURE_SPEECH_KEY", "speech_test")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastus2")
    monkeypatch.setenv("AZURE_OPENAI_KEY", "openai_test")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com")
    monkeypatch.setenv("VOICE_AGENT_TYPE", "conversational")
    monkeypatch.setenv("USE_STREAMING", "true")
    monkeypatch.setenv("CORE_API_BASE_URL", "http://localhost:3001")

    for module_name in ["server", "config"]:
        sys.modules.pop(module_name, None)

    server = importlib.import_module("server")
    server.context_manager._contexts.clear()
    server.context_manager._call_id_to_sid.clear()
    return server


class TestStreamingServerEndpoint:
    @pytest.mark.integration
    def test_media_websocket_invokes_adapter(self, monkeypatch):
        server = _fresh_streaming_server(monkeypatch)
        server.context_manager.create_context(call_sid="CA_stream", business_id="business-1")

        with patch.object(server, "TwilioMediaStreamAdapter") as adapter_cls:
            adapter_instance = MagicMock()
            adapter_instance.run = AsyncMock(return_value=None)
            adapter_cls.return_value = adapter_instance

            with TestClient(server.app) as client:
                with client.websocket_connect("/media/CA_stream") as websocket:
                    websocket.close()

            adapter_cls.assert_called_once()
            adapter_instance.run.assert_awaited_once()
            run_kwargs = adapter_instance.run.await_args.kwargs
            assert run_kwargs["context"].call_sid == "CA_stream"
            assert run_kwargs["flow_manager"] is not None
