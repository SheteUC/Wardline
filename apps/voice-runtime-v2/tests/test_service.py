import asyncio
import pathlib
import sys
import unittest

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from service import VoiceRuntimeV2  # noqa: E402


class FakeCoreApiClient:
    def __init__(self):
        self.runtime_action_calls = []
        self.updated_calls = []
        self.created_voicemails = []

    async def close(self):
        return None

    async def get_business_by_phone(self, _phone_number: str):
        return {"id": "business-1"}

    async def get_runtime_config(self, _business_id: str):
        return {
            "business": {
                "id": "business-1",
                "name": "Wardline Family Medicine",
                "slug": "wardline-family-medicine",
                "timeZone": "America/New_York",
                "status": "ACTIVE",
            },
            "settings": {
                "operatingHours": [
                    {"dayOfWeek": 0, "isClosed": True, "startTime": None, "endTime": None},
                    {"dayOfWeek": 1, "isClosed": False, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 2, "isClosed": False, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 3, "isClosed": False, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 4, "isClosed": False, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 5, "isClosed": False, "startTime": "09:00", "endTime": "17:00"},
                    {"dayOfWeek": 6, "isClosed": True, "startTime": None, "endTime": None},
                ],
            },
            "voicePolicyV2": {
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
                    "commonQuestions": ["Hours", "Insurance"],
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
            },
            "connectedIntegrationCategories": ["SCHEDULING", "EHR_REFILL", "INSURANCE", "BILLING"],
        }

    async def create_call_session(self, _payload):
        return {"id": "call-1"}

    async def update_call_session(self, _call_id, payload):
        self.updated_calls.append(payload)
        return payload

    async def create_voicemail(self, call_id, payload):
        self.created_voicemails.append((call_id, payload))
        return {"ok": True}

    async def execute_runtime_action(self, business_id, action_name, payload):
        self.runtime_action_calls.append((business_id, action_name, payload))
        return (
            {
                "handledLive": action_name != "manual-follow-up",
                "message": f"{action_name} completed",
                "followUpTaskId": "task-1" if action_name == "manual-follow-up" else None,
            },
            42.0,
        )


class VoiceRuntimeV2Tests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.api_client = FakeCoreApiClient()
        self.runtime = VoiceRuntimeV2(api_client=self.api_client)
        self.session = await self.runtime.start_session("CA_test", "+15550000001", "+15551230001")

    async def test_emergency_interrupts_and_creates_follow_up(self):
        response = await self.runtime.process_text_turn(self.session.sessionId, "I have chest pain and can't breathe")

        self.assertIn("Please call 911", response["reply"])
        self.assertEqual(self.api_client.runtime_action_calls[0][1], "manual-follow-up")

    async def test_scheduling_flow_requires_confirmation_then_executes(self):
        response = await self.runtime.process_text_turn(self.session.sessionId, "I need to schedule a physical")
        self.assertTrue(response["requiresConfirmation"])
        self.assertEqual(response["pendingAction"]["actionName"], "appointment-request")

        confirmed = await self.runtime.process_text_turn(self.session.sessionId, "yes")
        self.assertIn("appointment-request completed", confirmed["reply"])
        self.assertEqual(self.api_client.runtime_action_calls[-1][1], "appointment-request")

    async def test_refill_flow_collects_missing_medication(self):
        response = await self.runtime.process_text_turn(self.session.sessionId, "I need a refill")
        self.assertIn("What medication", response["reply"])

        next_response = await self.runtime.process_text_turn(self.session.sessionId, "It's for lisinopril")
        self.assertTrue(next_response["requiresConfirmation"])
        self.assertEqual(next_response["pendingAction"]["actionName"], "refill-request")

    async def test_session_bootstrap_includes_transport_metadata(self):
        self.assertEqual(self.session.transport.transport, "livekit")
        self.assertEqual(self.session.transport.sessionId, self.session.sessionId)
        self.assertTrue(self.session.transport.roomName.startswith("wardline-"))

    async def test_partial_transcript_is_recorded_without_triggering_reasoning(self):
        response = await self.runtime.process_transcript_turn(
            self.session.sessionId,
            "partial utterance",
            final=False,
            provider_session_id="lk-session-1",
        )

        self.assertTrue(response["accepted"])
        self.assertFalse(response["final"])
        self.assertEqual(response["transport"]["providerSessionId"], "lk-session-1")
        self.assertEqual(len(self.api_client.runtime_action_calls), 0)


if __name__ == "__main__":
    unittest.main()
