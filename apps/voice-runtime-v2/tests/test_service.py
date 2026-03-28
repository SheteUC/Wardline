import asyncio
import pathlib
import sys
import unittest

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from service import VoiceRuntimeV2  # noqa: E402


def build_voice_policy():
    return {
        "version": "v2",
        "runtime": "internal-multi-agent",
        "speaker": "supervisor",
        "enabledDomains": ["safety", "knowledge", "scheduling", "refill", "insurance", "billing", "handoff"],
        "connectedCategories": ["SCHEDULING", "EHR_REFILL", "INSURANCE", "BILLING"],
        "writeActionsRequiringConfirmation": ["appointment-request", "refill-request", "billing-request"],
        "afterHoursPolicy": {
            "mode": "urgent_voicemail",
            "greeting": "After hours, leave a voicemail and the practice will call you back.",
            "sendUrgentToVoicemail": True,
        },
        "knowledgeConfig": {
            "faqSummary": "We help with appointments, refills, insurance, and billing.",
            "commonQuestions": ["hours", "insurance"],
        },
        "servicePolicies": {
            "scheduling": {
                "enabled": True,
                "runtimeAction": "appointment-request",
                "integrationCategory": "SCHEDULING",
                "liveEnabled": True,
                "intakeNotes": "Collect appointment type.",
                "fallbackSummary": "Create an appointment follow-up.",
            },
            "refill": {
                "enabled": True,
                "runtimeAction": "refill-request",
                "integrationCategory": "EHR_REFILL",
                "liveEnabled": True,
                "intakeNotes": "Collect medication name.",
                "fallbackSummary": "Create a refill follow-up.",
            },
            "insurance": {
                "enabled": True,
                "runtimeAction": "insurance-check",
                "integrationCategory": "INSURANCE",
                "liveEnabled": True,
                "intakeNotes": "Collect the carrier name.",
                "fallbackSummary": "Create an insurance follow-up.",
            },
            "billing": {
                "enabled": True,
                "runtimeAction": "billing-request",
                "integrationCategory": "BILLING",
                "liveEnabled": True,
                "intakeNotes": "Collect billing topic.",
                "fallbackSummary": "Create a billing follow-up.",
            },
        },
        "escalationConfig": {
            "urgentCallbackWindowMinutes": 30,
            "escalationMessage": "Escalate urgent requests.",
            "notifyStaffImmediately": True,
        },
        "emergencyKeywords": ["stroke"],
        "outOfScopeKeywords": [],
        "fallbackRuntimeAction": "manual-follow-up",
        "operatorSummaryEnabled": True,
    }


