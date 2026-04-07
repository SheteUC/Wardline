"""Tests for llm_agents: LLM-powered specialist agents with caller context."""
import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import llm_agents  # noqa: E402
from llm_agents import (
    _build_agent_payload,
    _caller_context_block,
    _parse_agent_response,
    run_llm_agent,
)
from models import (
    CallerContext,
    KnownInsurance,
    RecentCallSummary,
    SessionState,
)


def _minimal_session(*, caller_context=None, domain="scheduling", slot_state=None) -> SessionState:
    from models import (
        AfterHoursPolicy,
        BusinessProfile,
        DaytimeHandoffPolicy,
        EscalationConfig,
        KnowledgeConfig,
        RuntimeConfigBootstrap,
        SafetyPolicy,
        ServicePolicy,
        SessionTransportMetadata,
        VoicePolicyV2,
    )

    business = BusinessProfile(id="biz-1", name="Test Practice", slug="test-practice", timeZone="UTC", status="ACTIVE")
    voice = VoicePolicyV2(
        afterHoursPolicy=AfterHoursPolicy(mode="voicemail", greeting="Closed.", sendUrgentToVoicemail=True),
        daytimeHandoffPolicy=DaytimeHandoffPolicy(),
        knowledgeConfig=KnowledgeConfig(),
        servicePolicies={
            "scheduling": ServicePolicy(enabled=True, runtimeAction="appointment-request", integrationCategory="SCHEDULING"),
            "refill": ServicePolicy(enabled=True, runtimeAction="refill-request", integrationCategory="EHR_REFILL"),
            "insurance": ServicePolicy(enabled=True, runtimeAction="insurance-check", integrationCategory="INSURANCE"),
            "billing": ServicePolicy(enabled=True, runtimeAction="billing-request", integrationCategory="BILLING"),
            "handoff": ServicePolicy(enabled=True, runtimeAction="manual-follow-up", integrationCategory="MANUAL"),
        },
        escalationConfig=EscalationConfig(),
        safetyPolicy=SafetyPolicy(),
        enabledDomains=["safety", "knowledge", "scheduling", "refill", "insurance", "billing", "handoff"],
    )
    runtime_config = RuntimeConfigBootstrap(
        business=business,
        settings={"operatingHours": []},
        voicePolicyV2=voice,
    )
    transport = SessionTransportMetadata(
        sessionId="sess-test",
        businessId="biz-1",
        roomName="room-test",
        participantIdentity="test-participant",
    )
    return SessionState(
        sessionId="sess-test",
        callSid="CA_test",
        businessId="biz-1",
        callerPhone="+15550001111",
        calledPhone="+15551230001",
        businessName="Test Practice",
        runtimeConfig=runtime_config,
        transport=transport,
        callerContext=caller_context,
        activeDomain=domain,
        slotState=slot_state or {},
    )


class CallerContextBlockTests(unittest.TestCase):
    def test_no_context(self):
        result = _caller_context_block(None)
        self.assertIn("No prior", result)

    def test_with_full_context(self):
        ctx = CallerContext(
            callerId="c1",
            callerName="Jane Doe",
            callerDob="1990-05-15",
            knownInsurance=KnownInsurance(carrierName="Aetna", planName="PPO"),
            knownMedications=["Lisinopril", "Metformin"],
            recentCalls=[
                RecentCallSummary(id="call-1", domain="scheduling", status="COMPLETED", startedAt="2026-03-01"),
            ],
        )
        block = _caller_context_block(ctx)
        self.assertIn("Jane Doe", block)
        self.assertIn("1990-05-15", block)
        self.assertIn("Aetna", block)
        self.assertIn("Lisinopril", block)
        self.assertIn("scheduling", block)


class BuildPayloadTests(unittest.TestCase):
    def test_payload_includes_caller_context(self):
        ctx = CallerContext(callerName="John", knownMedications=["Aspirin"])
        session = _minimal_session(caller_context=ctx)
        import json
        payload = json.loads(_build_agent_payload(session, "refill", "I need a refill"))
        self.assertIn("caller_context", payload)
        self.assertIn("John", payload["caller_context"])
        self.assertIn("Aspirin", payload["caller_context"])


