import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import llm_slots  # noqa: E402
from llm_slots import (  # noqa: E402
    extract_slots_llm,
    merge_slots_conservative,
    sanitize_slot_dict,
    should_run_slot_extract,
)
from models import SessionState, SessionTransportMetadata  # noqa: E402
from test_service import build_voice_policy  # noqa: E402


def _minimal_session(**kwargs) -> SessionState:
    from models import BusinessProfile, CallBootstrapResponse, VoicePolicyV2

    policy = VoicePolicyV2.model_validate(build_voice_policy())
    bootstrap = CallBootstrapResponse(
        callId="call-x",
        business=BusinessProfile(
            id="b1",
            name="Test Clinic",
            slug="test",
            timeZone="America/New_York",
            status="ACTIVE",
        ),
        settings={"operatingHours": []},
        voicePolicyV2=policy,
    )
    transport = SessionTransportMetadata(
        sessionId="s1",
        businessId="b1",
        roomName="r1",
        participantIdentity="p1",
        twilioMediaStreamUrl="wss://x/ws",
    )
    return SessionState(
        sessionId="s1",
        callSid="CA1",
        callId="call-x",
        businessId="b1",
        callerPhone="+15550001111",
        calledPhone="+15551230001",
        businessName="Test Clinic",
        runtimeConfig=bootstrap,
        transport=transport,
        **kwargs,
    )


class LlmSlotsUnitTests(unittest.TestCase):
    def test_sanitize_filters_unknown_keys_and_coerces_inquiry_type(self):
        raw = {
            "carrierName": " Aetna ",
            "inquiryType": "eligibility",
            "bogus": "x",
            "memberId": "ABC123",
        }
        out = sanitize_slot_dict("insurance", raw)
        self.assertEqual(out.get("carrierName"), "Aetna")
        self.assertEqual(out.get("inquiryType"), "eligibility")
        self.assertEqual(out.get("memberId"), "ABC123")
        self.assertNotIn("bogus", out)

    def test_merge_only_fills_empty_slots(self):
        session = _minimal_session()
        session.slotState["refill"] = {"medicationName": "lisinopril", "callerDob": ""}
        merge_slots_conservative(
            session,
            "refill",
            {"callerDob": "1990-05-01", "medicationName": "metformin", "pharmacyName": "CVS"},
        )
        self.assertEqual(session.slotState["refill"]["medicationName"], "lisinopril")
        self.assertEqual(session.slotState["refill"]["callerDob"], "1990-05-01")
        self.assertEqual(session.slotState["refill"]["pharmacyName"], "CVS")

    def test_should_run_skips_trivial_yes_without_missing_slots(self):
        session = _minimal_session(missingSlots=[])
        mock_s = MagicMock()
        mock_s.voice_llm_slots = True
        mock_s.active_llm_provider = MagicMock(return_value="openai")
        with patch.object(llm_slots, "settings", mock_s):
            self.assertFalse(should_run_slot_extract(session, "scheduling", "yes"))
            self.assertTrue(should_run_slot_extract(session, "scheduling", "Tuesday afternoon works"))

    def test_should_run_true_when_missing_slots_even_if_short_reply(self):
        session = _minimal_session(missingSlots=["pharmacyPhone"])
        mock_s = MagicMock()
        mock_s.voice_llm_slots = True
        mock_s.active_llm_provider = MagicMock(return_value="openai")
        with patch.object(llm_slots, "settings", mock_s):
            self.assertTrue(should_run_slot_extract(session, "refill", "ok"))


class LlmSlotsExtractTests(unittest.IsolatedAsyncioTestCase):
    async def test_extract_merges_from_mock_completion(self):
        session = _minimal_session()
        session.messages = []
        mock_settings = MagicMock()
        mock_settings.voice_llm_slots = True
        mock_settings.active_llm_provider = MagicMock(return_value="openai")

        completion = {
            "slots": {"medicationName": "atorvastatin", "pharmacyName": "Walgreens"},
            "confidence": 0.95,
        }
        with patch.object(llm_slots, "settings", mock_settings), patch(
            "llm_slots.chat_json_completion",
            new=AsyncMock(return_value=completion),
        ):
            out = await extract_slots_llm(session, "refill", "I need a refill for atorvastatin at Walgreens")

        self.assertEqual(out.get("medicationName"), "atorvastatin")
        self.assertEqual(out.get("pharmacyName"), "Walgreens")

    async def test_low_confidence_returns_empty(self):
        session = _minimal_session()
        mock_settings = MagicMock()
        mock_settings.voice_llm_slots = True
        mock_settings.active_llm_provider = MagicMock(return_value="openai")

        with patch.object(llm_slots, "settings", mock_settings), patch(
            "llm_slots.chat_json_completion",
            new=AsyncMock(return_value={"slots": {"billingTopic": "x"}, "confidence": 0.1}),
        ):
            out = await extract_slots_llm(session, "billing", "something vague")

        self.assertEqual(out, {})


if __name__ == "__main__":
    unittest.main()