class FakeCoreApiClient:
    def __init__(self, *, after_hours: bool = False, action_outcomes=None, omit_voice_policy: bool = False):
        self.after_hours = after_hours
        self.action_outcomes = action_outcomes or {}
        self.omit_voice_policy = omit_voice_policy
        self.runtime_action_calls = []
        self.updated_calls = []
        self.created_voicemails = []
        self.saved_transcripts = []

    async def close(self):
        return None

    async def get_business_by_phone(self, _phone_number: str):
        return {"id": "business-1"}

    async def get_runtime_config(self, _business_id: str):
        payload = {
            "business": {
                "id": "business-1",
                "name": "Wardline Family Medicine",
                "slug": "wardline-family-medicine",
                "timeZone": "America/New_York",
                "status": "ACTIVE",
            },
            "settings": {
                "operatingHours": (
                    [{"dayOfWeek": day, "isClosed": True, "startTime": None, "endTime": None} for day in range(7)]
                    if self.after_hours
                    else [{"dayOfWeek": day, "isClosed": False, "startTime": "00:00", "endTime": "23:59"} for day in range(7)]
                ),
            },
            "connectedIntegrationCategories": ["SCHEDULING", "EHR_REFILL", "INSURANCE", "BILLING"],
        }
        if not self.omit_voice_policy:
            payload["voicePolicyV2"] = build_voice_policy()
        return payload

    async def create_call_session(self, _payload):
        return {"id": "call-1"}

    async def update_call_session(self, _call_id, payload):
        self.updated_calls.append(payload)
        return payload

    async def create_voicemail(self, call_id, payload):
        self.created_voicemails.append((call_id, payload))
        return {"ok": True}

    async def save_transcript(self, call_id, payload):
        self.saved_transcripts.append((call_id, payload))
        return {"success": True}

    async def execute_runtime_action(self, business_id, action_name, payload):
        self.runtime_action_calls.append((business_id, action_name, payload))
        configured = self.action_outcomes.get(action_name)
        if configured is None:
            configured = (
                {
                    "handledLive": False,
                    "fallbackCreated": True,
                    "requiresStaffFollowUp": True,
                    "message": "manual-follow-up completed",
                    "followUpTaskId": "task-manual",
                    "fallbackReason": "manual_follow_up",
                    "integration": {"category": "MANUAL", "vendor": "wardline", "status": "CONNECTED"},
                    "data": {},
                }
                if action_name == "manual-follow-up"
                else {
                    "handledLive": True,
                    "fallbackCreated": False,
                    "requiresStaffFollowUp": False,
                    "message": f"{action_name} completed",
                    "integration": {
                        "category": {
                            "appointment-request": "SCHEDULING",
                            "refill-request": "EHR_REFILL",
                            "insurance-check": "INSURANCE",
                            "billing-request": "BILLING",
                        }.get(action_name, "MANUAL"),
                        "vendor": "athenahealth",
                        "status": "CONNECTED",
                    },
                    "data": {},
                }
            )
        return configured, 42.0


