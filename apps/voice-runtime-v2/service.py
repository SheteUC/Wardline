"""
Voice Runtime V2 orchestration service.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from agents import (
    HandoffAgent,
    InsuranceAgent,
    KnowledgeAgent,
    RefillAgent,
    SafetyAgent,
    SchedulingAgent,
    BillingAgent,
    SupervisorAgent,
    URGENT_AFTER_HOURS_KEYWORDS,
)
from core_api_client import CoreApiClient
from models import PendingAction, RuntimeConfigBootstrap, SessionEvent, SessionMessage, SessionState
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

        runtime_config = RuntimeConfigBootstrap.model_validate(runtime_config_payload)
        call_data = await self.api_client.create_call_session(
            {
                "direction": "INBOUND",
                "fromNumber": caller_phone,
                "toNumber": called_phone,
                "twilioCallSid": call_sid,
            }
        )

        session = SessionState(
            sessionId=str(uuid.uuid4()),
            callSid=call_sid,
            callId=call_data.get("id") if call_data else None,
            businessId=runtime_config.business.id,
            callerPhone=caller_phone,
            calledPhone=called_phone,
            businessName=runtime_config.business.name,
            runtimeConfig=runtime_config,
            isAfterHours=not self._is_business_open(runtime_config),
        )
        greeting = (
            f"Thank you for calling {runtime_config.business.name}. "
            "I'm Wardline, your virtual receptionist. How can I help you today?"
        )
        session.messages.append(SessionMessage(role="assistant", text=greeting))
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
        session.turns += 1
        session.messages.append(SessionMessage(role="caller", text=text))

        safety_result = self.safety.evaluate(session, text)
        if safety_result:
            if safety_result.requestHumanFollowUp:
                await self._create_manual_follow_up_event(session, safety_result.operatorSummary or text)
            session.messages.append(SessionMessage(role="assistant", text=safety_result.reply))
            await self._sync_call_state(session, tag="EMERGENCY" if session.isEmergency else "HUMAN_TRANSFER")
            return self._build_turn_response(session, safety_result.reply, safety_result.domain, True)

        if session.pendingAction:
            return await self._handle_pending_action(session, text)

        knowledge_result = self.knowledge.handle(session, text)
        if knowledge_result:
            session.activeDomain = None
            session.messages.append(SessionMessage(role="assistant", text=knowledge_result.reply))
            await self._sync_call_state(session)
            return self._build_turn_response(session, knowledge_result.reply, knowledge_result.domain, False)

        if session.isAfterHours and _contains(text, URGENT_AFTER_HOURS_KEYWORDS):
            handoff_result = self.handoff.build_after_hours_urgent_reply(session)
            session.awaitingVoicemail = True
            session.activeDomain = "handoff"
            session.messages.append(SessionMessage(role="assistant", text=handoff_result.reply))
            await self._sync_call_state(session, tag="VOICEMAIL")
            return self._build_turn_response(
                session,
                handoff_result.reply,
                handoff_result.domain,
                False,
                awaiting_voicemail=True,
            )

        domain = self.supervisor.choose_domain(session, text)
        session.activeDomain = domain

        if domain == "handoff":
            result = self.handoff.build_manual_follow_up(text)
        elif domain == "scheduling":
            result = self.scheduling.handle(session, text)
        elif domain == "refill":
            result = self.refill.handle(session, text)
        elif domain == "insurance":
            result = self.insurance.handle(session, text)
        elif domain == "billing":
            result = self.billing.handle(session, text)
        else:
            result = self.knowledge.handle(session, text) or self.handoff.build_manual_follow_up(text)

        if result.runtimeAction and result.confirmationSummary and result.runtimeAction in session.runtimeConfig.voicePolicyV2.writeActionsRequiringConfirmation:
            session.pendingAction = PendingAction(
                actionName=result.runtimeAction,
                summary=result.confirmationSummary,
                payload=result.runtimePayload,
                domain=result.domain,
            )
        elif result.runtimeAction:
            return await self._execute_specialist_result(session, result)

        session.messages.append(SessionMessage(role="assistant", text=result.reply))
        await self._sync_call_state(session, tag=self._domain_to_tag(result.domain))
        return self._build_turn_response(
            session,
            result.reply,
            result.domain,
            bool(session.pendingAction),
            awaiting_voicemail=session.awaitingVoicemail,
        )

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
        await self._sync_call_state(session, tag="VOICEMAIL", status="COMPLETED")
        return result or {"accepted": True}

    async def _handle_pending_action(self, session: SessionState, text: str) -> Dict[str, Any]:
        pending = session.pendingAction
        if not pending:
            return self._build_turn_response(session, "What would you like to do next?", "supervisor", False)

        lowered = _normalize(text)
        if any(keyword in lowered for keyword in ["repeat", "summarize", "what are you confirming", "say that again"]):
            reply = f"To confirm, {pending.summary}. Say yes to submit it, or tell me what you want to change."
            session.messages.append(SessionMessage(role="assistant", text=reply))
            return self._build_turn_response(session, reply, "supervisor", True)

        if any(keyword in lowered for keyword in ["actually", "change", "wrong", "not that", "wait"]):
            session.pendingAction = None
            session.activeDomain = pending.domain
            reply = f"Okay, let's update that {pending.domain} request. Tell me the corrected details."
            session.messages.append(SessionMessage(role="assistant", text=reply))
            return self._build_turn_response(session, reply, pending.domain, False)

        if any(keyword in lowered for keyword in ["yes", "yeah", "yep", "correct", "confirm"]):
            return await self._execute_pending_action(session)

        if any(keyword in lowered for keyword in ["no", "cancel", "stop", "not now"]):
            session.pendingAction = None
            reply = "Okay, I won't submit that. What else can I help you with today?"
            session.messages.append(SessionMessage(role="assistant", text=reply))
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "supervisor", False)

        reply = f"Please say yes to confirm, or tell me what you want to change about {pending.summary}."
        session.messages.append(SessionMessage(role="assistant", text=reply))
        return self._build_turn_response(session, reply, "supervisor", True)

    async def _execute_pending_action(self, session: SessionState) -> Dict[str, Any]:
        pending = session.pendingAction
        if not pending:
            raise ValueError("No pending action to execute")

        result, latency_ms = await self.api_client.execute_runtime_action(
            session.businessId,
            pending.actionName,
            {
                **pending.payload,
                "callId": session.callId,
            },
        )

        event = SessionEvent(
            type="runtime_action_outcome",
            actionName=pending.actionName,
            integrationCategory=self._integration_category_for_action(pending.actionName),
            handledLive=bool(result and result.get("handledLive")),
            followUpTaskId=result.get("followUpTaskId") if result else None,
            fallbackReason=(result.get("fallbackReason") or result.get("message")) if result and not result.get("handledLive") else None,
            callerName=session.callerName,
            callerPhone=session.callerPhone,
            data={"latencyMs": latency_ms, "domain": pending.domain},
        )
        session.events.append(event)
        session.pendingAction = None

        reply = (
            result.get("message")
            if result
            else "I wasn't able to complete that right now, but the staff can follow up with you."
        )
        session.messages.append(SessionMessage(role="assistant", text=reply))
        await self._sync_call_state(session, tag=self._domain_to_tag(pending.domain))
        return self._build_turn_response(session, reply, pending.domain, False)

    async def _execute_specialist_result(self, session: SessionState, result) -> Dict[str, Any]:
        api_result, latency_ms = await self.api_client.execute_runtime_action(
            session.businessId,
            result.runtimeAction,
            {
                **result.runtimePayload,
                "callId": session.callId,
            },
        )
        event = SessionEvent(
            type="runtime_action_outcome",
            actionName=result.runtimeAction or "manual-follow-up",
            integrationCategory=self._integration_category_for_action(result.runtimeAction),
            handledLive=bool(api_result and api_result.get("handledLive")),
            followUpTaskId=api_result.get("followUpTaskId") if api_result else None,
            fallbackReason=(api_result.get("fallbackReason") or api_result.get("message")) if api_result and not api_result.get("handledLive") else None,
            callerName=session.callerName,
            callerPhone=session.callerPhone,
            data={"latencyMs": latency_ms, "domain": result.domain},
        )
        session.events.append(event)
        reply = api_result.get("message") if api_result else result.reply
        session.messages.append(SessionMessage(role="assistant", text=reply))
        await self._sync_call_state(session, tag=self._domain_to_tag(result.domain))
        return self._build_turn_response(session, reply, result.domain, False)

    async def _create_manual_follow_up_event(self, session: SessionState, summary: str):
        result, latency_ms = await self.api_client.execute_runtime_action(
            session.businessId,
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
        session.events.append(
            SessionEvent(
                type="runtime_action_outcome",
                actionName="manual-follow-up",
                integrationCategory="MANUAL",
                handledLive=bool(result and result.get("handledLive")),
                followUpTaskId=result.get("followUpTaskId") if result else None,
                fallbackReason=result.get("message") if result else None,
                callerName=session.callerName,
                callerPhone=session.callerPhone,
                data={"latencyMs": latency_ms, "domain": "handoff"},
            )
        )

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
                "turnCount": session.turns,
                "turnsJson": [event.model_dump() for event in session.events],
            },
        )

    def _build_turn_response(
        self,
        session: SessionState,
        reply: str,
        domain: str,
        requires_confirmation: bool,
        awaiting_voicemail: bool = False,
    ) -> Dict[str, Any]:
        return {
            "sessionId": session.sessionId,
            "reply": reply,
            "domain": domain,
            "requiresConfirmation": requires_confirmation,
            "awaitingVoicemail": awaiting_voicemail,
            "pendingAction": session.pendingAction.model_dump() if session.pendingAction else None,
            "transport": self.livekit.build_dispatch_metadata(session.sessionId, session.businessId),
        }

    def _domain_to_tag(self, domain: str) -> Optional[str]:
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
