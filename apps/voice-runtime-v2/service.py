"""
Voice Runtime V2 orchestration service.
"""
from __future__ import annotations

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
from providers import DeepgramSttAdapter, LiveKitTransportAdapter, ManagedTtsAdapter, ReasoningAdapter


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())


def _contains(text: str, keywords: list[str]) -> bool:
    lowered = _normalize(text)
    return any(keyword in lowered for keyword in keywords)


class VoiceRuntimeV2:
    def __init__(self, api_client: Optional[CoreApiClient] = None):
        self.api_client = api_client or CoreApiClient()
        self.sessions: Dict[str, SessionState] = {}
        self.livekit = LiveKitTransportAdapter()
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
        self._append_assistant_message(session, greeting)
        session.events.append(
            SessionEvent(
                type="session_bootstrap",
                actionName="voice-runtime-v2",
                domain="knowledge",
                integrationCategory="TRANSPORT",
                operatorSummary="Voice Runtime V2 session started.",
                data={
                    "transport": transport.model_dump(),
                    "providers": self.readiness(),
                },
            )
        )
        self.sessions[session.sessionId] = session
        await self._sync_call_state(session)
        return session

    def get_session(self, session_id: str) -> SessionState:
        session = self.sessions.get(session_id)
        if not session:
            raise KeyError(f"Unknown session: {session_id}")
        return session

    def readiness(self) -> Dict[str, Dict[str, str | bool]]:
        return {
            "livekit": self.livekit.validate(),
            "deepgram": self.deepgram.validate(),
            "tts": self.tts.validate(),
            "reasoning": self.reasoning.validate(),
        }

    async def process_text_turn(self, session_id: str, text: str) -> Dict[str, Any]:
        session = self.get_session(session_id)
        cleaned_text = text.strip()
        session.turns += 1
        session.messages.append(SessionMessage(role="caller", text=cleaned_text))

        if session.awaitingAnythingElse:
            continuation = await self._handle_anything_else(session, cleaned_text)
            if continuation is not None:
                return continuation

        if session.awaitingVoicemail:
            reply = "I'm ready to capture your voicemail whenever you're ready. Please leave your message after the tone."
            self._append_assistant_message(session, reply)
            await self._sync_call_state(session, tag="VOICEMAIL")
            return self._build_turn_response(session, reply, "handoff", False, awaiting_voicemail=True)

        safety_result = self.safety.evaluate(session, cleaned_text)
        if safety_result:
            if safety_result.requestHumanFollowUp:
                await self._create_manual_follow_up_event(
                    session,
                    safety_result.operatorSummary.headline if safety_result.operatorSummary else cleaned_text,
                )
                session.lastOperatorSummary = safety_result.operatorSummary
            return await self._finalize_specialist_result(session, safety_result)

        if session.pendingAction:
            return await self._handle_pending_action(session, cleaned_text)

        decision = self.supervisor.choose_domain(session, cleaned_text)
        session.lastDecision = decision
        session.activeDomain = decision.domain if decision.mode != "clarify" else None
        self._record_supervisor_decision(session, decision, cleaned_text)

        if decision.mode == "clarify":
            reply = decision.clarificationPrompt or "How can I help you today?"
            self._append_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "knowledge", False)

        if decision.mode == "knowledge":
            knowledge_result = self.knowledge.handle(session, cleaned_text)
            if knowledge_result:
                session.activeDomain = None
                return await self._finalize_specialist_result(session, knowledge_result)

        if session.isAfterHours and decision.domain not in {"knowledge", "safety"}:
            if _contains(cleaned_text, URGENT_AFTER_HOURS_KEYWORDS) and session.runtimeConfig.voicePolicyV2.afterHoursPolicy.sendUrgentToVoicemail:
                session.activeDomain = "handoff"
                return await self._handle_specialist_result(
                    session,
                    self.handoff.build_after_hours_urgent_reply(session, cleaned_text),
                )

            after_hours_result = self.handoff.build_after_hours_standard_reply(session, cleaned_text)
            if after_hours_result.status == "execute_now":
                return await self._handle_specialist_result(session, after_hours_result)

            session.activeDomain = "handoff"
            return await self._handle_specialist_result(session, after_hours_result)

        specialist = self._select_specialist(decision.domain)
        result = specialist.handle(session, cleaned_text)
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
        session.stage = "completed"
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
        await self._sync_call_state(session, tag="VOICEMAIL", status="COMPLETED")
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
            session.transport.providerSessionId = provider_session_id

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
            return {
                "sessionId": session.sessionId,
                "accepted": True,
                "final": False,
                "transport": session.transport.model_dump(),
            }

        return await self.process_text_turn(session_id, text)

    def record_transport_event(
        self,
        session_id: str,
        event_type: str,
        payload: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        session = self.get_session(session_id)
        session.events.append(
            SessionEvent(
                type="transport_event",
                actionName=event_type,
                domain=session.activeDomain,
                integrationCategory="TRANSPORT",
                data=payload or {},
            )
        )
        return {
            "sessionId": session.sessionId,
            "accepted": True,
            "eventType": event_type,
            "transport": session.transport.model_dump(),
        }

    async def _handle_anything_else(self, session: SessionState, text: str) -> Optional[Dict[str, Any]]:
        lowered = _normalize(text)
        if lowered in {"no", "nope", "nothing else", "that's all", "that is all", "thanks", "thank you"}:
            session.awaitingAnythingElse = False
            session.stage = "completed"
            reply = f"Thanks for calling {session.businessName}. Take care."
            self._append_assistant_message(session, reply)
            await self._sync_call_state(session, status="COMPLETED")
            return self._build_turn_response(session, reply, "knowledge", False)

        if lowered in {"yes", "yeah", "yep", "sure", "okay"}:
            session.awaitingAnythingElse = False
            session.stage = "intake"
            reply = "Of course. What else can I help you with today?"
            self._append_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "knowledge", False)

        session.awaitingAnythingElse = False
        session.stage = "intake"
        return None

    async def _handle_specialist_result(self, session: SessionState, result: SpecialistResult) -> Dict[str, Any]:
        session.lastSpecialistResult = result
        session.lastOperatorSummary = result.operatorSummary
        self._record_specialist_result(session, result)

        if result.status == "needs_information":
            session.stage = "intake"
            return await self._finalize_specialist_result(session, result)

        if result.status == "ready_for_confirmation":
            session.pendingAction = PendingAction(
                actionName=result.runtimeAction or "",
                summary=result.confirmationSummary or result.nextPrompt,
                payload=result.runtimePayload,
                domain=result.domain,
                callerRequestSummary=result.callerRequestSummary or result.confirmationSummary or result.nextPrompt,
                fallbackRecommendation=result.fallbackRecommendation,
            )
            session.stage = "confirmation"
            return await self._finalize_specialist_result(
                session,
                result,
                requires_confirmation=True,
            )

        if result.status == "execute_now":
            return await self._execute_specialist_result(session, result)

        if result.status == "voicemail":
            session.awaitingVoicemail = True
            session.stage = "voicemail"
            return await self._finalize_specialist_result(
                session,
                result,
                awaiting_voicemail=True,
            )

        return await self._finalize_specialist_result(session, result)

    async def _finalize_specialist_result(
        self,
        session: SessionState,
        result: SpecialistResult,
        requires_confirmation: bool = False,
        awaiting_voicemail: bool = False,
    ) -> Dict[str, Any]:
        reply = result.nextPrompt
        if result.resolved and not awaiting_voicemail and not session.isEmergency:
            reply = self._offer_anything_else(session, reply, result.domain)
        else:
            session.awaitingAnythingElse = False

        self._append_assistant_message(session, reply)
        await self._sync_call_state(session, tag=self._domain_to_tag(result.domain))
        return self._build_turn_response(
            session,
            reply,
            result.domain,
            requires_confirmation,
            awaiting_voicemail=awaiting_voicemail,
        )

    async def _handle_pending_action(self, session: SessionState, text: str) -> Dict[str, Any]:
        pending = session.pendingAction
        if not pending:
            return self._build_turn_response(session, "What would you like to do next?", "knowledge", False)

        lowered = _normalize(text)
        if any(keyword in lowered for keyword in ["repeat", "summarize", "what are you confirming", "say that again"]):
            pending.confirmAttempts += 1
            reply = f"To confirm, {pending.summary}. Say yes to submit it, or tell me what you want to change."
            self._append_assistant_message(session, reply)
            return self._build_turn_response(session, reply, pending.domain, True)

        if any(keyword in lowered for keyword in ["actually", "change", "wrong", "not that", "wait"]):
            pending.requestedChanges.append(text.strip())
            session.pendingAction = None
            session.activeDomain = pending.domain
            session.stage = "intake"
            reply = f"Okay, let's update that {pending.domain} request. Tell me the corrected details."
            self._append_assistant_message(session, reply)
            return self._build_turn_response(session, reply, pending.domain, False)

        if any(keyword in lowered for keyword in ["yes", "yeah", "yep", "correct", "confirm"]):
            return await self._execute_pending_action(session)

        if any(keyword in lowered for keyword in ["no", "cancel", "stop", "not now"]):
            session.pendingAction = None
            session.stage = "intake"
            reply = self._offer_anything_else(session, "Okay, I won't submit that.", pending.domain)
            self._append_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, pending.domain, False)

        pending.confirmAttempts += 1
        reply = f"Please say yes to confirm, or tell me what you want to change about {pending.summary}."
        self._append_assistant_message(session, reply)
        return self._build_turn_response(session, reply, pending.domain, True)

    async def _execute_pending_action(self, session: SessionState) -> Dict[str, Any]:
        pending = session.pendingAction
        if not pending:
            raise ValueError("No pending action to execute")

        outcome = await self._run_runtime_action(
            session,
            pending.actionName,
            {**pending.payload, "callId": session.callId},
        )
        session.pendingAction = None
        session.completedDomains.append(pending.domain)
        enriched_summary = self._combine_operator_summary(
            base=session.lastOperatorSummary,
            outcome=outcome,
            domain=pending.domain,
            caller_request=pending.callerRequestSummary,
        )
        self._record_runtime_action_outcome(session, pending.domain, pending.actionName, outcome, enriched_summary)
        reply = self._offer_anything_else(session, outcome.message, pending.domain)
        self._append_assistant_message(session, reply)
        await self._sync_call_state(session, tag=self._domain_to_tag(pending.domain))
        return self._build_turn_response(session, reply, pending.domain, False)

    async def _execute_specialist_result(self, session: SessionState, result: SpecialistResult) -> Dict[str, Any]:
        if not result.runtimeAction:
            return await self._finalize_specialist_result(session, result)

        outcome = await self._run_runtime_action(
            session,
            result.runtimeAction,
            {**result.runtimePayload, "callId": session.callId},
        )
        session.completedDomains.append(result.domain)
        enriched_summary = self._combine_operator_summary(
            base=result.operatorSummary,
            outcome=outcome,
            domain=result.domain,
            caller_request=result.callerRequestSummary or result.nextPrompt,
        )
        self._record_runtime_action_outcome(session, result.domain, result.runtimeAction, outcome, enriched_summary)
        reply = self._offer_anything_else(session, outcome.message, result.domain)
        self._append_assistant_message(session, reply)
        await self._sync_call_state(session, tag=self._domain_to_tag(result.domain))
        return self._build_turn_response(session, reply, result.domain, False)

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
        status: str = "ONGOING",
    ):
        if not session.callId:
            return
        await self.api_client.update_call_session(
            session.callId,
            {
                "status": status,
                "tag": tag,
                "isEmergency": session.isEmergency,
                "detectedIntent": session.activeDomain.upper() if session.activeDomain else None,
                "turnCount": session.turns,
                "turnsJson": [event.model_dump() for event in session.events],
                "endedAt": datetime.now(timezone.utc).isoformat() if status == "COMPLETED" else None,
            },
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
            "activeDomain": session.activeDomain,
            "requiresConfirmation": requires_confirmation,
            "awaitingVoicemail": awaiting_voicemail,
            "awaitingAnythingElse": session.awaitingAnythingElse,
            "pendingAction": session.pendingAction.model_dump() if session.pendingAction else None,
            "operatorSummary": session.lastOperatorSummary.model_dump() if session.lastOperatorSummary else None,
            "transport": session.transport.model_dump(),
        }

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

    def _append_assistant_message(self, session: SessionState, reply: str):
        session.messages.append(SessionMessage(role="assistant", text=reply))

    def _offer_anything_else(self, session: SessionState, reply: str, domain: DomainName) -> str:
        if domain in {"safety", "handoff"} and (session.isEmergency or session.awaitingVoicemail):
            session.awaitingAnythingElse = False
            return reply

        session.awaitingAnythingElse = True
        session.stage = "intake"
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

    def _domain_to_tag(self, domain: DomainName) -> Optional[str]:
        return {
            "scheduling": "SCHEDULING",
            "refill": "PRESCRIPTION_REFILL",
            "insurance": "INSURANCE",
            "billing": "BILLING",
            "handoff": "HUMAN_TRANSFER",
        }.get(domain)

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
