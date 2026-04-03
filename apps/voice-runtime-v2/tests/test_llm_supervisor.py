import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import llm_supervisor  # noqa: E402
from llm_supervisor import route_turn_llm  # noqa: E402
from service import VoiceRuntimeV2  # noqa: E402
from test_service import FakeCoreApiClient  # noqa: E402


def _patch_llm_settings():
    """Ensure routing tests do not depend on OPENAI_API_KEY / Azure env."""
    mock_settings = MagicMock()
    mock_settings.voice_llm_supervisor = True
    mock_settings.voice_llm_slots = True
    mock_settings.debug = False
    mock_settings.active_llm_provider = MagicMock(return_value="openai")
    return patch.object(llm_supervisor, "settings", mock_settings)

_BASE_LLM = {
    "mode": "delegate",
    "domain": "refill",
    "confidence": 0.92,
    "reason": "refill_request",
    "continuation": False,
    "fragment_text": None,
    "priority_required": False,
    "clarification_prompt": None,
    "knowledge_topic": None,
    "compound_knowledge_then_action": False,
    "knowledge_fragment": None,
    "follow_on_domain": None,
    "follow_on_text": None,
    "intents": [],
    "slot_enrichment": {"medicationName": "lisinopril"},
}


class LlmSupervisorTests(unittest.IsolatedAsyncioTestCase):
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

    async def test_route_turn_returns_decision_and_slot_hints(self):
        with _patch_llm_settings(), patch(
            "llm_supervisor.chat_json_completion",
            new=AsyncMock(return_value=dict(_BASE_LLM)),
        ):
            runtime = VoiceRuntimeV2(api_client=FakeCoreApiClient())
            self.addAsyncCleanup(runtime.close)
            session = await runtime.start_session("CA_llm", "+15550001111", "+15551230001")
            decision = await route_turn_llm(session, "I need my blood pressure medication refilled")

        self.assertIsNotNone(decision)
        assert decision is not None
        self.assertEqual(decision.domain, "refill")
        self.assertEqual(decision.mode, "delegate")
        self.assertEqual(decision.llmSlotEnrichment.get("medicationName"), "lisinopril")

    async def test_low_confidence_returns_none(self):
        payload = {**_BASE_LLM, "confidence": 0.05}
        with _patch_llm_settings(), patch(
            "llm_supervisor.chat_json_completion",
            new=AsyncMock(return_value=payload),
        ):
            runtime = VoiceRuntimeV2(api_client=FakeCoreApiClient())
            self.addAsyncCleanup(runtime.close)
            session = await runtime.start_session("CA_llm2", "+15550001111", "+15551230001")
            decision = await route_turn_llm(session, "unclear mumble")

        self.assertIsNone(decision)


if __name__ == "__main__":
    unittest.main()