class VoiceRuntimeV2Tests(unittest.IsolatedAsyncioTestCase):
    async def create_runtime(self, **client_kwargs):
        api_client = FakeCoreApiClient(**client_kwargs)
        runtime = VoiceRuntimeV2(api_client=api_client)
        session = await runtime.start_session("CA_test", "+15550000001", "+15551230001")
        return runtime, api_client, session

    async def test_missing_voice_policy_required(self):
        api_client = FakeCoreApiClient(omit_voice_policy=True)
        runtime = VoiceRuntimeV2(api_client=api_client)

        with self.assertRaisesRegex(ValueError, "voicePolicyV2"):
            await runtime.start_session("CA_test", "+15550000001", "+15551230001")

    async def test_session_bootstrap_includes_transport_metadata(self):
        runtime, _api_client, session = await self.create_runtime()

        self.assertEqual(session.transport.transport, "livekit")
        self.assertEqual(session.transport.sessionId, session.sessionId)
        self.assertTrue(session.transport.roomName.startswith("wardline-"))
        self.assertIn("/telephony/twilio/media", session.transport.twilioMediaStreamUrl)
        twiml = runtime.build_twilio_bootstrap_response(session.sessionId)
        self.assertIn("<Stream", twiml)
        self.assertIn(session.sessionId, twiml)

    async def test_partial_transcript_is_recorded_without_triggering_reasoning(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_transcript_turn(
            session.sessionId,
            "partial utterance",
            final=False,
            provider_session_id="lk-session-1",
        )

        self.assertTrue(response["accepted"])
        self.assertFalse(response["final"])
        self.assertEqual(response["transport"]["providerSessionId"], "lk-session-1")
        self.assertEqual(response["transport"]["deepgramRequestId"], "lk-session-1")
        self.assertEqual(len(api_client.runtime_action_calls), 0)

    async def test_unknown_intent_prompts_clarification(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I'm not sure where to start")

        self.assertIn("I can help with", response["reply"])
        self.assertEqual(response["domain"], "knowledge")
        self.assertFalse(response["requiresConfirmation"])

    async def test_emergency_interrupts_and_creates_follow_up(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I have chest pain and can't breathe")

        self.assertIn("Please call 911", response["reply"])
        self.assertEqual(api_client.runtime_action_calls[0][1], "manual-follow-up")
        self.assertEqual(response["operatorSummary"]["headline"], "Emergency language detected")

    async def test_after_hours_urgent_voicemail_sets_awaiting_voicemail(self):
        runtime, _api_client, session = await self.create_runtime(after_hours=True)

        response = await runtime.process_text_turn(session.sessionId, "I need an urgent callback about my medication")

        self.assertTrue(response["awaitingVoicemail"])
        self.assertEqual(response["stage"], "voicemail")
        self.assertIn("leave a message", response["reply"].lower())

    async def test_after_hours_standard_request_routes_to_voicemail(self):
        runtime, _api_client, session = await self.create_runtime(after_hours=True)

        response = await runtime.process_text_turn(session.sessionId, "I need to schedule an appointment")

        self.assertTrue(response["awaitingVoicemail"])
        self.assertEqual(response["domain"], "handoff")
        self.assertIn("business hours", response["reply"].lower())

    async def test_scheduling_flow_requires_confirmation_then_executes(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        self.assertTrue(response["requiresConfirmation"])
        self.assertEqual(response["pendingAction"]["actionName"], "appointment-request")

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertIn("appointment-request completed", confirmed["reply"])
        self.assertIn("What else can I help you with today?", confirmed["reply"])
        self.assertEqual(api_client.runtime_action_calls[-1][1], "appointment-request")
        self.assertTrue(confirmed["awaitingAnythingElse"])
        self.assertGreaterEqual(len(api_client.saved_transcripts), 3)

    async def test_confirmation_change_flow_returns_to_the_same_domain(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical")
        changed = await runtime.process_text_turn(session.sessionId, "Actually, make it a follow-up instead")

        self.assertFalse(changed["requiresConfirmation"])
        self.assertEqual(changed["domain"], "scheduling")
        self.assertIn("corrected details", changed["reply"])

    async def test_refill_flow_continues_across_turns(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I need a refill")
        self.assertIn("What medication", response["reply"])

        next_response = await runtime.process_text_turn(session.sessionId, "It's for lisinopril")
        self.assertTrue(next_response["requiresConfirmation"])
        self.assertEqual(next_response["pendingAction"]["actionName"], "refill-request")

    async def test_insurance_live_check_executes_without_confirmation(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "Can you check if you take Aetna?")

        self.assertFalse(response["requiresConfirmation"])
        self.assertEqual(api_client.runtime_action_calls[-1][1], "insurance-check")
        self.assertEqual(response["operatorSummary"]["headline"], "Insurance check ready")
        self.assertTrue(response["awaitingAnythingElse"])

    async def test_billing_fallback_records_operator_summary(self):
        runtime, _api_client, session = await self.create_runtime(
            action_outcomes={
                "billing-request": {
                    "handledLive": False,
                    "fallbackCreated": True,
                    "requiresStaffFollowUp": True,
                    "message": "We will have staff follow up about that billing issue.",
                    "followUpTaskId": "task-billing",
                    "fallbackReason": "timeout",
                    "integration": {"category": "BILLING", "vendor": "athenahealth", "status": "CONNECTED"},
                    "data": {},
                }
            }
        )

        response = await runtime.process_text_turn(session.sessionId, "I have a billing question about my statement")
        self.assertTrue(response["requiresConfirmation"])

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertEqual(confirmed["operatorSummary"]["fallbackReason"], "timeout")
        self.assertTrue(confirmed["operatorSummary"]["followUpRequired"])
        self.assertIn("staff follow up", confirmed["reply"].lower())

    async def test_anything_else_continuation_supports_second_domain(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical")
        await runtime.process_text_turn(session.sessionId, "yes")

        next_response = await runtime.process_text_turn(session.sessionId, "I also need a refill for lisinopril")

        self.assertEqual(next_response["domain"], "refill")
        self.assertTrue(next_response["requiresConfirmation"])
        self.assertEqual(next_response["pendingAction"]["actionName"], "refill-request")


if __name__ == "__main__":
    unittest.main()
