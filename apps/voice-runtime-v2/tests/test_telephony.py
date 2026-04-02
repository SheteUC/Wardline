import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from telephony import TwilioMediaSession  # noqa: E402


class FakeWebSocket:
    def __init__(self, messages=None, runtime_error=None):
        self.query_params = {"sessionId": "session-1", "callSid": "CA123"}
        self.sent = []
        self.closed = False
        self._messages = list(messages or [])
        self._runtime_error = runtime_error

    async def accept(self):
        return None

    async def receive_text(self):
        if self._messages:
            return self._messages.pop(0)
        if self._runtime_error is not None:
            raise self._runtime_error
        raise RuntimeError('WebSocket is not connected. Need to call "accept" first.')

    async def send_json(self, payload):
        self.sent.append(payload)

    async def close(self, *args, **kwargs):
        self.closed = True


class TwilioMediaSessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_start_event_records_transport_and_plays_greeting(self):
        websocket = FakeWebSocket()
        runtime = Mock()
        runtime.authorize_twilio_media_and_sync_transport = AsyncMock(
            return_value=("Hello there", "msg-1")
        )
        runtime.persist_transport_event = AsyncMock()
        runtime.deepgram = Mock()
        runtime.deepgram.validate = Mock(return_value={"configured": True})

        media_session = TwilioMediaSession(websocket, runtime)

        with patch.object(media_session, "_ensure_deepgram_socket", AsyncMock()), patch.object(
            media_session,
            "_speak",
            AsyncMock(),
        ) as speak_mock:
            await media_session._handle_payload(
                {
                    "event": "start",
                    "start": {
                        "callSid": "CA123",
                        "streamSid": "MZ123",
                        "customParameters": {"sessionId": "session-1", "streamToken": "stream-token-test"},
                    },
                }
            )

        runtime.authorize_twilio_media_and_sync_transport.assert_awaited_once_with(
            "session-1",
            stream_token="stream-token-test",
            provider_session_id="MZ123",
            twilio_stream_sid="MZ123",
        )
        runtime.persist_transport_event.assert_awaited()
        speak_mock.assert_awaited_once_with(
            "Hello there",
            assistant_message_id="msg-1",
            mark_name_prefix="greeting",
        )

    async def test_mark_event_is_correlated_to_assistant_message(self):
        websocket = FakeWebSocket()
        runtime = Mock()
        runtime.persist_transport_event = AsyncMock()

        media_session = TwilioMediaSession(websocket, runtime)
        media_session.session_id = "session-1"
        media_session.stream_sid = "MZ123"
        media_session._assistant_playback_ready.clear()
        media_session._mark_to_assistant_message["assistant-reply-1"] = "msg-1"

        await media_session._handle_payload(
            {"event": "mark", "mark": {"name": "assistant-reply-1"}}
        )

        self.assertTrue(media_session._assistant_playback_ready.is_set())
        runtime.persist_transport_event.assert_awaited_once_with(
            "session-1",
            "twilio_mark",
            {
                "twilioStreamSid": "MZ123",
                "name": "assistant-reply-1",
                "assistantMessageId": "msg-1",
            },
        )

    async def test_run_treats_not_connected_runtime_error_as_clean_disconnect(self):
        websocket = FakeWebSocket(
            runtime_error=RuntimeError('WebSocket is not connected. Need to call "accept" first.')
        )
        runtime = Mock()
        runtime.persist_transport_event = AsyncMock()
        runtime.finalize_session = AsyncMock()

        media_session = TwilioMediaSession(websocket, runtime)
        media_session.session_id = "session-1"
        media_session.stream_sid = "MZ123"

        await media_session.run()

        runtime.persist_transport_event.assert_awaited_once_with(
            "session-1",
            "twilio_stream_disconnected",
            {"twilioStreamSid": "MZ123", "reason": "not_connected"},
        )
        runtime.finalize_session.assert_awaited_once_with("session-1", failure_reason=None)

    async def test_stop_event_closes_stream_without_follow_on_receive_error(self):
        websocket = FakeWebSocket()
        runtime = Mock()
        runtime.persist_transport_event = AsyncMock()

        media_session = TwilioMediaSession(websocket, runtime)
        media_session.session_id = "session-1"
        media_session.stream_sid = "MZ123"

        should_continue = await media_session._handle_payload({"event": "stop"})

        self.assertFalse(should_continue)
        self.assertTrue(websocket.closed)
        self.assertTrue(media_session._closed)
        runtime.persist_transport_event.assert_awaited_once_with(
            "session-1",
            "twilio_stream_stopped",
            {"twilioStreamSid": "MZ123"},
        )


if __name__ == "__main__":
    unittest.main()
