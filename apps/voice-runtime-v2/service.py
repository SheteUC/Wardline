"""
Voice Runtime V2 orchestration service.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import ValidationError

from agents import (
    BillingAgent,
    HandoffAgent,
    InsuranceAgent,
    KnowledgeAgent,
    RefillAgent,
    SafetyAgent,
    SchedulingAgent,
    SupervisorAgent,
    URGENT_AFTER_HOURS_KEYWORDS,
)
from core_api_client import CoreApiClient
from models import (
    CallLifecycleStatus,
    DomainName,
    OperatorSummary,
    PendingAction,
    RuntimeActionOutcome,
    RuntimeConfigBootstrap,
    SessionEvent,
    SessionMessage,
    SessionState,
    SessionTransportMetadata,
    SpecialistResult,
    SupervisorDecision,
)
from preflight import build_real_call_preflight_report
from providers import (
    DeepgramSttAdapter,
    LiveKitTransportAdapter,
    ManagedTtsAdapter,
    ReasoningAdapter,
    TwilioTelephonyAdapter,
)


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())


def _contains(text: str, keywords: list[str]) -> bool:
    lowered = _normalize(text)
    return any(keyword in lowered for keyword in keywords)


def _strip_change_prefix(text: str) -> str:
    updated = re.sub(
        r"^(?:actually|wait|hold on|sorry|no|not that|change it to|make it|instead)\b[ ,.-]*",
        "",
        text.strip(),
        flags=re.IGNORECASE,
    )
    return updated.strip() or text.strip()


class VoiceRuntimeV2:
    def __init__(self, api_client: Optional[CoreApiClient] = None):
        self.api_client = api_client or CoreApiClient()
        self.sessions: Dict[str, SessionState] = {}
        self.livekit = LiveKitTransportAdapter()
        self.twilio = TwilioTelephonyAdapter()
        self.deepgram = DeepgramSttAdapter()
        self.tts = ManagedTtsAdapter()
        self.reasoning = ReasoningAdapter()
        self.safety = SafetyAgent()
        self.knowledge = KnowledgeAgent()
        self.scheduling = SchedulingAgent()
        self.refill = RefillAgent()
        self.insurance = InsuranceAgent()
        self.billing = BillingAgent()
        self.handoff = HandoffAgent()
        self.supervisor = SupervisorAgent()

    async def close(self):
        await self.api_client.close()

    def real_call_preflight(self) -> Dict[str, Any]:
        return build_real_call_preflight_report()

    def build_twilio_bootstrap_response(self, session_id: str) -> str:
        session = self.get_session(session_id)
        if not session.transport.twilioMediaStreamUrl:
            raise ValueError("WEBHOOK_BASE_URL or VOICE_RUNTIME_V2_PUBLIC_URL must be configured for Twilio cutover")

        return self.twilio.build_stream_twiml(
            stream_url=session.transport.twilioMediaStreamUrl,
            parameters={
                "sessionId": session.sessionId,
                "callId": session.callId or "",
                "businessId": session.businessId,
                "roomName": session.transport.roomName,
                "participantIdentity": session.transport.participantIdentity,
                "providerSessionId": session.transport.providerSessionId or "",
            },
        )

    async def start_session(self, call_sid: str, caller_phone: str, called_phone: str) -> SessionState:
        business = await self.api_client.get_business_by_phone(called_phone)
        if not business:
            raise ValueError(f"No business found for phone {called_phone}")

        runtime_config_payload = await self.api_client.get_runtime_config(str(business["id"]))
        if not runtime_config_payload:
            raise ValueError(f"Unable to load runtime-config for business {business['id']}")
        if "voicePolicyV2" not in runtime_config_payload:
            raise ValueError(f"Runtime-config for business {business['id']} is missing required voicePolicyV2")

        try:
            runtime_config = RuntimeConfigBootstrap.model_validate(runtime_config_payload)
        except ValidationError as error:
            raise ValueError(f"Runtime-config for business {business['id']} is invalid for Voice Runtime V2") from error

        call_data = await self.api_client.create_call_session(
            {
                "direction": "INBOUND",
                "fromNumber": caller_phone,
                "toNumber": called_phone,
                "twilioCallSid": call_sid,
            }
        )
        if not call_data or not call_data.get("id"):
            raise ValueError(f"Unable to create a call session for phone {called_phone}")
        session_id = str(uuid.uuid4())
        transport = SessionTransportMetadata.model_validate(
            self.livekit.build_dispatch_metadata(
                session_id=session_id,
                business_id=runtime_config.business.id,
                call_sid=call_sid,
            ),
        )

        session = SessionState(
            sessionId=session_id,
            callSid=call_sid,
            callId=call_data.get("id") if call_data else None,
            businessId=runtime_config.business.id,
            callerPhone=caller_phone,
            calledPhone=called_phone,
            businessName=runtime_config.business.name,
            runtimeConfig=runtime_config,
            transport=transport,
            isAfterHours=not self._is_business_open(runtime_config),
        )
        greeting = (
            f"Thank you for calling {runtime_config.business.name}. "
            "I'm Wardline, your virtual receptionist. How can I help you today?"
        )
        await self._append_and_persist_assistant_message(session, greeting)
        session.events.append(
            SessionEvent(
                type="session_bootstrap",
                actionName="voice-runtime-v2",
                domain="knowledge",
                integrationCategory="TRANSPORT",
                operatorSummary="Voice Runtime V2 session started.",
                data={
                    "transport": self._transport_event_snapshot(transport),
                    "providers": self.readiness(),
                },
            )
        )
        self.sessions[session.sessionId] = session
        await self._sync_call_state(session, status="INITIATED")
        return session

    def get_session(self, session_id: str) -> SessionState:
        session = self.sessions.get(session_id)
        if not session:
            raise KeyError(f"Unknown session: {session_id}")
        return session

    def update_transport_metadata(self, session_id: str, **updates: Any) -> SessionState:
        session = self.get_session(session_id)
        transport_update = {key: value for key, value in updates.items() if value is not None}
        if transport_update:
            session.transport = session.transport.model_copy(update=transport_update)
        return session

    def readiness(self) -> Dict[str, Dict[str, str | bool]]:
        return {
            "livekit": self.livekit.validate(),
            "deepgram": self.deepgram.validate(),
            "tts": self.tts.validate(),
            "reasoning": self.reasoning.validate(),
        }

    async def synthesize_reply(self, text: str) -> bytes:
        return await self.tts.synthesize(text)

    async def persist_transcript_segment(
        self,
        session_id: str,
        *,
        speaker: str,
        text: str,
        confidence: float | None = None,
    ) -> None:
        session = self.get_session(session_id)
        await self._persist_transcript_segment(session, speaker=speaker, text=text, confidence=confidence)

    async def finalize_session(self, session_id: str, failure_reason: str | None = None) -> None:
        session = self.get_session(session_id)
        session.awaitingAnythingElse = False
        session.awaitingVoicemail = False
        session.pendingConfirmation = None
        if session.stage != "completed":
            session.stage = "completed"
        if failure_reason:
            session.runtimeFailureReason = failure_reason
        await self._sync_call_state(
            session,
            tag=self._current_call_tag(session),
            status=self._determine_terminal_status(session, failure_reason),
        )

    async def process_text_turn(self, session_id: str, text: str) -> Dict[str, Any]:
        session = self.get_session(session_id)
        cleaned_text = text.strip()
        if session.stage in {"closing", "completed"} or session.finalCloseState.active:
            if cleaned_text:
                session.events.append(
                    SessionEvent(
                        type="late_transcript_ignored",
                        actionName="ignored-after-close",
                        domain=session.activeDomain,
                        integrationCategory="TRANSPORT",
                        data={"text": cleaned_text},
                    )
                )
                await self._sync_call_state(
                    session,
                    tag=self._current_call_tag(session),
                    status=session.lifecycleStatus,
                )
            return self._build_turn_response(
                session,
                "",
                session.activeDomain or session.intent or "handoff",
                False,
            )

        if not cleaned_text:
            reply = "I didn't catch that. Could you say that again?"
            await self._append_and_persist_assistant_message(session, reply)
            return self._build_turn_response(
                session,
                reply,
                session.activeDomain or session.intent or "knowledge",
                False,
            )

        session.turns += 1
        session.messages.append(SessionMessage(role="caller", text=cleaned_text))
        await self._persist_transcript_segment(session, speaker="CALLER", text=cleaned_text)

        if session.awaitingAnythingElse:
            continuation = await self._handle_anything_else(session, cleaned_text)
            if continuation is not None:
                return continuation

        if session.awaitingVoicemail:
            return await self._capture_transcribed_voicemail(session, cleaned_text)

        safety_result = self.safety.evaluate(session, cleaned_text)
        if safety_result:
            if safety_result.requestHumanFollowUp:
                await self._create_manual_follow_up_event(
                    session,
                    safety_result.operatorSummary.headline if safety_result.operatorSummary else cleaned_text,
                )
                session.lastOperatorSummary = safety_result.operatorSummary
            return await self._finalize_specialist_result(session, safety_result)

        if session.pendingConfirmation:
            return await self._handle_pending_action(session, cleaned_text)

        decision = self.supervisor.choose_domain(session, cleaned_text, knowledge_agent=self.knowledge)
        session.lastDecision = decision
        session.intent = decision.domain
        session.activeDomain = decision.domain if decision.mode != "clarify" else None
        self._record_supervisor_decision(session, decision, cleaned_text)

        if decision.mode == "clarify":
            reply = decision.clarificationPrompt or "How can I help you today?"
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "knowledge", False)

        if decision.mode == "knowledge":
            if decision.followOnIntent:
                return await self._handle_compound_knowledge_follow_on(session, cleaned_text, decision)

            knowledge_result = self.knowledge.handle(session, decision.fragmentText or cleaned_text)
            if knowledge_result:
                session.activeDomain = None
                return await self._finalize_specialist_result(session, knowledge_result)

        result = self._run_domain_specialist(session, decision.domain, cleaned_text)
        return await self._handle_specialist_result(session, result)

    async def capture_voicemail(
        self,
        session_id: str,
        recording_url: str,
        transcription: str | None = None,
    ) -> Dict[str, Any]:
        session = self.get_session(session_id)
        if not session.callId:
            raise ValueError("Call session is missing a Core API call ID")

        result = await self.api_client.create_voicemail(
            session.callId,
            {
                "businessId": session.businessId,
                "callerPhone": session.callerPhone,
                "callerName": session.callerName,
                "recordingUrl": recording_url,
                "transcription": transcription,
                "context": session.runtimeConfig.voicePolicyV2.afterHoursPolicy.greeting,
                "createFollowUp": True,
                "isUrgent": session.isAfterHours,
                "urgencyKeywords": ["after_hours_urgent"] if session.isAfterHours else [],
            },
        )
        session.awaitingVoicemail = False
        session.voicemailCaptureState.active = False
        session.voicemailCaptureState.captured = True
        session.voicemailCaptureState.captureCount += 1
        session.voicemailCaptureState.transcription = transcription
        session.lastOperatorSummary = OperatorSummary(
            headline="Voicemail captured",
            nextStep="Review the voicemail and linked follow-up in the dashboard.",
            specialist="handoff",
            callerRequest="Voicemail captured for staff review.",
            followUpRequired=True,
        )
        session.events.append(
            SessionEvent(
                type="voicemail_captured",
                actionName="voicemail",
                domain="handoff",
                status="voicemail",
                operatorSummary=session.lastOperatorSummary.headline,
                requiresFollowUp=True,
                data={"recordingUrl": recording_url, "transcription": transcription},
            )
        )
        await self._sync_call_state(session, tag="VOICEMAIL")
        return result or {"accepted": True}

    async def process_transcript_turn(
        self,
        session_id: str,
        text: str,
        final: bool = True,
        provider_session_id: str | None = None,
    ) -> Dict[str, Any]:
        session = self.get_session(session_id)
        if provider_session_id and session.transport.providerSessionId != provider_session_id:
            session.transport = session.transport.model_copy(
                update={
                    "providerSessionId": provider_session_id,
                    "deepgramRequestId": provider_session_id,
                }
            )

        if session.stage in {"closing", "completed"} or session.finalCloseState.active:
            if final and text.strip():
                session.events.append(
                    SessionEvent(
                        type="late_transcript_ignored",
                        actionName="ignored-after-close",
                        domain=session.activeDomain,
                        integrationCategory="TRANSPORT",
                        data={"text": text, "providerSessionId": provider_session_id},
                    )
                )
                await self._sync_call_state(
                    session,
                    tag=self._current_call_tag(session),
                    status=session.lifecycleStatus,
                )
            return {
                "sessionId": session.sessionId,
                "accepted": True,
                "final": final,
                "ignored": True,
                "reply": "",
                "transport": session.transport.model_dump(),
            }

        if not final:
            session.events.append(
                SessionEvent(
                    type="transcript_partial",
                    actionName="partial-transcript",
                    domain=session.activeDomain,
                    integrationCategory="TRANSPORT",
                    data={"text": text, "providerSessionId": provider_session_id},
                )
            )
            await self._sync_call_state(
                session,
                tag=self._current_call_tag(session),
                status=session.lifecycleStatus,
            )
            return {
                "sessionId": session.sessionId,
                "accepted": True,
                "final": False,
                "transport": session.transport.model_dump(),
            }

        return await self.process_text_turn(session_id, text)

    async def _capture_transcribed_voicemail(self, session: SessionState, text: str) -> Dict[str, Any]:
        transcription = text.strip()
        if not transcription:
            reply = "I'm ready to capture your voicemail. Please say the message you'd like me to pass along."
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session, tag="VOICEMAIL")
            return self._build_turn_response(session, reply, "handoff", False, awaiting_voicemail=True)

        recording_url = f"voice-runtime-v2://transcript/{session.sessionId}"
        await self.capture_voicemail(
            session.sessionId,
            recording_url=recording_url,
            transcription=transcription,
        )
        return await self._begin_final_close(
            session,
            "Thanks, I've captured your message for the practice. The staff will review it and follow up during business hours.",
            domain="handoff",
            reason="voicemail-complete",
            tag="VOICEMAIL",
        )

    def record_transport_event(
        self,
        session_id: str,
        event_type: str,
        payload: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        session = self.get_session(session_id)
        payload = payload or {}
        transport_updates: Dict[str, Any] = {}
        if isinstance(payload.get("providerSessionId"), str):
            transport_updates["providerSessionId"] = payload["providerSessionId"]
        if isinstance(payload.get("twilioStreamSid"), str):
            transport_updates["twilioStreamSid"] = payload["twilioStreamSid"]
        if isinstance(payload.get("deepgramRequestId"), str):
            transport_updates["deepgramRequestId"] = payload["deepgramRequestId"]
            transport_updates["providerSessionId"] = payload["deepgramRequestId"]
        if transport_updates:
            session.transport = session.transport.model_copy(update=transport_updates)

        session.events.append(
            SessionEvent(
                type="transport_event",
                actionName=event_type,
                domain=session.activeDomain,
                integrationCategory="TRANSPORT",
                data=payload,
            )
        )
        if event_type == "twilio_mark":
            assistant_message_id = payload.get("assistantMessageId")
            if (
                assistant_message_id
                and session.finalCloseState.active
                and assistant_message_id == session.finalCloseState.finalMessageId
            ):
                session.finalCloseState.playbackCompleted = True
                session.finalCloseState.passiveSince = datetime.now(timezone.utc).isoformat()
                session.stage = "completed"
                session.events.append(
                    SessionEvent(
                        type="transport_event",
                        actionName="final_close_passive",
                        domain=session.activeDomain,
                        integrationCategory="TRANSPORT",
                        data={"assistantMessageId": assistant_message_id},
                    )
                )
        return {
            "sessionId": session.sessionId,
            "accepted": True,
            "eventType": event_type,
            "transport": session.transport.model_dump(),
        }

    async def persist_transport_event(
        self,
        session_id: str,
        event_type: str,
        payload: Dict[str, Any] | None = None,
        *,
        status: CallLifecycleStatus | None = None,
    ) -> Dict[str, Any]:
        snapshot = self.record_transport_event(session_id, event_type, payload)
        session = self.get_session(session_id)
        await self._sync_call_state(
            session,
            tag=self._current_call_tag(session),
            status=status or self._transport_checkpoint_status(session, event_type),
        )
        return snapshot

    async def _handle_anything_else(self, session: SessionState, text: str) -> Optional[Dict[str, Any]]:
        lowered = _normalize(text)
        if lowered in {"no", "nope", "nothing else", "that's all", "that is all", "thanks", "thank you"}:
            return await self._begin_final_close(
                session,
                f"Thanks for calling {session.businessName}. Take care.",
                domain=session.activeDomain or "knowledge",
                reason="caller-finished",
            )

        if lowered in {"yes", "yeah", "yep", "sure", "okay"}:
            session.awaitingAnythingElse = False
            session.stage = "intake"
            session.activeDomain = None
            session.intent = None
            reply = "Of course. What else can I help you with today?"
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "knowledge", False)

        session.awaitingAnythingElse = False
        session.stage = "intake"
        return None

    async def _handle_specialist_result(
        self,
        session: SessionState,
        result: SpecialistResult,
        reply_prefix: str = "",
    ) -> Dict[str, Any]:
        session.lastSpecialistResult = result
        session.lastOperatorSummary = result.operatorSummary
        session.intent = result.domain
        session.activeDomain = result.domain
        session.missingSlots = list(result.missingFields)
        if result.extractedFields:
            session.slotState[result.domain] = dict(result.extractedFields)
        self._record_specialist_result(session, result)

        if result.status == "needs_information":
            session.stage = "intake"
            return await self._finalize_specialist_result(session, result, reply_prefix=reply_prefix)

        if result.status == "ready_for_confirmation":
            session.pendingConfirmation = PendingAction(
                actionName=result.runtimeAction or "",
                summary=result.confirmationSummary or result.nextPrompt,
                confirmationPrompt=result.nextPrompt,
                payload=result.runtimePayload,
                domain=result.domain,
                callerRequestSummary=result.callerRequestSummary or result.confirmationSummary or result.nextPrompt,
                fallbackRecommendation=result.fallbackRecommendation,
                slotState=dict(result.extractedFields),
                repairPrompt="Tell me the updated details and I'll refresh that request.",
            )
            session.stage = "confirmation"
            return await self._finalize_specialist_result(
                session,
                result,
                requires_confirmation=True,
                reply_prefix=reply_prefix,
            )

        if result.status == "execute_now":
            return await self._execute_specialist_result(session, result, reply_prefix=reply_prefix)

        if result.status == "voicemail":
            session.awaitingVoicemail = True
            session.voicemailCaptureState.active = True
            session.voicemailCaptureState.captured = False
            session.stage = "voicemail"
            return await self._finalize_specialist_result(
                session,
                result,
                awaiting_voicemail=True,
                reply_prefix=reply_prefix,
            )

        return await self._finalize_specialist_result(session, result, reply_prefix=reply_prefix)

    async def _finalize_specialist_result(
        self,
        session: SessionState,
        result: SpecialistResult,
        requires_confirmation: bool = False,
        awaiting_voicemail: bool = False,
        reply_prefix: str = "",
    ) -> Dict[str, Any]:
        reply = result.nextPrompt
        if reply_prefix:
            reply = f"{reply_prefix} {reply}".strip()
        if result.resolved and not awaiting_voicemail and not session.isEmergency:
            reply = self._offer_anything_else(session, reply, result.domain)
        else:
            session.awaitingAnythingElse = False

        await self._append_and_persist_assistant_message(session, reply)
        await self._sync_call_state(session, tag=self._domain_to_tag(result.domain))
        return self._build_turn_response(
            session,
            reply,
            result.domain,
            requires_confirmation,
            awaiting_voicemail=awaiting_voicemail,
        )

    async def _handle_pending_action(self, session: SessionState, text: str) -> Dict[str, Any]:
        pending = session.pendingConfirmation
        if not pending:
            return self._build_turn_response(session, "What would you like to do next?", "knowledge", False)

        lowered = _normalize(text)
        if any(keyword in lowered for keyword in ["repeat", "summarize", "what are you confirming", "say that again"]):
            pending.confirmAttempts += 1
            reply = pending.confirmationPrompt or f"I have {pending.summary}. Should I send that to the practice?"
            await self._append_and_persist_assistant_message(session, reply)
            return self._build_turn_response(session, reply, pending.domain, True)

        if any(keyword in lowered for keyword in ["actually", "change", "wrong", "not that", "wait"]):
            pending.requestedChanges.append(text.strip())
            session.pendingConfirmation = None
            session.activeDomain = pending.domain
            session.stage = "intake"
            session.missingSlots = []
            self._clear_domain_slot_retries(session, pending.domain)
            specialist = self._select_specialist(pending.domain)
            result = specialist.handle(session, _strip_change_prefix(text))
            return await self._handle_specialist_result(session, result)

        if any(keyword in lowered for keyword in ["yes", "yeah", "yep", "correct", "confirm"]):
            return await self._execute_pending_action(session)

        if any(keyword in lowered for keyword in ["no", "cancel", "stop", "not now"]):
            session.pendingConfirmation = None
            session.stage = "intake"
            session.slotState.pop(pending.domain, None)
            session.missingSlots = []
            self._clear_domain_slot_retries(session, pending.domain)
            reply = self._offer_anything_else(session, "Okay, I won't submit that.", pending.domain)
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, pending.domain, False)

        pending.confirmAttempts += 1
        reply = f"Please say yes to send it, or tell me what you want to change about {pending.summary}."
        await self._append_and_persist_assistant_message(session, reply)
        return self._build_turn_response(session, reply, pending.domain, True)

    async def _execute_pending_action(self, session: SessionState) -> Dict[str, Any]:
        pending = session.pendingConfirmation
        if not pending:
            raise ValueError("No pending action to execute")

        outcome = await self._run_runtime_action(
            session,
            pending.actionName,
            {**pending.payload, "callId": session.callId},
        )
        session.pendingConfirmation = None
        session.completedDomains.append(pending.domain)
        session.slotState.pop(pending.domain, None)
        session.missingSlots = []
        session.activeDomain = pending.domain
        self._clear_domain_slot_retries(session, pending.domain)
        enriched_summary = self._combine_operator_summary(
            base=session.lastOperatorSummary,
            outcome=outcome,
            domain=pending.domain,
            caller_request=pending.callerRequestSummary,
        )
        self._record_runtime_action_outcome(session, pending.domain, pending.actionName, outcome, enriched_summary)
        caller_reply = self._build_caller_outcome_reply(session, pending.domain, pending.actionName, outcome)
        reply = self._offer_anything_else(session, caller_reply, pending.domain)
        await self._append_and_persist_assistant_message(session, reply)
        await self._sync_call_state(session, tag=self._domain_to_tag(pending.domain))
        return self._build_turn_response(session, reply, pending.domain, False)

    async def _execute_specialist_result(
        self,
        session: SessionState,
        result: SpecialistResult,
        reply_prefix: str = "",
    ) -> Dict[str, Any]:
        if not result.runtimeAction:
            return await self._finalize_specialist_result(session, result, reply_prefix=reply_prefix)

        outcome = await self._run_runtime_action(
            session,
            result.runtimeAction,
            {**result.runtimePayload, "callId": session.callId},
        )
        session.completedDomains.append(result.domain)
        session.slotState.pop(result.domain, None)
        session.missingSlots = []
        session.activeDomain = result.domain
        self._clear_domain_slot_retries(session, result.domain)
        enriched_summary = self._combine_operator_summary(
            base=result.operatorSummary,
            outcome=outcome,
            domain=result.domain,
            caller_request=result.callerRequestSummary or result.nextPrompt,
        )
        self._record_runtime_action_outcome(session, result.domain, result.runtimeAction, outcome, enriched_summary)
        caller_reply = self._build_caller_outcome_reply(session, result.domain, result.runtimeAction, outcome)
        if reply_prefix:
            caller_reply = f"{reply_prefix} {caller_reply}".strip()
        reply = self._offer_anything_else(session, caller_reply, result.domain)
        await self._append_and_persist_assistant_message(session, reply)
        await self._sync_call_state(session, tag=self._domain_to_tag(result.domain))
        return self._build_turn_response(session, reply, result.domain, False)

    async def _handle_compound_knowledge_follow_on(
        self,
        session: SessionState,
        caller_text: str,
        decision: SupervisorDecision,
    ) -> Dict[str, Any]:
        knowledge_text = decision.fragmentText or caller_text
        follow_on = decision.followOnIntent
        knowledge_match = self.knowledge.match(session, knowledge_text)
        knowledge_result = self.knowledge.handle(session, knowledge_text)

        if knowledge_result and knowledge_match:
            self._record_knowledge_result(session, knowledge_result, knowledge_match, knowledge_text)

        if not follow_on:
            if knowledge_result:
                session.activeDomain = None
                return await self._finalize_specialist_result(session, knowledge_result)
            reply = decision.clarificationPrompt or "How can I help you today?"
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "knowledge", False)

        result = self._run_domain_specialist(session, follow_on.domain, follow_on.text)
        return await self._handle_specialist_result(
            session,
            result,
            reply_prefix=knowledge_result.nextPrompt if knowledge_result else "",
        )

    async def _run_runtime_action(
        self,
        session: SessionState,
        action_name: str,
        payload: Dict[str, Any],
    ) -> RuntimeActionOutcome:
        result, latency_ms = await self.api_client.execute_runtime_action(session.businessId, action_name, payload)
        response = result or {}
        return RuntimeActionOutcome(
            actionName=action_name,
            handledLive=bool(response.get("handledLive")),
            fallbackCreated=bool(response.get("fallbackCreated")),
            requiresStaffFollowUp=bool(response.get("requiresStaffFollowUp")),
            message=response.get("message")
            or "I wasn't able to complete that live, but the staff can follow up with you.",
            followUpTaskId=response.get("followUpTaskId"),
            fallbackReason=response.get("fallbackReason"),
            integration=response.get("integration") or {},
            data=response.get("data") or {},
            latencyMs=latency_ms,
        )

    async def _create_manual_follow_up_event(self, session: SessionState, summary: str):
        outcome = await self._run_runtime_action(
            session,
            "manual-follow-up",
            {
                "callId": session.callId,
                "callerName": session.callerName,
                "callerPhone": session.callerPhone,
                "title": "Staff follow-up requested",
                "summary": summary,
                "priority": "URGENT" if session.isEmergency else "HIGH",
            },
        )
        manual_summary = OperatorSummary(
            headline="Staff follow-up requested",
            nextStep="Review the follow-up task and contact the caller if needed.",
            specialist="handoff",
            callerRequest=summary,
            followUpRequired=True,
            handledLive=outcome.handledLive,
            fallbackReason=outcome.fallbackReason,
        )
        self._record_runtime_action_outcome(session, "handoff", "manual-follow-up", outcome, manual_summary)

    async def _sync_call_state(
        self,
        session: SessionState,
        tag: Optional[str] = None,
        status: CallLifecycleStatus | None = None,
    ):
        if not session.callId:
            return

        resolved_status = self._resolve_lifecycle_status(session, status)
        payload: Dict[str, Any] = {
            "status": resolved_status,
            "isEmergency": session.isEmergency,
            "turnCount": session.turns,
            "turnsJson": [event.model_dump() for event in session.events],
        }
        if tag is not None:
            payload["tag"] = tag
        if resolved_status in {"COMPLETED", "ABANDONED", "FAILED"}:
            payload["endedAt"] = datetime.now(timezone.utc).isoformat()

        await self.api_client.update_call_session(
            session.callId,
            payload,
        )

    def _build_turn_response(
        self,
        session: SessionState,
        reply: str,
        domain: DomainName,
        requires_confirmation: bool,
        awaiting_voicemail: bool = False,
    ) -> Dict[str, Any]:
        return {
            "sessionId": session.sessionId,
            "reply": reply,
            "domain": domain,
            "stage": session.stage,
            "intent": session.intent,
            "activeDomain": session.activeDomain,
            "requiresConfirmation": requires_confirmation,
            "awaitingVoicemail": awaiting_voicemail or session.awaitingVoicemail,
            "awaitingAnythingElse": session.awaitingAnythingElse,
            "missingSlots": list(session.missingSlots),
            "slotState": dict(session.slotState),
            "pendingAction": session.pendingConfirmation.model_dump() if session.pendingConfirmation else None,
            "assistantMessageId": self._latest_assistant_message_id(session),
            "operatorSummary": session.lastOperatorSummary.model_dump() if session.lastOperatorSummary else None,
            "closeState": session.finalCloseState.model_dump(),
            "transport": session.transport.model_dump(),
        }

    async def _begin_final_close(
        self,
        session: SessionState,
        reply: str,
        *,
        domain: DomainName,
        reason: str,
        tag: Optional[str] = None,
    ) -> Dict[str, Any]:
        session.awaitingAnythingElse = False
        session.awaitingVoicemail = False
        session.pendingConfirmation = None
        session.missingSlots = []
        session.stage = "closing"
        session.activeDomain = domain
        session.finalCloseState.active = True
        session.finalCloseState.playbackCompleted = False
        session.finalCloseState.reason = reason
        session.finalCloseState.passiveSince = None
        message = await self._append_and_persist_assistant_message(session, reply)
        session.finalCloseState.finalMessageId = message.messageId
        await self._sync_call_state(session, tag=tag or self._domain_to_tag(domain))
        return self._build_turn_response(session, reply, domain, False)

    def _record_supervisor_decision(self, session: SessionState, decision: SupervisorDecision, caller_text: str):
        session.events.append(
            SessionEvent(
                type="supervisor_decision",
                actionName=decision.mode,
                domain=decision.domain,
                operatorSummary=decision.reason,
                data={
                    "confidence": decision.confidence,
                    "reason": decision.reason,
                    "continuation": decision.continuation,
                    "callerText": caller_text,
                    "knowledgeTopic": decision.knowledgeTopic,
                    "matchedKeywords": decision.matchedKeywords,
                    "fragmentText": decision.fragmentText,
                    "followOnIntent": decision.followOnIntent.model_dump() if decision.followOnIntent else None,
                },
            )
        )

    def _record_knowledge_result(
        self,
        session: SessionState,
        result: SpecialistResult,
        knowledge_match: Any,
        caller_text: str,
    ):
        session.events.append(
            SessionEvent(
                type="knowledge_result",
                actionName="knowledge",
                domain="knowledge",
                status=result.status,
                operatorSummary=result.operatorSummary.headline if result.operatorSummary else None,
                data={
                    "callerText": caller_text,
                    "topic": knowledge_match.topic,
                    "source": knowledge_match.source,
                    "matchedKeywords": knowledge_match.matchedKeywords,
                    "routeToDomain": knowledge_match.routeToDomain,
                    "answer": result.nextPrompt,
                },
            )
        )

    def _record_specialist_result(self, session: SessionState, result: SpecialistResult):
        session.events.append(
            SessionEvent(
                type="specialist_result",
                actionName=result.runtimeAction or result.domain,
                domain=result.domain,
                status=result.status,
                operatorSummary=result.operatorSummary.headline if result.operatorSummary else None,
                requiresFollowUp=bool(result.operatorSummary and result.operatorSummary.followUpRequired),
                data={
                    "missingFields": result.missingFields,
                    "extractedFields": result.extractedFields,
                    "callerRequestSummary": result.callerRequestSummary,
                    "fallbackRecommendation": result.fallbackRecommendation,
                },
            )
        )

    def _record_runtime_action_outcome(
        self,
        session: SessionState,
        domain: DomainName,
        action_name: str,
        outcome: RuntimeActionOutcome,
        operator_summary: OperatorSummary,
    ):
        session.lastOperatorSummary = operator_summary
        session.events.append(
            SessionEvent(
                type="runtime_action_outcome",
                actionName=action_name,
                domain=domain,
                status="execute_now",
                integrationCategory=self._integration_category_for_action(action_name),
                integrationVendor=outcome.integration.get("vendor") if isinstance(outcome.integration, dict) else None,
                handledLive=outcome.handledLive,
                followUpTaskId=outcome.followUpTaskId,
                fallbackReason=outcome.fallbackReason,
                operatorSummary=operator_summary.headline,
                callerName=session.callerName,
                callerPhone=session.callerPhone,
                requiresFollowUp=operator_summary.followUpRequired,
                data={
                    "latencyMs": outcome.latencyMs,
                    "callerRequest": operator_summary.callerRequest,
                    "nextStep": operator_summary.nextStep,
                    "followUpRequired": operator_summary.followUpRequired,
                    "handledLive": outcome.handledLive,
                    "integration": outcome.integration,
                    "responseData": outcome.data,
                },
            )
        )

    def _combine_operator_summary(
        self,
        base: Optional[OperatorSummary],
        outcome: RuntimeActionOutcome,
        domain: DomainName,
        caller_request: str,
    ) -> OperatorSummary:
        if base:
            return base.model_copy(
                update={
                    "handledLive": outcome.handledLive,
                    "fallbackReason": outcome.fallbackReason,
                    "followUpRequired": outcome.requiresStaffFollowUp or base.followUpRequired,
                    "callerRequest": caller_request or base.callerRequest,
                }
            )

        return OperatorSummary(
            headline="Handled live" if outcome.handledLive else "Staff follow-up required",
            nextStep=(
                "No staff follow-up is currently required."
                if outcome.handledLive
                else "Review the linked follow-up task and complete the staff request."
            ),
            specialist=domain,
            callerRequest=caller_request,
            followUpRequired=outcome.requiresStaffFollowUp,
            handledLive=outcome.handledLive,
            fallbackReason=outcome.fallbackReason,
        )

    def _build_caller_outcome_reply(
        self,
        session: SessionState,
        domain: DomainName,
        action_name: str,
        outcome: RuntimeActionOutcome,
    ) -> str:
        handled_live = outcome.handledLive
        if domain == "scheduling":
            return (
                "Okay, I sent that appointment request to the practice."
                if handled_live
                else "Okay, I couldn't send that live, but I passed the appointment request to the practice."
            )
        if domain == "refill":
            if action_name == "manual-follow-up":
                return "Okay, I passed that refill request to the staff so they can complete it manually."
            return (
                "Okay, I sent that refill request to the practice."
                if handled_live
                else "Okay, I couldn't send that live, but I passed the refill request to the staff."
            )
        if domain == "billing":
            if action_name == "manual-follow-up":
                return "Okay, I passed that billing request to the staff so they can complete it manually."
            return (
                "Okay, I sent that billing request to the practice."
                if handled_live
                else "Okay, I couldn't send that live, but I passed the billing request to the staff."
            )
        if domain == "insurance":
            return (
                "Okay, I checked that for you."
                if handled_live
                else "Okay, I couldn't check that live, but I passed the insurance question to the staff."
            )
        if domain == "handoff":
            return (
                "Okay, I passed that request to the staff."
                if handled_live
                else "Okay, I captured that request for the staff to review."
            )
        return outcome.message or f"Okay, I handled that for {session.businessName}."

    def _clear_domain_slot_retries(self, session: SessionState, domain: DomainName):
        prefix = f"{domain}."
        for key in list(session.slotRetryCounts.keys()):
            if key.startswith(prefix):
                session.slotRetryCounts.pop(key, None)

    async def _append_and_persist_assistant_message(self, session: SessionState, reply: str):
        message = self._append_assistant_message(session, reply)
        await self._persist_transcript_segment(session, speaker="AGENT", text=reply)
        return message

    def _append_assistant_message(self, session: SessionState, reply: str) -> SessionMessage:
        message = SessionMessage(role="assistant", text=reply)
        session.messages.append(message)
        return message

    def _latest_assistant_message_id(self, session: SessionState) -> Optional[str]:
        if session.messages and session.messages[-1].role == "assistant":
            return session.messages[-1].messageId
        return None

    async def _persist_transcript_segment(
        self,
        session: SessionState,
        *,
        speaker: str,
        text: str,
        confidence: float | None = None,
    ):
        clean_text = text.strip()
        if not session.callId or not clean_text:
            return

        start_ms = session.transcriptCursorMs
        duration_ms = max(1200, min(12000, len(clean_text) * 45))
        end_ms = start_ms + duration_ms
        session.transcriptCursorMs = end_ms

        try:
            await self.api_client.save_transcript(
                session.callId,
                [
                    {
                        "speaker": speaker,
                        "text": clean_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "startTimeMs": start_ms,
                        "endTimeMs": end_ms,
                        "confidence": confidence,
                    }
                ],
            )
        except Exception:
            # Transcript persistence should not break the live call loop.
            return

    def _transport_event_snapshot(self, transport: SessionTransportMetadata) -> Dict[str, Any]:
        snapshot = transport.model_dump()
        snapshot.pop("livekitAccessToken", None)
        return snapshot

    def _offer_anything_else(self, session: SessionState, reply: str, domain: DomainName) -> str:
        if domain in {"safety", "handoff"} and (session.isEmergency or session.awaitingVoicemail):
            session.awaitingAnythingElse = False
            return reply

        session.awaitingAnythingElse = True
        session.stage = "intake"
        session.activeDomain = None
        session.intent = None
        return f"{reply} What else can I help you with today?"

    def _select_specialist(self, domain: DomainName):
        return {
            "knowledge": self.knowledge,
            "scheduling": self.scheduling,
            "refill": self.refill,
            "insurance": self.insurance,
            "billing": self.billing,
            "handoff": self.handoff,
        }.get(domain, self.knowledge)

    def _run_domain_specialist(self, session: SessionState, domain: DomainName, text: str) -> SpecialistResult:
        if domain == "handoff":
            if session.isAfterHours:
                if _contains(text, URGENT_AFTER_HOURS_KEYWORDS) and session.runtimeConfig.voicePolicyV2.afterHoursPolicy.sendUrgentToVoicemail:
                    return self.handoff.build_after_hours_urgent_reply(session, text)
                return self.handoff.build_after_hours_standard_reply(session, text)
            return self.handoff.build_manual_follow_up(text)

        specialist = self._select_specialist(domain)
        return specialist.handle(session, text)

    def _domain_to_tag(self, domain: DomainName) -> Optional[str]:
        return {
            "scheduling": "SCHEDULING",
            "refill": "PRESCRIPTION_REFILL",
            "insurance": "INSURANCE",
            "billing": "BILLING",
            "handoff": "HUMAN_TRANSFER",
        }.get(domain)

    def _current_call_tag(self, session: SessionState) -> Optional[str]:
        if session.isEmergency:
            return "EMERGENCY"
        if session.voicemailCaptureState.captured:
            return "VOICEMAIL"
        if session.lastSpecialistResult and session.lastSpecialistResult.status == "voicemail":
            return "VOICEMAIL"
        if session.activeDomain:
            return self._domain_to_tag(session.activeDomain)
        if session.completedDomains:
            return self._domain_to_tag(session.completedDomains[-1])
        return None

    def _resolve_lifecycle_status(
        self,
        session: SessionState,
        status: CallLifecycleStatus | None,
    ) -> CallLifecycleStatus:
        final_statuses = {"COMPLETED", "ABANDONED", "FAILED"}
        if session.lifecycleStatus in final_statuses and status not in final_statuses:
            return session.lifecycleStatus
        if status is not None:
            session.lifecycleStatus = status
        return session.lifecycleStatus

    def _transport_checkpoint_status(
        self,
        session: SessionState,
        event_type: str,
    ) -> CallLifecycleStatus:
        if session.lifecycleStatus in {"COMPLETED", "ABANDONED", "FAILED"}:
            return session.lifecycleStatus
        if event_type == "twilio_stream_started":
            return "ONGOING"
        return session.lifecycleStatus

    def _has_meaningful_interaction(self, session: SessionState) -> bool:
        if session.turns > 0 or session.completedDomains or session.voicemailCaptureState.captured:
            return True
        if session.pendingConfirmation or session.lastSpecialistResult:
            return True
        return any(
            event.type in {"runtime_action_outcome", "voicemail_captured", "specialist_result"}
            for event in session.events
        )

    def _determine_terminal_status(
        self,
        session: SessionState,
        failure_reason: str | None,
    ) -> CallLifecycleStatus:
        if failure_reason:
            return "FAILED"
        if not self._has_meaningful_interaction(session):
            return "ABANDONED"
        return "COMPLETED"

    def _integration_category_for_action(self, action_name: Optional[str]) -> str:
        return {
            "appointment-request": "SCHEDULING",
            "refill-request": "EHR_REFILL",
            "insurance-check": "INSURANCE",
            "billing-request": "BILLING",
            "manual-follow-up": "MANUAL",
        }.get(action_name or "", "MANUAL")

    def _is_business_open(self, runtime_config: RuntimeConfigBootstrap) -> bool:
        operating_hours = runtime_config.settings.get("operatingHours") or []
        if not operating_hours:
            return True

        try:
            now_local = datetime.now(ZoneInfo(runtime_config.business.timeZone))
        except ZoneInfoNotFoundError:
            now_local = datetime.now(timezone.utc)

        day_of_week = int(now_local.strftime("%w"))
        current_time = now_local.strftime("%H:%M")
        for entry in operating_hours:
            if entry.get("dayOfWeek") != day_of_week:
                continue
            if entry.get("isClosed"):
                return False
            start_time = entry.get("startTime")
            end_time = entry.get("endTime")
            if not start_time or not end_time:
                return False
            return start_time <= current_time <= end_time
        return False
