import os
import pathlib
import sys
import unittest
from unittest.mock import patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from config import Settings  # noqa: E402


class VoiceRuntimeV2ConfigTests(unittest.TestCase):
    def test_timeout_related_settings_can_be_overridden_from_env(self):
        with patch.dict(
            os.environ,
            {
                "VOICE_SESSION_LOCK_TIMEOUT_SECONDS": "180",
                "VOICE_CORE_API_TIMEOUT_SECONDS": "12",
                "VOICE_PROVIDER_HTTP_TIMEOUT_SECONDS": "25",
                "VOICE_READINESS_TIMEOUT_SECONDS": "4",
                "VOICE_UTTERANCE_SETTLE_SECONDS": "1.25",
            },
            clear=False,
        ):
            settings = Settings()

        self.assertEqual(settings.voice_session_lock_timeout_seconds, 180.0)
        self.assertEqual(settings.voice_core_api_timeout_seconds, 12.0)
        self.assertEqual(settings.voice_provider_http_timeout_seconds, 25.0)
        self.assertEqual(settings.voice_readiness_timeout_seconds, 4.0)
        self.assertEqual(settings.voice_utterance_settle_seconds, 1.25)


if __name__ == "__main__":
    unittest.main()
