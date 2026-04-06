import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
TESTS_ROOT = pathlib.Path(__file__).resolve().parent
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))
if str(TESTS_ROOT) not in sys.path:
    sys.path.insert(0, str(TESTS_ROOT))

import llm_safety  # noqa: E402
from llm_safety import assess_safety_llm  # noqa: E402
from service import VoiceRuntimeV2  # noqa: E402
from test_service import FakeCoreApiClient  # noqa: E402


def _patch_llm_settings():
    mock_settings = MagicMock()
    mock_settings.voice_llm_safety = True
    mock_settings.debug = False
    mock_settings.active_llm_provider = MagicMock(return_value="openai")
    return patch.object(llm_safety, "settings", mock_settings)


class LlmSafetyTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        super().setUp()
        self._p_redis_url = patch("service.settings.redis_url", "")
        self._p_legacy_sync = patch("service.settings.voice_runtime_legacy_call_sync", False)
        self._p_service_info = patch("service.logger.info")
        self._p_redis_url.start()
        self._p_legacy_sync.start()
        self._p_service_info.start()

    def tearDown(self):
        self._p_service_info.stop()
        self._p_legacy_sync.stop()
        self._p_redis_url.stop()
        super().tearDown()

    async def _create_session(self):
        runtime = VoiceRuntimeV2(api_client=FakeCoreApiClient())
        self.addAsyncCleanup(runtime.close)
        return await runtime.start_session("CA_llm_safety", "+15550001111", "+15551230001")

    async def test_plain_symptom_statement_does_not_trigger_urgent_handoff(self):
        with _patch_llm_settings(), patch(
            "llm_safety.chat_json_completion",
            new=AsyncMock(
                return_value={
                    "level": "urgent_handoff",
                    "category": "symptom_interpretation",
                    "confidence": 0.94,
                }
            ),
        ):
            session = await self._create_session()
            result = await assess_safety_llm(session, "My back is hurting.")

        self.assertIsNone(result)

    async def test_symptom_context_with_scheduling_request_does_not_trigger_urgent_handoff(self):
        with _patch_llm_settings(), patch(
            "llm_safety.chat_json_completion",
            new=AsyncMock(
                return_value={
                    "level": "urgent_handoff",
                    "category": "symptom_interpretation",
                    "confidence": 0.94,
                }
            ),
        ):
            session = await self._create_session()
            result = await assess_safety_llm(
                session,
                "My back is paining and I need to schedule an appointment for next week, Thursday.",
            )

        self.assertIsNone(result)

    async def test_advice_seeking_symptom_question_still_triggers_urgent_handoff(self):
        with _patch_llm_settings(), patch(
            "llm_safety.chat_json_completion",
            new=AsyncMock(
                return_value={
                    "level": "urgent_handoff",
                    "category": "symptom_interpretation",
                    "confidence": 0.94,
                }
            ),
        ):
            session = await self._create_session()
            result = await assess_safety_llm(
                session,
                "What should I do about this back pain, and is this symptom serious?",
            )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.safetyAssessment.category, "symptom_interpretation")
        self.assertEqual(result.safetyAssessment.severity, "urgent_handoff")


if __name__ == "__main__":
    unittest.main()
