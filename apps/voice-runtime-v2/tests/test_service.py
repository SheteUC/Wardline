import asyncio
import pathlib
import re
import sys
import unittest
from unittest.mock import AsyncMock, patch

import structlog

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import config  # noqa: E402
import service as service_module  # noqa: E402
from service import VoiceRuntimeV2  # noqa: E402


def _deep_merge(base, overrides):
    for key, value in (overrides or {}).items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def build_voice_policy(overrides=None):
    policy = {
        "version": "v2",
        "runtime": "internal-multi-agent",
        "speaker": "supervisor",
        "enabledDomains": ["safety", "knowledge", "scheduling", "refill", "insurance", "billing", "handoff"],
        "connectedCategories": ["SCHEDULING", "EHR_REFILL", "INSURANCE", "BILLING"],
        "writeActionsRequiringConfirmation": ["appointment-request", "refill-request", "billing-request"],
        "afterHoursPolicy": {
            "mode": "urgent_voicemail",
            "greeting": "The office is currently closed, but I can take a message for the staff.",
            "sendUrgentToVoicemail": True,
        },
        "daytimeHandoffPolicy": {
            "mode": "hybrid_transfer",
            "transferTargetLabel": "front desk",
            "transferPhone": "+15551239999",
            "ringTimeoutSeconds": 20,
            "collectReasonFirst": True,
            "fallbackSummary": "If nobody is available to take the call live, create a same-day callback task for staff.",
        },
        "knowledgeConfig": {
            "faqSummary": "We help with appointments, refills, insurance, and billing.",
            "commonQuestions": ["hours", "insurance"],
            "servicesSummary": "We help with appointments, refills, insurance questions, and billing support.",
            "appointmentSummary": "We can help request routine visits, follow-ups, annual physicals, and new patient appointments.",
            "refillSummary": "We can capture refill requests for the practice. Please have the medication name, date of birth, pharmacy name, and pharmacy phone ready.",
            "insuranceSummary": "We can answer basic insurance acceptance questions, but plan-specific coverage questions may still need staff follow-up.",
            "billingSummary": "We can capture billing questions about balances, statements, and payments for the practice staff to review.",
            "customFaqs": [
                {
                    "question": "Do you take walk-ins?",
                    "answer": "Walk-ins are limited, but I can help request the soonest available appointment.",
                    "routeTo": "scheduling",
                },
                {
                    "question": "How quickly will someone call me back after hours?",
                    "answer": "After-hours messages are reviewed on the next staffed shift, and urgent callbacks are prioritized.",
                    "routeTo": "handoff",
                },
            ],
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
                "intakeNotes": "Collect medication name, date of birth, pharmacy name, and pharmacy phone.",
                "fallbackSummary": "Create a refill follow-up.",
            },
            "insurance": {
                "enabled": True,
                "runtimeAction": "insurance-check",
                "integrationCategory": "INSURANCE",
                "liveEnabled": True,
                "intakeNotes": "Collect the carrier name. Acceptance and basic eligibility are supported live. Member ID and date of birth are required for eligibility checks. Benefits, claim status, and prior auth may require staff follow-up.",
                "fallbackSummary": "Create an insurance follow-up.",
            },
            "billing": {
                "enabled": True,
                "runtimeAction": "billing-request",
                "integrationCategory": "BILLING",
                "liveEnabled": True,
                "intakeNotes": "Collect billing topic and account reference.",
                "fallbackSummary": "Create a billing follow-up.",
            },
        },
        "escalationConfig": {
            "urgentCallbackWindowMinutes": 30,
            "escalationMessage": "Escalate urgent requests.",
            "notifyStaffImmediately": True,
        },
        "safetyPolicy": {
            "emergencyGroups": [
                {
                    "category": "medical_emergency",
                    "patterns": [
                        r"\b(?:chest\s+pain|heart\s+attack|cardiac\s+arrest|stroke)\b",
                        r"\b(?:can(?:not|'?t)\s+breathe|trouble\s+breathing|difficulty\s+breathing|shortness\s+of\s+breath|not\s+breathing)\b",
                        r"\b(?:unconscious|unresponsive|passed\s+out|fainted)\b",
                        r"\b(?:seizure|convulsion)\b",
                        r"\b(?:severe\s+bleeding|hemorrhage|blood\s+everywhere)\b",
                        r"\b(?:overdose|overdosed|poisoning|swallowed\s+pills|ingested\s+something)\b",
                        r"\b(?:allergic\s+reaction|anaphylaxis|throat\s+closing)\b",
                        r"\b(?:broken\s+bone|bone\s+sticking\s+out)\b",
                        r"\b(?:head\s+injury|head\s+trauma|hit\s+my\s+head\s+badly)\b",
                        r"\bstroke\b",
                    ],
                },
                {
                    "category": "mental_health_emergency",
                    "patterns": [
                        r"\b(?:suicidal|suicide|want\s+to\s+die|kill\s+myself|hurt\s+myself|harm\s+myself|self[\s-]?harm|mental\s+health\s+crisis)\b",
                    ],
                },
                {
                    "category": "violence_abuse_emergency",
                    "patterns": [
                        r"\b(?:domestic\s+violence|being\s+abused|abuse|unsafe\s+at\s+home|not\s+safe\s+at\s+home|someone\s+is\s+hurting\s+me|assaulted|attacked|sexual\s+assault|raped|child\s+abuse)\b",
                    ],
                },
            ],
            "urgentClinicalGroups": [
                {
                    "category": "clinical_results_or_diagnosis",
                    "patterns": [
                        r"\b(?:diagnosis|diagnose|what\s+do\s+i\s+have|what\s+do\s+these\s+results\s+mean|test\s+results|lab\s+results|blood\s+work\s+results|blood\s+test\s+results|is\s+this\s+normal|should\s+i\s+be\s+worried|treatment\s+plan)\b",
                    ],
                },
                {
                    "category": "medication_safety",
                    "patterns": [
                        r"\b(?:side\s+effects|adverse\s+reaction|drug\s+interaction|is\s+it\s+safe\s+to\s+take|dosage|dose|how\s+much\s+should\s+i\s+take)\b",
                        r"\bcan\s+i\s+take\b.+\bwith\b.+",
                    ],
                },
                {
                    "category": "symptom_interpretation",
                    "patterns": [
                        r"\b(?:what\s+should\s+i\s+do\s+about\s+these\s+symptoms|symptom\s+question|pain\s+level|is\s+this\s+symptom\s+serious|what\s+should\s+i\s+take\s+for\s+this)\b",
                    ],
                },
            ],
            "nonClinicalOutOfScopePatterns": [
                r"\blegal\s+advice\b",
                r"\bmalpractice\b",
                r"\bsue\b",
                r"\blawsuit\b",
            ],
            "historicalGuardPatterns": [
                r"\bhistory\s+of\b",
                r"\blast\s+year\b",
                r"\byears\s+ago\b",
                r"\bmonths\s+ago\b",
                r"\bfollow-up\s+after\b",
                r"\brecovering\s+from\b",
                r"\bfamily\s+history\s+of\b",
                r"\brecords\s+for\b",
                r"\bpaperwork\s+for\b",
            ],
            "acuteAmplifierPatterns": [
                r"\bright\s+now\b",
                r"\bcurrently\b",
                r"\bsudden\b",
                r"\bsevere\b",
                r"\bhelp\b",
                r"\bright\s+away\b",
                r"\bimmediately\b",
                r"\bambulance\b",
                r"\bcall\s+911\b",
            ],
        },
        "dialoguePolicies": {
            "safety": {
                "callerIntro": "",
                "clarificationStyle": "direct",
                "slotPrompts": {},
                "confirmationTemplate": "",
                "successTemplate": "",
                "fallbackTemplate": "",
                "closeTemplate": "Thanks for calling the practice. Take care.",
            },
            "knowledge": {
                "callerIntro": "",
                "clarificationStyle": "friendly",
                "slotPrompts": {},
                "confirmationTemplate": "",
                "successTemplate": "",
                "fallbackTemplate": "",
                "closeTemplate": "Thanks for calling. Have a good day.",
            },
            "scheduling": {
                "callerIntro": "",
                "clarificationStyle": "friendly",
                "slotPrompts": {
                    "visitType": "What kind of appointment do you need, like a physical, follow-up, or consultation?",
                    "preferredDate": "What day would you like that?",
                    "preferredTime": "What time works best for you?",
                },
                "confirmationTemplate": "I have a request for {visitPhrase}{datePhrase}{timePhrase}. Should I send that to the practice?",
                "successTemplate": "Okay, I sent that appointment request to the practice.",
                "fallbackTemplate": "Okay, I could not send that live, but I passed the appointment request to the practice.",
                "closeTemplate": "Thanks for calling the practice. Take care.",
            },
            "refill": {
                "callerIntro": "",
                "clarificationStyle": "friendly",
                "slotPrompts": {
                    "medicationName": "Which medication would you like refilled?",
                    "callerDob": "What is the caller's date of birth?",
                    "pharmacyName": "Which pharmacy should I include?",
                    "pharmacyPhone": "What is the pharmacy phone number?",
                },
                "confirmationTemplate": "I have a refill request for {medicationName}, date of birth {callerDob}, pharmacy {pharmacyName}, phone {pharmacyPhone}. Should I send that to the practice?",
                "successTemplate": "Okay, I sent that refill request to the practice.",
                "fallbackTemplate": "Okay, I could not send that live, but I passed the refill request to the staff.",
                "closeTemplate": "Thanks for calling the practice. Take care.",
            },
            "insurance": {
                "callerIntro": "",
                "clarificationStyle": "friendly",
                "slotPrompts": {
                    "inquiryType": "Are you asking whether the practice accepts the plan, or whether coverage looks active for a patient?",
                    "carrierName": "Which insurance carrier should I check?",
                    "planName": "Do you know the plan name, like PPO or HMO?",
                    "memberId": "What is the member ID on the insurance card?",
                    "groupNumber": "Do you know the group number?",
                    "patientName": "What is the patient's full name?",
                    "patientDob": "What is the patient's date of birth?",
                    "subscriberRelation": "Is the patient the subscriber, or are they covered through someone else?",
                    "serviceType": "What type of visit or service is this for?",
                    "callbackPhone": "What callback number should the staff use if they need to follow up?",
                },
                "confirmationTemplate": "",
                "successTemplate": "Okay, I checked that for you.",
                "fallbackTemplate": "Okay, I could not check that live, but I passed the insurance question to the staff.",
                "closeTemplate": "Thanks for calling the practice. Take care.",
            },
            "billing": {
                "callerIntro": "",
                "clarificationStyle": "friendly",
                "slotPrompts": {
                    "billingTopic": "What billing issue are you calling about?",
                    "accountReference": "What account or statement reference should I include?",
                },
                "confirmationTemplate": "I have a billing request about {billingTopic} for account {accountReference}. Should I send that to the practice?",
                "successTemplate": "Okay, I sent that billing request to the practice.",
                "fallbackTemplate": "Okay, I could not send that live, but I passed the billing request to the staff.",
                "closeTemplate": "Thanks for calling the practice. Take care.",
            },
            "handoff": {
                "callerIntro": "",
                "clarificationStyle": "friendly",
                "slotPrompts": {
                    "voicemail": "Please say the message you would like me to pass along.",
                    "reasonSummary": "What should I tell the staff this is about?",
                    "callbackPhone": "What callback number should the staff use if they need to follow up?",
                    "preferredCallbackWindow": "Is there a preferred time window for a callback?",
                    "transferConsent": "I can try to connect you now. Would you like me to try the live transfer?",
                },
                "confirmationTemplate": "",
                "successTemplate": "Okay, I passed that request to the staff.",
                "fallbackTemplate": "Okay, I can take a message for the staff to review.",
                "closeTemplate": "Thanks for calling the practice. Take care.",
            },
        },
        "emergencyKeywords": ["stroke"],
        "outOfScopeKeywords": ["legal advice"],
        "fallbackRuntimeAction": "manual-follow-up",
        "operatorSummaryEnabled": True,
    }
    merged = _deep_merge(policy, overrides)
    custom_emergency = [entry for entry in merged.get("emergencyKeywords", []) if isinstance(entry, str) and entry.strip()]
    custom_out_of_scope = [entry for entry in merged.get("outOfScopeKeywords", []) if isinstance(entry, str) and entry.strip()]
    if custom_emergency:
        medical_group = next(
            (group for group in merged["safetyPolicy"]["emergencyGroups"] if group.get("category") == "medical_emergency"),
            None,
        )
        if medical_group is not None:
            medical_group["patterns"] = list(medical_group.get("patterns", [])) + [
                rf"\b{re.escape(entry).replace(r'\\ ', r'\\s+')}\b" for entry in custom_emergency
            ]
    if custom_out_of_scope:
        merged["safetyPolicy"]["nonClinicalOutOfScopePatterns"] = list(
            merged["safetyPolicy"].get("nonClinicalOutOfScopePatterns", [])
        ) + [
            rf"\b{re.escape(entry).replace(r'\\ ', r'\\s+')}\b" for entry in custom_out_of_scope
        ]
    return merged


