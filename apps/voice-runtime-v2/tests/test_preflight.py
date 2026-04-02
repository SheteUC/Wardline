import pathlib
import sys
import unittest
from unittest.mock import patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from config import settings  # noqa: E402
from preflight import build_real_call_preflight_report  # noqa: E402


class VoiceRuntimeV2PreflightTests(unittest.TestCase):
    def test_preflight_requires_secure_callback_url(self):
        with patch.object(settings, "twilio_skip_signature_validation", True), patch.object(
            settings, "webhook_base_url", "http://voice.example.com"
        ), patch.object(
            settings, "twilio_account_sid", "AC123"
        ), patch.object(settings, "twilio_auth_token", "secret"), patch.object(
            settings, "twilio_phone_number", "+15551230001"
        ), patch.object(settings, "livekit_url", "wss://livekit.example.com"), patch.object(
            settings, "livekit_api_key", "lk-key"
        ), patch.object(settings, "livekit_api_secret", "lk-secret"), patch.object(
            settings, "deepgram_api_key", "dg-key"
        ):
            report = build_real_call_preflight_report()

        self.assertFalse(report["ok"])
        self.assertIn(
            "VOICE_RUNTIME_V2_PUBLIC_URL or WEBHOOK_BASE_URL must be an https:// URL.",
            report["errors"],
        )

    def test_preflight_rejects_mismatched_public_urls(self):
        with patch.object(settings, "twilio_skip_signature_validation", True), patch.object(
            settings, "webhook_base_url", "https://voice.example.com"
        ), patch.object(
            settings, "twilio_account_sid", "AC123"
        ), patch.object(settings, "twilio_auth_token", "secret"), patch.object(
            settings, "twilio_phone_number", "+15551230001"
        ), patch.object(settings, "livekit_url", "wss://livekit.example.com"), patch.object(
            settings, "livekit_api_key", "lk-key"
        ), patch.object(settings, "livekit_api_secret", "lk-secret"), patch.object(
            settings, "deepgram_api_key", "dg-key"
        ), patch.dict(
            "os.environ",
            {
                "VOICE_RUNTIME_V2_PUBLIC_URL": "https://voice.example.com",
                "WEBHOOK_BASE_URL": "https://different.example.com",
            },
            clear=False,
        ):
            report = build_real_call_preflight_report()

        self.assertFalse(report["ok"])
        self.assertIn(
            "VOICE_RUNTIME_V2_PUBLIC_URL and WEBHOOK_BASE_URL must match for the first real-call proof.",
            report["errors"],
        )

    def test_preflight_returns_wss_media_url_when_configured(self):
        with patch.object(settings, "twilio_webhook_public_url", "https://voice.example.com"), patch.object(
            settings, "webhook_base_url", "https://voice.example.com"
        ), patch.object(settings, "twilio_account_sid", "AC123"), patch.object(
            settings, "twilio_auth_token", "secret"
        ), patch.object(
            settings, "twilio_phone_number", "+15551230001"
        ), patch.object(settings, "livekit_url", "wss://livekit.example.com"), patch.object(
            settings, "livekit_api_key", "lk-key"
        ), patch.object(settings, "livekit_api_secret", "lk-secret"), patch.object(
            settings, "deepgram_api_key", "dg-key"
        ), patch.object(settings, "twilio_media_stream_path", "/telephony/twilio/media"), patch.object(
            settings, "managed_tts_provider", "deepgram"
        ):
            report = build_real_call_preflight_report()

        self.assertTrue(report["ok"])
        self.assertEqual(report["bootstrapUrl"], "https://voice.example.com/telephony/twilio/bootstrap")
        self.assertEqual(report["twilioMediaStreamUrl"], "wss://voice.example.com/telephony/twilio/media")

    def test_preflight_accepts_render_external_url_fallback(self):
        with patch.object(
            settings,
            "twilio_webhook_public_url",
            "https://wardline-voice-runtime-v2.onrender.com",
        ), patch.object(settings, "webhook_base_url", ""), patch.object(
            settings, "render_external_url", "https://wardline-voice-runtime-v2.onrender.com"
        ), patch.object(settings, "twilio_account_sid", "AC123"), patch.object(
            settings, "twilio_auth_token", "secret"
        ), patch.object(settings, "twilio_phone_number", "+15551230001"), patch.object(
            settings, "livekit_url", "wss://livekit.example.com"
        ), patch.object(settings, "livekit_api_key", "lk-key"), patch.object(
            settings, "livekit_api_secret", "lk-secret"
        ), patch.object(settings, "deepgram_api_key", "dg-key"), patch.object(
            settings, "twilio_media_stream_path", "/telephony/twilio/media"
        ), patch.object(settings, "managed_tts_provider", "deepgram"), patch.dict(
            "os.environ",
            {
                "RENDER_EXTERNAL_URL": "https://wardline-voice-runtime-v2.onrender.com",
                "VOICE_RUNTIME_V2_PUBLIC_URL": "",
                "WEBHOOK_BASE_URL": "",
            },
            clear=False,
        ):
            report = build_real_call_preflight_report()

        self.assertTrue(report["ok"])
        self.assertEqual(report["callbackUrl"], "https://wardline-voice-runtime-v2.onrender.com")
        self.assertIn("Using RENDER_EXTERNAL_URL as the runtime public URL.", report["notes"][0])


if __name__ == "__main__":
    unittest.main()
