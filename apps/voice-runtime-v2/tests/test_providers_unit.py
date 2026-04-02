"""Unit tests for provider helpers (URLs, TwiML, Deepgram normalization)."""
from __future__ import annotations

import pathlib
import sys
import unittest
from unittest.mock import patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import config  # noqa: E402
from providers import (  # noqa: E402
    DeepgramSttAdapter,
    LiveKitTransportAdapter,
    TwilioTelephonyAdapter,
    build_public_websocket_url,
    public_callback_url_is_secure,
)


class ProvidersUnitTests(unittest.TestCase):
    def test_public_callback_url_is_secure(self):
        self.assertTrue(public_callback_url_is_secure("https://voice.example.com/path"))
        self.assertFalse(public_callback_url_is_secure("http://voice.example.com/path"))
        self.assertFalse(public_callback_url_is_secure(""))

    def test_build_public_websocket_url_https_to_wss(self):
        with patch.object(config.settings, "webhook_base_url", "https://api.example.com/"):
            url = build_public_websocket_url("/telephony/twilio/media")
            self.assertTrue(url.startswith("wss://"))
            self.assertIn("telephony/twilio/media", url)

    def test_livekit_build_room_name_sanitizes_ids(self):
        adapter = LiveKitTransportAdapter()
        name = adapter.build_room_name("My Biz!", "CAabc-123")
        self.assertTrue(name.startswith("wardline-my-biz-"))
        self.assertRegex(name, r"^wardline-[a-z0-9-]+$")

    def test_twilio_build_stream_twiml_escapes_values(self):
        adapter = TwilioTelephonyAdapter()
        twiml = adapter.build_stream_twiml(
            stream_url='wss://x.example.com/path?a=1&b=2"',
            parameters={"sessionId": '"><script>'},
        )
        self.assertIn("&amp;", twiml)
        self.assertNotIn("<script>", twiml)

    def test_twilio_dial_timeout_clamped(self):
        adapter = TwilioTelephonyAdapter()
        low = adapter.build_transfer_twiml(
            transfer_phone="+15550000001",
            action_url="https://example.com/cb",
            timeout_seconds=1,
        )
        self.assertIn('timeout="10"', low)
        high = adapter.build_transfer_twiml(
            transfer_phone="+15550000001",
            action_url="https://example.com/cb",
            timeout_seconds=99,
        )
        self.assertIn('timeout="45"', high)

    def test_deepgram_normalize_message(self):
        adapter = DeepgramSttAdapter()
        self.assertIsNone(adapter.normalize_message({}))
        self.assertIsNone(adapter.normalize_message("not-a-dict"))
        payload = {
            "channel": {"alternatives": [{"transcript": "  hello  ", "confidence": 0.9}]},
            "is_final": True,
            "metadata": {"request_id": "req-1"},
        }
        result = adapter.normalize_message(payload)
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.text, "hello")
        self.assertTrue(result.final)
        self.assertEqual(result.confidence, 0.9)
        self.assertEqual(result.provider_session_id, "req-1")


if __name__ == "__main__":
    unittest.main()