class ServiceLoggingTests(unittest.TestCase):
    def test_service_module_uses_structlog_logger(self):
        self.assertIn("structlog", type(service_module.logger).__module__)
        self.assertTrue(hasattr(service_module.logger, "bind"))


class FakeCoreApiClient:
    def __init__(
        self,
        *,
        after_hours: bool = False,
        action_outcomes=None,
        omit_voice_policy: bool = False,
        voice_policy=None,
        settings_overrides=None,
    ):
        self.after_hours = after_hours
        self.action_outcomes = action_outcomes or {}
        self.omit_voice_policy = omit_voice_policy
        self.voice_policy = voice_policy
        self.settings_overrides = settings_overrides or {}
        self.runtime_action_calls = []
        self.updated_calls = []
        self.created_voicemails = []
        self.saved_transcripts = []
        self.ingested_calls = []
        self.bootstrapped_calls = []
        self.escalation_calls = []

    async def close(self):
        return None

    async def bootstrap_voice_session(self, payload):
        payload = {
            "callId": "call-1",
            "runtimeConfigVersion": "test-version",
            "business": {
                "id": "business-1",
                "name": "Wardline Family Medicine",
                "slug": "wardline-family-medicine",
                "timeZone": "America/New_York",
                "status": "ACTIVE",
            },
            "settings": {
                "recordingDefault": "ASK",
                "transcriptRetentionDays": 30,
                "operatingHours": (
                    [{"dayOfWeek": day, "isClosed": True, "startTime": None, "endTime": None} for day in range(7)]
                    if self.after_hours
                    else [{"dayOfWeek": day, "isClosed": False, "startTime": "00:00", "endTime": "23:59"} for day in range(7)]
                ),
            },
            "phoneNumbers": [{"id": "phone-1", "label": "Main", "twilioPhoneNumber": "+15551230001"}],
            "integrations": [],
            "connectedIntegrationCategories": ["SCHEDULING", "EHR_REFILL", "INSURANCE", "BILLING"],
        }
        payload["settings"].update(self.settings_overrides)
        if not self.omit_voice_policy:
            payload["voicePolicyV2"] = self.voice_policy or build_voice_policy()
        self.bootstrapped_calls.append(payload)
        return payload

    async def get_caller_context(self, _business_id: str, _caller_phone: str):
        return {"caller": None, "recentCalls": [], "knownInsurance": None, "knownMedications": []}

    async def get_business_by_phone(self, _phone_number: str):
        return {"id": "business-1"}

    async def get_runtime_config(self, _business_id: str):
        return await self.bootstrap_voice_session({})

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

    async def ingest_call(self, call_id, payload):
        self.ingested_calls.append((call_id, payload))
        for segment in payload.get("transcriptSegments", []):
            self.saved_transcripts.append((call_id, {"segments": [segment]}))
        return {
            "accepted": True,
            "callId": call_id,
            "ingestedEventCount": len(payload.get("events", [])),
            "transcriptSegmentCount": len(payload.get("transcriptSegments", [])),
        }

    async def escalate_to_human(self, payload):
        self.escalation_calls.append(payload)
        return {"outcome": "transferred", "transferPhone": payload.get("transferPhone")}

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
    def setUp(self):
        super().setUp()
        # Avoid Redis in unit tests: reloading from Redis replaces SessionState instances and
        # breaks assertions that hold the object returned from start_session.
        self._p_redis_url = patch.object(config.settings, "redis_url", "")
        self._p_redis_url.start()
        self._p_llm_route = patch("service.route_turn_llm", new=AsyncMock(return_value=None))
        self._p_llm_safe = patch("service.assess_safety_llm", new=AsyncMock(return_value=None))
        self._p_llm_slots = patch("service.extract_slots_llm", new=AsyncMock(return_value={}))
        self._p_llm_agents = patch("service.run_llm_agent", new=AsyncMock(return_value=None))
        self._p_service_info = patch("service.logger.info")
        self._p_llm_route.start()
        self._p_llm_safe.start()
        self._p_llm_slots.start()
        self._p_llm_agents.start()
        self._p_service_info.start()

    def tearDown(self):
        self._p_llm_route.stop()
        self._p_llm_safe.stop()
        self._p_llm_slots.stop()
        self._p_llm_agents.stop()
        self._p_service_info.stop()
        self._p_redis_url.stop()
        super().tearDown()

    async def create_runtime(self, **client_kwargs):
        api_client = FakeCoreApiClient(**client_kwargs)
        runtime = VoiceRuntimeV2(api_client=api_client)
        self.addAsyncCleanup(runtime.close)
        session = await runtime.start_session("CA_test", "+15550000001", "+15551230001")
        return runtime, api_client, session

    async def test_missing_voice_policy_required(self):
        api_client = FakeCoreApiClient(omit_voice_policy=True)
        runtime = VoiceRuntimeV2(api_client=api_client)
        self.addAsyncCleanup(runtime.close)

        with self.assertRaisesRegex(ValueError, "voicePolicyV2"):
            await runtime.start_session("CA_test", "+15550000001", "+15551230001")

    async def test_session_bootstrap_includes_transport_metadata(self):
        runtime, _api_client, session = await self.create_runtime()

        self.assertEqual(session.transport.transport, "livekit")
        self.assertEqual(session.transport.sessionId, session.sessionId)
        self.assertEqual(session.transport.twilioCallSid, "CA_test")
        self.assertTrue(session.transport.roomName.startswith("wardline-"))
        self.assertIn("/telephony/twilio/media", session.transport.twilioMediaStreamUrl)
        twiml = await runtime.build_twilio_bootstrap_response(session.sessionId)
        self.assertIn("<Stream", twiml)
        self.assertIn(session.sessionId, twiml)
        self.assertIn("streamToken", twiml)
        self.assertTrue(session.mediaStreamToken)

    async def test_session_bootstrap_persists_initiated_status(self):
        _runtime, api_client, _session = await self.create_runtime()

        self.assertEqual(api_client.updated_calls[0]["status"], "INITIATED")

    async def test_session_bootstrap_skips_legacy_call_sync_when_flag_is_disabled(self):
        with patch("service.settings.voice_runtime_legacy_call_sync", False):
            _runtime, api_client, _session = await self.create_runtime()

        self.assertEqual(len(api_client.updated_calls), 0)
        self.assertEqual(api_client.ingested_calls[0][1]["statePatch"]["status"], "INITIATED")

    async def test_transport_start_persists_ongoing_status(self):
        runtime, api_client, session = await self.create_runtime()

        await runtime.persist_transport_event(
            session.sessionId,
            "twilio_stream_started",
            {
                "twilioStreamSid": "MZ123",
                "providerSessionId": "MZ123",
            },
            status="ONGOING",
        )

        self.assertEqual(api_client.updated_calls[-1]["status"], "ONGOING")
        self.assertEqual(
            api_client.updated_calls[-1]["turnsJson"][-1]["actionName"],
            "twilio_stream_started",
        )

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

    async def test_office_hours_question_for_today_uses_knowledge_topic(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "What are your hours today?")

        self.assertEqual(response["domain"], "knowledge")
        self.assertIn("today", response["reply"].lower())
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "knowledge-topic-match")
        self.assertEqual(supervisor_event.data["knowledgeTopic"], "office_hours")
        self.assertIn("hours", supervisor_event.data["matchedKeywords"])

    async def test_office_hours_question_for_specific_weekday(self):
        saturday_hours = [
            {"dayOfWeek": 0, "isClosed": True, "startTime": None, "endTime": None},
            {"dayOfWeek": 1, "isClosed": False, "startTime": "08:00", "endTime": "17:00"},
            {"dayOfWeek": 2, "isClosed": False, "startTime": "08:00", "endTime": "17:00"},
            {"dayOfWeek": 3, "isClosed": False, "startTime": "08:00", "endTime": "17:00"},
            {"dayOfWeek": 4, "isClosed": False, "startTime": "08:00", "endTime": "17:00"},
            {"dayOfWeek": 5, "isClosed": False, "startTime": "08:00", "endTime": "17:00"},
            {"dayOfWeek": 6, "isClosed": False, "startTime": "09:00", "endTime": "13:00"},
        ]
        runtime, _api_client, session = await self.create_runtime(settings_overrides={"operatingHours": saturday_hours})

        response = await runtime.process_text_turn(session.sessionId, "Are you open on Saturday?")

        self.assertIn("Saturday", response["reply"])
        self.assertIn("09:00", response["reply"])
        self.assertIn("13:00", response["reply"])

    async def test_open_right_now_answer_uses_current_hours(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "Are you open right now?")

        self.assertEqual(response["domain"], "knowledge")
        self.assertIn("open right now", response["reply"].lower())

    async def test_services_question_uses_services_summary(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "What services do you offer?")

        self.assertEqual(
            response["reply"],
            "We help with appointments, refills, insurance questions, and billing support. What else can I help you with today?",
        )

    async def test_refill_policy_question_uses_refill_summary(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "How do refills work?")

        self.assertIn("pharmacy phone", response["reply"].lower())
        self.assertEqual(response["domain"], "knowledge")

    async def test_billing_policy_question_uses_billing_summary(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "How do billing questions work?")

        self.assertIn("balances", response["reply"].lower())
        self.assertEqual(response["domain"], "knowledge")

    async def test_recording_question_uses_recording_default(self):
        runtime, _api_client, session = await self.create_runtime(settings_overrides={"recordingDefault": "ASK"})

        response = await runtime.process_text_turn(session.sessionId, "Do you record calls?")

        self.assertIn("before a call is recorded", response["reply"].lower())

    async def test_transcript_retention_question_uses_retention_days(self):
        runtime, _api_client, session = await self.create_runtime(settings_overrides={"transcriptRetentionDays": 14})

        response = await runtime.process_text_turn(session.sessionId, "How long do you keep call transcripts?")

        self.assertIn("14 days", response["reply"].lower())

    async def test_custom_faq_answer_is_returned_when_matched(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "Do you take walk-ins?")

        self.assertIn("walk-ins are limited", response["reply"].lower())
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "custom-faq-match")

    async def test_emergency_interrupts_and_creates_follow_up(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I have chest pain and can't breathe")

        self.assertIn("Please call 911", response["reply"])
        self.assertEqual(api_client.runtime_action_calls[0][1], "manual-follow-up")
        self.assertEqual(response["operatorSummary"]["headline"], "Medical emergency language detected")

    async def test_mental_health_crisis_triggers_emergency_guidance(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I want to kill myself")

        self.assertEqual(response["domain"], "safety")
        self.assertIn("call or text 988", response["reply"])
        self.assertEqual(api_client.runtime_action_calls[0][1], "manual-follow-up")
        self.assertEqual(response["operatorSummary"]["headline"], "Mental health crisis language detected")

    async def test_violence_abuse_language_triggers_emergency_guidance(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I'm not safe at home and someone is hurting me")

        self.assertEqual(response["domain"], "safety")
        self.assertIn("may be in danger", response["reply"].lower())
        self.assertEqual(response["operatorSummary"]["headline"], "Violence or abuse emergency language detected")

    async def test_results_question_routes_to_daytime_handoff_flow(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "Can you tell me what these lab results mean?")

        self.assertEqual(response["domain"], "handoff")
        self.assertTrue(response["requiresConfirmation"])
        self.assertIn("i can't interpret symptoms, test results, or medication safety questions", response["reply"].lower())
        self.assertIn("try to connect you to the front desk", response["reply"].lower())
        self.assertEqual(len(api_client.runtime_action_calls), 0)
        safety_event = [event for event in session.events if event.type == "safety_triggered"][-1]
        self.assertEqual(safety_event.data["category"], "clinical_results_or_diagnosis")
        self.assertEqual(safety_event.data["severity"], "urgent_handoff")

    async def test_medication_safety_question_routes_to_after_hours_urgent_voicemail(self):
        runtime, _api_client, session = await self.create_runtime(after_hours=True)

        response = await runtime.process_text_turn(session.sessionId, "Can I take ibuprofen with this antibiotic?")

        self.assertEqual(response["domain"], "handoff")
        self.assertTrue(response["awaitingVoicemail"])
        self.assertIn("urgent callbacks within about 30 minutes", response["reply"].lower())
        self.assertIn("i can't interpret symptoms, test results, or medication safety questions", response["reply"].lower())

    async def test_historical_stroke_reference_does_not_trigger_emergency(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I need a follow-up after my stroke last year")

        self.assertNotEqual(response["domain"], "safety")
        self.assertNotIn("call 911", response["reply"].lower())

    async def test_prescription_refill_request_does_not_trigger_medication_safety(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I need a prescription refill")

        self.assertEqual(response["domain"], "refill")
        self.assertEqual(response["reply"], "Which medication would you like refilled?")

    async def test_safety_preempts_active_intake_and_pauses_current_issue(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule an appointment")
        response = await runtime.process_text_turn(session.sessionId, "Can you tell me what these lab results mean?")

        self.assertEqual(response["domain"], "handoff")
        scheduling_intent = next(intent for intent in response["intentQueue"] if intent["domain"] == "scheduling")
        self.assertEqual(scheduling_intent["status"], "paused")
        safety_event = [event for event in session.events if event.type == "safety_triggered"][-1]
        self.assertEqual(safety_event.data["preemptedDomain"], "scheduling")
        self.assertFalse(safety_event.data["hadPendingConfirmation"])

    async def test_safety_preempts_pending_confirmation(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        response = await runtime.process_text_turn(session.sessionId, "What dosage should I take?")

        self.assertEqual(response["domain"], "handoff")
        self.assertTrue(response["requiresConfirmation"])
        safety_event = [event for event in session.events if event.type == "safety_triggered"][-1]
        self.assertTrue(safety_event.data["hadPendingConfirmation"])

    async def test_emergency_clears_priority_prompt(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need billing help and a refill for lisinopril")
        response = await runtime.process_text_turn(session.sessionId, "I think I'm having a heart attack right now")

        self.assertEqual(response["domain"], "safety")
        self.assertFalse(response["awaitingIntentPriority"])
        self.assertFalse(response["priorityPromptState"]["active"])

    async def test_custom_emergency_keyword_still_triggers_emergency(self):
        runtime, _api_client, session = await self.create_runtime(
            voice_policy=build_voice_policy({"emergencyKeywords": ["code red"]}),
        )

        response = await runtime.process_text_turn(session.sessionId, "This is a code red situation")

        self.assertEqual(response["domain"], "safety")
        self.assertIn("call 911", response["reply"].lower())

    async def test_after_hours_urgent_voicemail_sets_awaiting_voicemail(self):
        runtime, _api_client, session = await self.create_runtime(after_hours=True)

        response = await runtime.process_text_turn(session.sessionId, "I need an urgent callback about my medication")

        self.assertTrue(response["awaitingVoicemail"])
        self.assertEqual(response["stage"], "voicemail")
        self.assertIn("say the message", response["reply"].lower())

    async def test_after_hours_scheduling_still_reaches_confirmation(self):
        runtime, _api_client, session = await self.create_runtime(after_hours=True)

        response = await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")

        self.assertFalse(response["awaitingVoicemail"])
        self.assertEqual(response["domain"], "scheduling")
        self.assertTrue(response["requiresConfirmation"])
        self.assertEqual(response["pendingAction"]["actionName"], "appointment-request")
        self.assertEqual(
            response["reply"],
            "I have a request for a physical on Tuesday at 10:00 AM. Should I send that to the practice?",
        )

    async def test_after_hours_voicemail_is_captured_from_next_turn(self):
        runtime, api_client, session = await self.create_runtime(after_hours=True)

        first_response = await runtime.process_text_turn(session.sessionId, "I need a staff callback after hours")
        self.assertTrue(first_response["awaitingVoicemail"])

        second_response = await runtime.process_text_turn(
            session.sessionId,
            "Please ask the office to call me tomorrow morning about an appointment.",
        )

        self.assertFalse(second_response["awaitingVoicemail"])
        self.assertEqual(second_response["domain"], "handoff")
        self.assertEqual(session.stage, "closing")
        self.assertEqual(len(api_client.created_voicemails), 1)
        self.assertEqual(api_client.created_voicemails[0][0], "call-1")
        self.assertEqual(
            api_client.created_voicemails[0][1]["transcription"],
            "Please ask the office to call me tomorrow morning about an appointment.",
        )
        self.assertEqual(second_response["operatorSummary"]["headline"], "Voicemail captured")
        self.assertIn("captured your message", second_response["reply"].lower())

    async def test_completed_session_ignores_late_transcripts_after_voicemail_capture(self):
        runtime, api_client, session = await self.create_runtime(after_hours=True)

        first_response = await runtime.process_text_turn(session.sessionId, "I need a staff callback after hours")
        second_response = await runtime.process_text_turn(session.sessionId, "Please ask the office to call me tomorrow morning.")
        await runtime.persist_transport_event(
            session.sessionId,
            "twilio_mark",
            {"assistantMessageId": second_response["assistantMessageId"]},
        )
        ignored = await runtime.process_text_turn(session.sessionId, "Bye.")

        self.assertEqual(len(api_client.created_voicemails), 1)
        self.assertEqual(ignored["reply"], "")
        self.assertEqual(ignored["stage"], "completed")

    async def test_finalize_without_meaningful_interaction_marks_call_abandoned(self):
        runtime, api_client, session = await self.create_runtime()

        await runtime.finalize_session(session.sessionId)

        self.assertEqual(api_client.updated_calls[-1]["status"], "ABANDONED")

    async def test_scheduling_flow_requires_confirmation_then_executes(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        self.assertTrue(response["requiresConfirmation"])
        self.assertEqual(response["pendingAction"]["actionName"], "appointment-request")
        self.assertEqual(
            response["reply"],
            "I have a request for a physical on Tuesday at 10:00 AM. Should I send that to the practice?",
        )
        self.assertNotIn("appointment appointment", response["reply"])

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertIn("I sent that appointment request to the practice.", confirmed["reply"])
        self.assertIn("What else can I help you with today?", confirmed["reply"])
        self.assertEqual(api_client.runtime_action_calls[-1][1], "appointment-request")
        self.assertTrue(confirmed["awaitingAnythingElse"])
        self.assertTrue(confirmed["assistantMessageId"])
        self.assertGreaterEqual(len(api_client.saved_transcripts), 3)

    async def test_confirmation_change_flow_returns_to_the_same_domain(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        changed = await runtime.process_text_turn(session.sessionId, "Actually, make it a follow-up instead")

        self.assertTrue(changed["requiresConfirmation"])
        self.assertEqual(changed["domain"], "scheduling")
        self.assertEqual(
            changed["reply"],
            "I have a request for a follow-up on Tuesday at 10:00 AM. Should I send that to the practice?",
        )

    async def test_generic_appointment_request_asks_for_visit_type_without_duplication(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I want to schedule an appointment for Tuesday at 10")

        self.assertEqual(response["domain"], "scheduling")
        self.assertFalse(response["requiresConfirmation"])
        self.assertEqual(response["missingSlots"], ["visitType"])
        self.assertEqual(
            response["reply"],
            "What kind of appointment do you need, like a physical, follow-up, or consultation?",
        )
        self.assertNotIn("appointment appointment", response["reply"])

    async def test_refill_flow_collects_required_slots_before_confirmation(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I need a refill")
        self.assertEqual(response["reply"], "Which medication would you like refilled?")

        next_response = await runtime.process_text_turn(session.sessionId, "It's for lisinopril")
        self.assertEqual(next_response["reply"], "What is the caller's date of birth?")
        self.assertEqual(next_response["missingSlots"], ["callerDob", "pharmacyName", "pharmacyPhone"])

        dob_response = await runtime.process_text_turn(session.sessionId, "01/05/1980")
        self.assertEqual(dob_response["reply"], "Which pharmacy should I include?")

        pharmacy_response = await runtime.process_text_turn(session.sessionId, "CVS")
        self.assertEqual(pharmacy_response["reply"], "What is the pharmacy phone number?")

        confirmation = await runtime.process_text_turn(session.sessionId, "555-123-4567")
        self.assertTrue(confirmation["requiresConfirmation"])
        self.assertEqual(confirmation["pendingAction"]["actionName"], "refill-request")
        self.assertEqual(
            confirmation["reply"],
            "I have a refill request for lisinopril, date of birth 1980-01-05, pharmacy CVS, phone 555-123-4567. Should I send that to the practice?",
        )

    async def test_refill_change_repair_updates_the_same_domain(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need a refill for lisinopril")
        await runtime.process_text_turn(session.sessionId, "01/05/1980")
        await runtime.process_text_turn(session.sessionId, "CVS")
        await runtime.process_text_turn(session.sessionId, "555-123-4567")

        changed = await runtime.process_text_turn(session.sessionId, "Actually it's for metformin")

        self.assertTrue(changed["requiresConfirmation"])
        self.assertEqual(changed["domain"], "refill")
        self.assertIn("metformin", changed["reply"])
        self.assertNotIn("lisinopril", changed["reply"])

    async def test_refill_confirmation_replay_uses_stored_prompt(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need a refill for lisinopril")
        await runtime.process_text_turn(session.sessionId, "01/05/1980")
        await runtime.process_text_turn(session.sessionId, "CVS")
        confirmation = await runtime.process_text_turn(session.sessionId, "555-123-4567")
        repeated = await runtime.process_text_turn(session.sessionId, "say that again")

        self.assertEqual(repeated["reply"], confirmation["reply"])
        self.assertTrue(repeated["requiresConfirmation"])

    async def test_refill_executes_with_full_payload_on_confirmation(self):
        runtime, api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need a refill for lisinopril")
        await runtime.process_text_turn(session.sessionId, "01/05/1980")
        await runtime.process_text_turn(session.sessionId, "CVS")
        await runtime.process_text_turn(session.sessionId, "555-123-4567")

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")

        self.assertIn("I sent that refill request to the practice.", confirmed["reply"])
        self.assertEqual(api_client.runtime_action_calls[-1][1], "refill-request")
        self.assertEqual(
            api_client.runtime_action_calls[-1][2],
            {
                "callerName": "Caller",
                "callerPhone": "+15550000001",
                "callerDob": "1980-01-05",
                "medicationName": "lisinopril",
                "prescriberName": None,
                "pharmacyName": "CVS",
                "pharmacyPhone": "555-123-4567",
                "notes": "",
                "confirmed": True,
                "callId": "call-1",
            },
        )

    async def test_refill_missing_required_slot_escalates_to_manual_follow_up(self):
        runtime, api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need a refill for lisinopril")
        await runtime.process_text_turn(session.sessionId, "01/05/1980")
        await runtime.process_text_turn(session.sessionId, "CVS")

        response = await runtime.process_text_turn(session.sessionId, "I don't know it")

        self.assertTrue(response["requiresConfirmation"])
        self.assertEqual(response["pendingAction"]["actionName"], "manual-follow-up")
        self.assertEqual(response["operatorSummary"]["headline"], "Refill intake incomplete")
        self.assertIn("pharmacy phone number", response["reply"])

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertEqual(api_client.runtime_action_calls[-1][1], "manual-follow-up")
        self.assertIn("complete it manually", confirmed["reply"])

    async def test_insurance_live_check_executes_without_confirmation(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "Can you check if you take Aetna?")

        self.assertFalse(response["requiresConfirmation"])
        self.assertEqual(api_client.runtime_action_calls[-1][1], "insurance-check")
        self.assertEqual(response["operatorSummary"]["headline"], "Insurance acceptance check ready")
        self.assertTrue(response["awaitingAnythingElse"])

    async def test_insurance_eligibility_collects_member_id_and_dob_before_live_execution(self):
        runtime, api_client, session = await self.create_runtime()

        first = await runtime.process_text_turn(
            session.sessionId,
            "I need an eligibility check with Blue Cross",
        )
        self.assertEqual(first["reply"], "What is the member ID on the insurance card?")

        second = await runtime.process_text_turn(session.sessionId, "Member ID A12345")
        self.assertEqual(second["reply"], "What is the patient's date of birth?")

        third = await runtime.process_text_turn(session.sessionId, "01/05/1980")
        self.assertEqual(third["reply"], "What is the patient's full name?")

        fourth = await runtime.process_text_turn(session.sessionId, "John Doe")
        self.assertFalse(fourth["requiresConfirmation"])
        self.assertEqual(api_client.runtime_action_calls[-1][1], "insurance-check")
        self.assertEqual(api_client.runtime_action_calls[-1][2]["inquiryType"], "eligibility")
        self.assertEqual(api_client.runtime_action_calls[-1][2]["memberId"], "A12345")
        self.assertEqual(api_client.runtime_action_calls[-1][2]["patientDob"], "1980-01-05")
        self.assertEqual(api_client.runtime_action_calls[-1][2]["patientName"], "John Doe")
        self.assertEqual(fourth["operatorSummary"]["headline"], "Insurance eligibility check ready")

    async def test_insurance_claim_status_downgrades_to_staff_follow_up(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(
            session.sessionId,
            "I need claim status for Aetna member ID A12345 patient John Doe date of birth 01/05/1980",
        )

        self.assertTrue(response["requiresConfirmation"])
        self.assertEqual(response["pendingAction"]["actionName"], "manual-follow-up")
        self.assertEqual(response["operatorSummary"]["headline"], "Insurance request needs staff review")
        self.assertIn("needs staff review", response["reply"].lower())

    async def test_insurance_missing_member_id_escalates_to_manual_follow_up(self):
        runtime, api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need an eligibility check with Aetna")
        first_retry = await runtime.process_text_turn(session.sessionId, "I don't have it")
        self.assertTrue(first_retry["requiresConfirmation"])
        self.assertEqual(first_retry["pendingAction"]["actionName"], "manual-follow-up")

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertEqual(api_client.runtime_action_calls[-1][1], "manual-follow-up")
        self.assertIn("insurance request to the staff", confirmed["reply"].lower())

    async def test_daytime_handoff_asks_for_reason_then_offers_transfer(self):
        runtime, _api_client, session = await self.create_runtime()

        first = await runtime.process_text_turn(session.sessionId, "Transfer me")
        self.assertEqual(first["reply"], "What should I tell the staff this is about?")

        second = await runtime.process_text_turn(session.sessionId, "It's about my medication")
        self.assertTrue(second["requiresConfirmation"])
        self.assertEqual(second["pendingAction"]["actionName"], "handoff-transfer")
        self.assertIn("connect you to the front desk", second["reply"].lower())

    async def test_daytime_handoff_transfer_me_now_attempts_live_transfer(self):
        runtime, api_client, session = await self.create_runtime()

        with patch.object(runtime.twilio, "redirect_live_call", AsyncMock(return_value={"sid": "CA_test"})):
            await runtime.process_text_turn(session.sessionId, "Transfer me")
            response = await runtime.process_text_turn(
                session.sessionId,
                "It's about my medication and transfer me now",
            )

        self.assertEqual(response["domain"], "handoff")
        self.assertEqual(response["stage"], "handoff")
        self.assertEqual(len(api_client.escalation_calls), 1)
        self.assertEqual(len(api_client.runtime_action_calls), 0)
        self.assertTrue(any(event.type == "handoff_transfer_requested" for event in session.events))

    async def test_daytime_handoff_callback_only_mode_skips_live_transfer(self):
        runtime, api_client, session = await self.create_runtime(
            voice_policy=build_voice_policy(
                {
                    "daytimeHandoffPolicy": {
                        "mode": "callback_only",
                        "transferTargetLabel": "front desk",
                        "transferPhone": "",
                        "ringTimeoutSeconds": 20,
                        "collectReasonFirst": True,
                        "fallbackSummary": "Create a same-day callback task for staff.",
                    }
                }
            )
        )

        response = await runtime.process_text_turn(session.sessionId, "I need to speak to someone about my medication")

        self.assertEqual(api_client.runtime_action_calls[-1][1], "manual-follow-up")
        self.assertEqual(len(api_client.escalation_calls), 0)
        self.assertEqual(response["stage"], "closing")
        self.assertIn("call you back", response["reply"].lower())

    async def test_transfer_action_no_answer_creates_callback_follow_up(self):
        runtime, api_client, session = await self.create_runtime()

        with patch.object(runtime.twilio, "redirect_live_call", AsyncMock(return_value={"sid": "CA_test"})):
            await runtime.process_text_turn(session.sessionId, "Transfer me")
            await runtime.process_text_turn(
                session.sessionId,
                "It's about my medication and transfer me now",
            )

        twiml = await runtime.handle_transfer_action_callback(
            session.sessionId,
            {"DialCallStatus": "no-answer"},
        )

        self.assertIn("<Say>", twiml)
        self.assertEqual(api_client.runtime_action_calls[-1][1], "manual-follow-up")
        self.assertEqual(session.stage, "completed")
        self.assertTrue(any(event.type == "handoff_transfer_failed" for event in session.events))

    async def test_billing_flow_collects_required_slots_before_confirmation(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I have a billing question")
        self.assertEqual(response["reply"], "What billing issue are you calling about?")

        topic_response = await runtime.process_text_turn(session.sessionId, "It's about my outstanding balance")
        self.assertEqual(topic_response["reply"], "What account or statement reference should I include?")

        confirmation = await runtime.process_text_turn(session.sessionId, "statement number AB-1234")
        self.assertTrue(confirmation["requiresConfirmation"])
        self.assertEqual(confirmation["pendingAction"]["actionName"], "billing-request")
        self.assertEqual(
            confirmation["reply"],
            "I have a billing request about my outstanding balance for account AB-1234. Should I send that to the practice?",
        )

    async def test_billing_change_repair_updates_account_reference(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I have a billing question")
        await runtime.process_text_turn(session.sessionId, "It's about my statement")
        await runtime.process_text_turn(session.sessionId, "statement number AB-1234")

        changed = await runtime.process_text_turn(session.sessionId, "Actually use account 88721")

        self.assertTrue(changed["requiresConfirmation"])
        self.assertEqual(changed["domain"], "billing")
        self.assertIn("account 88721", changed["reply"])
        self.assertNotIn("AB-1234", changed["reply"])

    async def test_billing_escalates_after_repeated_missing_account_reference(self):
        runtime, api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I have a billing question")
        await runtime.process_text_turn(session.sessionId, "It's about my outstanding balance")

        first_retry = await runtime.process_text_turn(session.sessionId, "I'm still looking")
        self.assertEqual(first_retry["reply"], "What account or statement reference should I include?")

        escalated = await runtime.process_text_turn(session.sessionId, "Still checking")
        self.assertTrue(escalated["requiresConfirmation"])
        self.assertEqual(escalated["pendingAction"]["actionName"], "manual-follow-up")
        self.assertEqual(escalated["operatorSummary"]["headline"], "Billing intake incomplete")

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertEqual(api_client.runtime_action_calls[-1][1], "manual-follow-up")
        self.assertIn("billing request to the staff", confirmed["reply"].lower())

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

        await runtime.process_text_turn(session.sessionId, "I have a billing question")
        await runtime.process_text_turn(session.sessionId, "It's about my statement")
        response = await runtime.process_text_turn(session.sessionId, "statement number AB-1234")
        self.assertTrue(response["requiresConfirmation"])

        confirmed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertEqual(confirmed["operatorSummary"]["fallbackReason"], "timeout")
        self.assertTrue(confirmed["operatorSummary"]["followUpRequired"])
        self.assertIn("passed the billing request to the staff", confirmed["reply"].lower())

    async def test_compound_knowledge_plus_scheduling_turn(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "What are your hours and can I schedule a physical?")

        self.assertEqual(response["domain"], "scheduling")
        self.assertFalse(response["requiresConfirmation"])
        self.assertIn("office is open today", response["reply"].lower())
        self.assertTrue(response["reply"].endswith("What day would you like that?"))
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "compound-knowledge-plus-action")
        self.assertEqual(supervisor_event.data["followOnIntent"]["domain"], "scheduling")
        self.assertTrue(any(event.type == "knowledge_result" for event in session.events))

    async def test_custom_faq_with_route_to_scheduling_works_in_compound_turn(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "Do you take walk-ins, and can I schedule a physical?")

        self.assertEqual(response["domain"], "scheduling")
        self.assertIn("walk-ins are limited", response["reply"].lower())
        self.assertTrue(response["reply"].endswith("What day would you like that?"))

    async def test_compound_knowledge_plus_refill_turn(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "How do refills work, and I need one for lisinopril.")

        self.assertEqual(response["domain"], "refill")
        self.assertFalse(response["requiresConfirmation"])
        self.assertIn("pharmacy phone", response["reply"].lower())
        self.assertTrue(response["reply"].endswith("What is the caller's date of birth?"))

    async def test_compound_knowledge_plus_handoff_turn(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "What are your hours and can someone call me back?")

        self.assertEqual(response["domain"], "handoff")
        self.assertIn("office is open today", response["reply"].lower())
        self.assertIn("connect you to the front desk", response["reply"].lower())
        self.assertEqual(len(api_client.runtime_action_calls), 0)
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "compound-knowledge-plus-handoff")

    async def test_active_scheduling_intake_continues_on_slot_like_follow_up(self):
        runtime, _api_client, session = await self.create_runtime()

        first_response = await runtime.process_text_turn(session.sessionId, "I want to schedule an appointment")
        self.assertEqual(first_response["reply"], "What kind of appointment do you need, like a physical, follow-up, or consultation?")

        second_response = await runtime.process_text_turn(session.sessionId, "Physical")

        self.assertEqual(second_response["domain"], "scheduling")
        self.assertEqual(second_response["reply"], "What day would you like that?")
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "continue-active-intake")

    async def test_active_intake_does_not_swallow_a_knowledge_question(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I want to schedule an appointment")
        response = await runtime.process_text_turn(session.sessionId, "What are your hours today?")

        self.assertEqual(response["domain"], "knowledge")
        self.assertIn("today", response["reply"].lower())

    async def test_explicit_human_request_beats_knowledge_only_routing(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "Can someone from the staff call me back about your hours?")

        self.assertEqual(response["domain"], "handoff")
        self.assertTrue(response["requiresConfirmation"])
        self.assertEqual(response["pendingAction"]["actionName"], "handoff-transfer")
        self.assertIn("connect you to the front desk", response["reply"].lower())
        self.assertEqual(len(api_client.runtime_action_calls), 0)
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "explicit-human-request")

    async def test_out_of_scope_keyword_deflects_safely(self):
        runtime, api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(session.sessionId, "I need legal advice about a dispute.")

        self.assertEqual(response["domain"], "knowledge")
        self.assertIn("not able to help with that topic", response["reply"].lower())
        self.assertEqual(len(api_client.runtime_action_calls), 0)
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "out-of-scope-deflection")

    async def test_anything_else_continuation_supports_second_domain(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        await runtime.process_text_turn(session.sessionId, "yes")

        next_response = await runtime.process_text_turn(session.sessionId, "I also need a refill for lisinopril")

        self.assertEqual(next_response["domain"], "refill")
        self.assertFalse(next_response["requiresConfirmation"])
        self.assertEqual(next_response["reply"], "What is the caller's date of birth?")

    async def test_multiple_action_issues_prompt_for_priority(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(
            session.sessionId,
            "I need billing help and a refill for lisinopril",
        )

        self.assertTrue(response["awaitingIntentPriority"])
        self.assertIn("Which should I handle first?", response["reply"])
        self.assertIn("billing request", response["reply"].lower())
        self.assertIn("refill request", response["reply"].lower())
        supervisor_event = [event for event in session.events if event.type == "supervisor_decision"][-1]
        self.assertEqual(supervisor_event.operatorSummary, "multi-intent-priority-prompt")

    async def test_knowledge_plus_multiple_actions_answers_then_prompts_for_priority(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(
            session.sessionId,
            "What are your hours today, and I need billing help and a refill for lisinopril",
        )

        self.assertTrue(response["awaitingIntentPriority"])
        self.assertIn("office is open today", response["reply"].lower())
        self.assertIn("Which should I handle first?", response["reply"])

    async def test_selected_issue_completes_then_prompts_for_remaining_issue(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(
            session.sessionId,
            "I need billing help and a refill for lisinopril",
        )
        first = await runtime.process_text_turn(session.sessionId, "refill first")
        self.assertEqual(first["domain"], "refill")
        self.assertEqual(first["reply"], "What is the caller's date of birth?")

        await runtime.process_text_turn(session.sessionId, "01/05/1980")
        await runtime.process_text_turn(session.sessionId, "CVS")
        await runtime.process_text_turn(session.sessionId, "555-123-4567")
        confirmed = await runtime.process_text_turn(session.sessionId, "yes")

        self.assertTrue(confirmed["awaitingIntentPriority"])
        self.assertIn("You also asked about", confirmed["reply"])
        self.assertIn("billing request", confirmed["reply"].lower())

        next_issue = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertEqual(next_issue["domain"], "billing")
        self.assertEqual(next_issue["reply"], "What account or statement reference should I include?")

    async def test_new_issue_during_active_intake_can_switch_and_resume(self):
        runtime, _api_client, session = await self.create_runtime()

        first = await runtime.process_text_turn(session.sessionId, "I want to schedule an appointment")
        self.assertEqual(first["reply"], "What kind of appointment do you need, like a physical, follow-up, or consultation?")

        switch_prompt = await runtime.process_text_turn(session.sessionId, "I also need billing help")
        self.assertTrue(switch_prompt["awaitingIntentPriority"])
        self.assertIn("switch to billing request", switch_prompt["reply"].lower())

        billing = await runtime.process_text_turn(session.sessionId, "billing first")
        self.assertEqual(billing["domain"], "billing")
        self.assertEqual(billing["reply"], "What account or statement reference should I include?")

        await runtime.process_text_turn(session.sessionId, "It's about my statement")
        await runtime.process_text_turn(session.sessionId, "statement number AB-1234")
        resolved = await runtime.process_text_turn(session.sessionId, "yes")

        self.assertTrue(resolved["awaitingIntentPriority"])
        self.assertIn("you also asked about", resolved["reply"].lower())
        self.assertIn("scheduling request", resolved["reply"].lower())

        resumed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertEqual(resumed["domain"], "scheduling")
        self.assertEqual(
            resumed["reply"],
            "What kind of appointment do you need, like a physical, follow-up, or consultation?",
        )

    async def test_new_issue_during_confirmation_can_switch_and_resume_confirmation(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        switch_prompt = await runtime.process_text_turn(session.sessionId, "I also need billing help")

        self.assertTrue(switch_prompt["awaitingIntentPriority"])
        self.assertIn("keep working on a physical on tuesday at 10:00 am", switch_prompt["reply"].lower())

        billing = await runtime.process_text_turn(session.sessionId, "billing first")
        self.assertEqual(billing["domain"], "billing")
        self.assertEqual(billing["reply"], "What account or statement reference should I include?")

        await runtime.process_text_turn(session.sessionId, "It's about my statement")
        await runtime.process_text_turn(session.sessionId, "statement number AB-1234")
        resolved = await runtime.process_text_turn(session.sessionId, "yes")

        self.assertTrue(resolved["awaitingIntentPriority"])
        self.assertIn("physical on tuesday at 10:00 am", resolved["reply"].lower())

        resumed = await runtime.process_text_turn(session.sessionId, "yes")
        self.assertTrue(resumed["requiresConfirmation"])
        self.assertEqual(resumed["domain"], "scheduling")
        self.assertEqual(
            resumed["reply"],
            "I have a request for a physical on Tuesday at 10:00 AM. Should I send that to the practice?",
        )

    async def test_rejects_more_than_three_actionable_issues_in_one_turn(self):
        runtime, _api_client, session = await self.create_runtime()

        response = await runtime.process_text_turn(
            session.sessionId,
            "I need to schedule a physical and I need a refill for lisinopril and I need billing help and I need someone from the staff to call me back",
        )

        self.assertIn("top three things", response["reply"].lower())
        self.assertFalse(response["awaitingIntentPriority"])

    async def test_final_close_waits_for_mark_then_ignores_late_transcripts(self):
        runtime, _api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        await runtime.process_text_turn(session.sessionId, "yes")
        close_response = await runtime.process_text_turn(session.sessionId, "no")

        self.assertEqual(close_response["stage"], "closing")
        self.assertTrue(close_response["closeState"]["active"])
        self.assertFalse(close_response["closeState"]["playbackCompleted"])

        await runtime.persist_transport_event(
            session.sessionId,
            "twilio_mark",
            {"assistantMessageId": close_response["assistantMessageId"]},
        )
        ignored = await runtime.process_text_turn(session.sessionId, "Actually I also need a refill")

        self.assertEqual(ignored["reply"], "")
        self.assertEqual(ignored["stage"], "completed")
        self.assertTrue(ignored["closeState"]["playbackCompleted"])

    async def test_disconnect_after_final_close_marks_call_completed(self):
        runtime, api_client, session = await self.create_runtime()

        await runtime.process_text_turn(session.sessionId, "I need to schedule a physical on Tuesday at 10am")
        await runtime.process_text_turn(session.sessionId, "yes")
        close_response = await runtime.process_text_turn(session.sessionId, "no")
        await runtime.persist_transport_event(
            session.sessionId,
            "twilio_mark",
            {"assistantMessageId": close_response["assistantMessageId"]},
        )

        await runtime.finalize_session(session.sessionId)

        self.assertEqual(api_client.updated_calls[-1]["status"], "COMPLETED")


if __name__ == "__main__":
    unittest.main()