class ParseResponseTests(unittest.TestCase):
    def test_parse_valid_scheduling(self):
        session = _minimal_session()
        data = {
            "status": "needs_information",
            "next_prompt": "What kind of appointment do you need?",
            "slots": {"requestType": "schedule"},
            "missing_fields": ["visitType", "preferredDate", "preferredTime"],
            "confidence": 0.9,
            "operator_headline": "Scheduling intake",
            "operator_next_step": "Continue collecting details.",
        }
        result = _parse_agent_response(data, "scheduling", session, "I need an appointment")
        self.assertIsNotNone(result)
        self.assertEqual(result.status, "needs_information")
        self.assertEqual(result.domain, "scheduling")
        self.assertIn("visitType", result.missingFields)
        self.assertEqual(result.extractedFields.get("requestType"), "schedule")

    def test_parse_invalid_status_returns_none(self):
        session = _minimal_session()
        data = {"status": "bogus", "next_prompt": "hi", "confidence": 0.9}
        result = _parse_agent_response(data, "scheduling", session, "test")
        self.assertIsNone(result)

    def test_parse_low_confidence_still_returns(self):
        session = _minimal_session()
        data = {
            "status": "clarify",
            "next_prompt": "Could you repeat that?",
            "slots": {},
            "confidence": 0.4,
            "operator_headline": "Clarify",
            "operator_next_step": "Wait for caller.",
        }
        result = _parse_agent_response(data, "scheduling", session, "mumble")
        self.assertIsNotNone(result)
        self.assertEqual(result.confidence, 0.4)

    def test_ready_for_confirmation_includes_runtime_action(self):
        session = _minimal_session()
        data = {
            "status": "ready_for_confirmation",
            "next_prompt": "Should I submit?",
            "slots": {"visitType": "physical", "preferredDate": "Monday", "preferredTime": "3pm"},
            "missing_fields": [],
            "confidence": 0.95,
            "confirmation_summary": "Physical on Monday at 3pm",
            "operator_headline": "Ready",
            "operator_next_step": "Submit after confirmation.",
        }
        result = _parse_agent_response(data, "scheduling", session, "physical Monday 3pm")
        self.assertIsNotNone(result)
        self.assertEqual(result.runtimeAction, "appointment-request")
        self.assertEqual(result.confirmationSummary, "Physical on Monday at 3pm")
        self.assertEqual(
            result.runtimePayload,
            {
                "callerName": "Caller",
                "callerPhone": "+15550001111",
                "serviceType": "physical",
                "preferredDate": "Monday",
                "preferredTime": "3pm",
                "notes": "",
                "confirmed": True,
            },
        )


class RunLlmAgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_returns_specialist_result(self):
        mock_s = MagicMock()
        mock_s.voice_llm_agents = True
        mock_s.active_llm_provider = MagicMock(return_value="openai")

        llm_response = {
            "status": "needs_information",
            "next_prompt": "What medication?",
            "slots": {},
            "missing_fields": ["medicationName"],
            "confidence": 0.88,
            "operator_headline": "Refill intake",
            "operator_next_step": "Collect medication name.",
        }
        session = _minimal_session(domain="refill")
        with patch.object(llm_agents, "settings", mock_s), \
             patch("llm_agents.chat_json_completion", new=AsyncMock(return_value=llm_response)):
            result = await run_llm_agent(session, "refill", "I need a refill")
        self.assertIsNotNone(result)
        self.assertEqual(result.domain, "refill")
        self.assertEqual(result.status, "needs_information")

    async def test_disabled_returns_none(self):
        mock_s = MagicMock()
        mock_s.voice_llm_agents = False
        session = _minimal_session()
        with patch.object(llm_agents, "settings", mock_s):
            result = await run_llm_agent(session, "scheduling", "hi")
        self.assertIsNone(result)

    async def test_low_confidence_returns_none(self):
        mock_s = MagicMock()
        mock_s.voice_llm_agents = True
        mock_s.active_llm_provider = MagicMock(return_value="openai")

        llm_response = {
            "status": "clarify",
            "next_prompt": "hmm",
            "slots": {},
            "confidence": 0.2,
            "operator_headline": "low",
            "operator_next_step": "fallback",
        }
        session = _minimal_session()
        with patch.object(llm_agents, "settings", mock_s), \
             patch("llm_agents.chat_json_completion", new=AsyncMock(return_value=llm_response)):
            result = await run_llm_agent(session, "scheduling", "hmm")
        self.assertIsNone(result)

    async def test_multi_tenant_isolation(self):
        """Two concurrent sessions from different practices produce independent results."""
        mock_s = MagicMock()
        mock_s.voice_llm_agents = True
        mock_s.active_llm_provider = MagicMock(return_value="openai")

        session_a = _minimal_session(domain="scheduling")
        session_a.businessId = "practice-A"
        session_a.businessName = "Practice A"

        session_b = _minimal_session(domain="refill")
        session_b.businessId = "practice-B"
        session_b.businessName = "Practice B"

        call_payloads = []

        async def capture_payload(*, system_prompt, user_prompt, **kw):
            import json
            call_payloads.append(json.loads(user_prompt))
            return {
                "status": "needs_information",
                "next_prompt": "info please",
                "slots": {},
                "confidence": 0.85,
                "operator_headline": "intake",
                "operator_next_step": "continue",
            }

        with patch.object(llm_agents, "settings", mock_s), \
             patch("llm_agents.chat_json_completion", new=capture_payload):
            result_a = await run_llm_agent(session_a, "scheduling", "appointment please")
            result_b = await run_llm_agent(session_b, "refill", "refill my meds")

        self.assertIsNotNone(result_a)
        self.assertIsNotNone(result_b)
        self.assertEqual(result_a.domain, "scheduling")
        self.assertEqual(result_b.domain, "refill")

        self.assertEqual(len(call_payloads), 2)
        self.assertEqual(call_payloads[0]["business_name"], "Practice A")
        self.assertEqual(call_payloads[0]["domain"], "scheduling")
        self.assertEqual(call_payloads[1]["business_name"], "Practice B")
        self.assertEqual(call_payloads[1]["domain"], "refill")


if __name__ == "__main__":
    unittest.main()
