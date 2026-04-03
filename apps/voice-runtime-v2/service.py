"""
Voice Runtime V2 orchestration service.
"""
from __future__ import annotations

import asyncio
import re
import secrets
import time
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import ValidationError
from config import settings

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
    _enabled_service_labels,
)
from llm_agents import run_llm_agent
from llm_safety import assess_safety_llm
from llm_slots import extract_slots_llm, merge_slots_conservative
from llm_supervisor import route_turn_llm
from core_api_client import CoreApiClient
from observability.metrics import turn_processing_seconds
from models import (
    CallBootstrapResponse,
    CallLifecycleStatus,
    CallerContext,
    DetectedIntent,
    DomainName,
    HandoffSlotState,
    KnownInsurance,
    OperatorSummary,
    PendingAction,
    RecentCallSummary,
    RuntimeActionOutcome,
    RuntimeConfigBootstrap,
    SessionEvent,
    SessionMessage,
    SessionState,
    SessionTransportMetadata,
    SpecialistResult,
    SupervisorDecision,
    TransferAttemptState,
)
from preflight import build_real_call_preflight_report
from session_store import SessionStore
from providers import (
    DeepgramSttAdapter,
    LiveKitTransportAdapter,
    ManagedTtsAdapter,
    ReasoningAdapter,
    TwilioTelephonyAdapter,
    build_public_callback_url,
)
from observability.logging_setup import get_logger

logger = get_logger(__name__)


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
        self._local_session_locks: dict[str, asyncio.Lock] = {}
        self._session_lru: OrderedDict[str, None] = OrderedDict()
        self._redis = None
        redis_url = (settings.redis_url or "").strip()
        if redis_url:
            from redis.asyncio import Redis

            self._redis = Redis.from_url(redis_url, decode_responses=True)
        self._session_store = SessionStore(
            redis_client=self._redis,
            ttl_seconds=settings.voice_session_ttl_seconds,
        )
        self._shutting_down = False
        self._drain_lock = asyncio.Lock()
        self._inflight_turns = 0
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

    def begin_shutdown(self) -> None:
        self._shutting_down = True

    async def wait_for_inflight(self, timeout_s: float | None = None) -> None:
        limit = timeout_s if timeout_s is not None else settings.voice_shutdown_drain_seconds
        deadline = time.monotonic() + max(0.1, float(limit))
        while True:
            async with self._drain_lock:
                if self._inflight_turns <= 0:
                    return
            if time.monotonic() >= deadline:
                logger.warning(
                    "shutdown_drain_timeout",
                    inflight_operations=self._inflight_turns,
                )
                return
            await asyncio.sleep(0.05)

    def _touch_session_lru(self, session_id: str) -> None:
        self._session_lru.pop(session_id, None)
        self._session_lru[session_id] = None

    def _evict_cached_sessions_if_needed(self) -> None:
        max_n = settings.voice_session_max_cached
        if len(self.sessions) <= max_n:
            return
        for sid in list(self._session_lru.keys()):
            if len(self.sessions) <= max_n:
                break
            s = self.sessions.get(sid)
            if s and s.stage == "completed":
                self.sessions.pop(sid, None)
                self._session_lru.pop(sid, None)

    async def _resolve_session(self, session_id: str) -> SessionState:
        if self._redis:
            remote = await self._session_store.load(session_id)
            if remote:
                self.sessions[session_id] = remote
                return remote
        session = self.sessions.get(session_id)
        if not session:
            raise KeyError(f"Unknown session: {session_id}")
        return session

    @asynccontextmanager
    async def _exclusive_session(
        self,
        session_id: str,
        *,
        persist: bool = True,
    ) -> AsyncGenerator[SessionState, None]:
        async with self._drain_lock:
            if self._shutting_down:
                raise RuntimeError("Voice runtime is shutting down")
            self._inflight_turns += 1
        try:
            local_lock = self._local_session_locks.setdefault(session_id, asyncio.Lock())
            async with local_lock:
                if self._redis:
                    dist = self._redis.lock(
                        f"wardline:v2:mut:{session_id}",
                        timeout=120,
                        blocking_timeout=settings.voice_session_lock_blocking_seconds,
                    )
                    async with dist:
                        session = await self._resolve_session(session_id)
                        try:
                            yield session
                        finally:
                            if persist:
                                await self._session_store.save(session)
                            self._touch_session_lru(session_id)
                            self._evict_cached_sessions_if_needed()
                else:
                    session = await self._resolve_session(session_id)
                    try:
                        yield session
                    finally:
                        if persist:
                            await self._session_store.save(session)
                        self._touch_session_lru(session_id)
                        self._evict_cached_sessions_if_needed()
        finally:
            async with self._drain_lock:
                self._inflight_turns -= 1

    async def close(self):
        await self.api_client.close()
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    def real_call_preflight(self) -> Dict[str, Any]:
        return build_real_call_preflight_report()

    async def build_twilio_bootstrap_response(self, session_id: str) -> str:
        async with self._exclusive_session(session_id) as session:
            return self._build_twilio_bootstrap_for_session(session)

    def _build_twilio_bootstrap_for_session(self, session: SessionState) -> str:
        if not session.transport.twilioMediaStreamUrl:
            raise ValueError(
                "WEBHOOK_BASE_URL, VOICE_RUNTIME_V2_PUBLIC_URL, or RENDER_EXTERNAL_URL must be configured for Twilio cutover"
            )

        return self.twilio.build_stream_twiml(
            stream_url=session.transport.twilioMediaStreamUrl,
            parameters={
                "sessionId": session.sessionId,
                "streamToken": session.mediaStreamToken,
                "callId": session.callId or "",
                "businessId": session.businessId,
                "roomName": session.transport.roomName,
                "participantIdentity": session.transport.participantIdentity,
                "providerSessionId": session.transport.providerSessionId or "",
            },
        )

    async def start_session(self, call_sid: str, caller_phone: str, called_phone: str) -> SessionState:
        bootstrap_payload = await self.api_client.bootstrap_voice_session(
            {
                "direction": "INBOUND",
                "fromNumber": caller_phone,
                "toNumber": called_phone,
                "twilioCallSid": call_sid,
            }
        )
        if not bootstrap_payload:
            raise ValueError(f"Unable to bootstrap a call session for phone {called_phone}")

        try:
            bootstrap = CallBootstrapResponse.model_validate(bootstrap_payload)
        except ValidationError as error:
            raise ValueError(
                f"Runtime bootstrap for phone {called_phone} is invalid for Voice Runtime V2: {error}"
            ) from error

        runtime_config = RuntimeConfigBootstrap.model_validate(bootstrap.model_dump())
        session_id = str(uuid.uuid4())
        transport = SessionTransportMetadata.model_validate(
            self.livekit.build_dispatch_metadata(
                session_id=session_id,
                business_id=bootstrap.business.id,
                call_sid=call_sid,
            ),
        )

        caller_ctx = await self._fetch_caller_context(bootstrap.business.id, caller_phone)

        session = SessionState(
            sessionId=session_id,
            callSid=call_sid,
            callId=bootstrap.callId,
            businessId=bootstrap.business.id,
            callerPhone=caller_phone,
            calledPhone=called_phone,
            businessName=bootstrap.business.name,
            runtimeConfig=runtime_config,
            transport=transport,
            callerContext=caller_ctx,
            callerName=caller_ctx.callerName if caller_ctx else None,
            isAfterHours=not self._is_business_open(runtime_config),
            mediaStreamToken=secrets.token_urlsafe(32),
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
        await self._session_store.save(session)
        self._touch_session_lru(session.sessionId)
        self._evict_cached_sessions_if_needed()
        return session

    async def get_session_dump(self, session_id: str) -> dict:
        async with self._exclusive_session(session_id) as session:
            return session.model_dump()

    async def update_transport_metadata(self, session_id: str, **updates: Any) -> SessionState:
        async with self._exclusive_session(session_id) as session:
            transport_update = {key: value for key, value in updates.items() if value is not None}
            if transport_update:
                session.transport = session.transport.model_copy(update=transport_update)
            return session

    async def authorize_twilio_media_and_sync_transport(
        self,
        session_id: str,
        *,
        stream_token: str,
        provider_session_id: str | None,
        twilio_stream_sid: str | None,
    ) -> tuple[str, Optional[str]]:
        async with self._exclusive_session(session_id) as session:
            expected = getattr(session, "mediaStreamToken", "") or ""
            if not expected or stream_token != expected:
                raise PermissionError("invalid_stream_token")
            transport_update: Dict[str, Any] = {}
            if provider_session_id:
                transport_update["providerSessionId"] = provider_session_id
            if twilio_stream_sid:
                transport_update["twilioStreamSid"] = twilio_stream_sid
            if transport_update:
                session.transport = session.transport.model_copy(update=transport_update)
            if not session.messages:
                return "", None
            last = session.messages[-1]
            return last.text, getattr(last, "messageId", None)

    def readiness(self) -> Dict[str, Dict[str, str | bool]]:
        return {
            "livekit": self.livekit.validate(),
            "deepgram": self.deepgram.validate(),
            "tts": self.tts.validate(),
            "reasoning": self.reasoning.validate(),
        }

    async def check_redis_readiness(self) -> Dict[str, Any]:
        if not self._redis:
            return {"ok": True, "detail": "not_configured"}
        try:
            pong = await self._redis.ping()
            ok = pong is True or pong == "PONG"
            return {"ok": ok, "detail": str(pong)}
        except Exception as exc:
            return {"ok": False, "detail": str(exc)}

    async def check_core_api_readiness(self) -> Dict[str, Any]:
        from observability.context import outbound_headers

        try:
            base = self.api_client.base_url.rstrip("/")
            url = f"{base}/health"
            response = await self.api_client.client.get(url, headers=outbound_headers(), timeout=3.0)
            return {"ok": response.status_code == 200, "status": response.status_code}
        except Exception as exc:
            return {"ok": False, "detail": str(exc)}

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
        async with self._exclusive_session(session_id) as session:
            await self._persist_transcript_segment(session, speaker=speaker, text=text, confidence=confidence)

    async def finalize_session(self, session_id: str, failure_reason: str | None = None) -> None:
        async with self._exclusive_session(session_id, persist=False) as session:
            session.awaitingAnythingElse = False
            session.awaitingVoicemail = False
            self._clear_priority_prompt(session)
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
        await self._session_store.delete(session_id)
        self.sessions.pop(session_id, None)
        self._session_lru.pop(session_id, None)
        self._local_session_locks.pop(session_id, None)

    async def process_text_turn(self, session_id: str, text: str) -> Dict[str, Any]:
        started = time.perf_counter()
        try:
            async with self._exclusive_session(session_id) as session:
                return await self._process_text_turn_for_session(session, text)
        finally:
            turn_processing_seconds.observe(time.perf_counter() - started)

    async def _process_text_turn_for_session(self, session: SessionState, text: str) -> Dict[str, Any]:
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
            return await self._handle_safety_result(session, cleaned_text, safety_result)

        if session.awaitingIntentPriority:
            safety_result = await assess_safety_llm(session, cleaned_text)
            if safety_result:
                return await self._handle_safety_result(session, cleaned_text, safety_result)
            return await self._handle_intent_priority(session, cleaned_text)

        if session.pendingConfirmation:
            llm_safety_task = asyncio.create_task(assess_safety_llm(session, cleaned_text))
            pending_interrupt_decision = await self._choose_domain(session, cleaned_text)
            safety_result = await llm_safety_task
            if safety_result:
                return await self._handle_safety_result(session, cleaned_text, safety_result)
            self._apply_llm_slot_enrichment(session, pending_interrupt_decision)
            if (
                self._actionable_detected_intents(pending_interrupt_decision)
                and any(intent.domain != session.pendingConfirmation.domain for intent in pending_interrupt_decision.detectedIntents)
            ):
                session.lastDecision = pending_interrupt_decision
                self._record_supervisor_decision(session, pending_interrupt_decision, cleaned_text)
                interrupt_response = await self._handle_multi_intent_decision(
                    session,
                    cleaned_text,
                    pending_interrupt_decision,
                )
                if interrupt_response is not None:
                    return interrupt_response
            return await self._handle_pending_action(session, cleaned_text)

        llm_safety_task = asyncio.create_task(assess_safety_llm(session, cleaned_text))
        decision = await self._choose_domain(session, cleaned_text)
        safety_result = await llm_safety_task
        if safety_result:
            return await self._handle_safety_result(session, cleaned_text, safety_result)
        self._apply_llm_slot_enrichment(session, decision)
        session.lastDecision = decision
        self._record_supervisor_decision(session, decision, cleaned_text)

        multi_intent_response = await self._handle_multi_intent_decision(session, cleaned_text, decision)
        if multi_intent_response is not None:
            return multi_intent_response

        if decision.mode == "clarify":
            session.intent = decision.domain
            session.activeDomain = None
            reply = decision.clarificationPrompt or "How can I help you today?"
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "knowledge", False)

        if decision.mode == "knowledge":
            if decision.followOnIntent:
                return await self._handle_compound_knowledge_follow_on(session, cleaned_text, decision)

            session.intent = decision.domain
            knowledge_result = self.knowledge.handle(session, decision.fragmentText or cleaned_text)
            if knowledge_result:
                session.activeDomain = None
                return await self._finalize_specialist_result(session, knowledge_result)
            services = _enabled_service_labels(session)
            reply = (
                f"I didn't quite catch that. I can help with {services}, "
                "or I can take a message for the staff. What would you like?"
            )
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session)
            return self._build_turn_response(session, reply, "knowledge", False)

        session.intent = decision.domain
        session.activeDomain = decision.domain
        result = await self._run_domain_specialist(session, decision.domain, cleaned_text)
        return await self._handle_specialist_result(session, result)

    async def capture_voicemail(
        self,
        session_id: str,
        recording_url: str,
        transcription: str | None = None,
    ) -> Dict[str, Any]:
        async with self._exclusive_session(session_id) as session:
            return await self._capture_voicemail_for_session(session, recording_url, transcription)

    async def _capture_voicemail_for_session(
        self,
        session: SessionState,
        recording_url: str,
        transcription: str | None = None,
    ) -> Dict[str, Any]:
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
        async with self._exclusive_session(session_id) as session:
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

            return await self._process_text_turn_for_session(session, text)

    async def _capture_transcribed_voicemail(self, session: SessionState, text: str) -> Dict[str, Any]:
        transcription = text.strip()
        if not transcription:
            reply = "I'm ready to capture your voicemail. Please say the message you'd like me to pass along."
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session, tag="VOICEMAIL")
            return self._build_turn_response(session, reply, "handoff", False, awaiting_voicemail=True)

        recording_url = f"voice-runtime-v2://transcript/{session.sessionId}"
        await self._capture_voicemail_for_session(
            session,
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

    def _apply_transport_event_to_session(
        self,
        session: SessionState,
        event_type: str,
        payload: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
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
        async with self._exclusive_session(session_id) as session:
            snapshot = self._apply_transport_event_to_session(session, event_type, payload)
            await self._sync_call_state(
                session,
                tag=self._current_call_tag(session),
                status=status or self._transport_checkpoint_status(session, event_type),
            )
            return snapshot

    def _get_intent(self, session: SessionState, intent_id: Optional[str]) -> Optional[DetectedIntent]:
        if not intent_id:
            return None
        return next((intent for intent in session.intentQueue.intents if intent.intentId == intent_id), None)

    def _current_intent(self, session: SessionState) -> Optional[DetectedIntent]:
        current = self._get_intent(session, session.intentQueue.activeIntentId)
        if current:
            return current
        return next(
            (
                intent
                for intent in session.intentQueue.intents
                if intent.status in {"active", "selected"} and intent.kind in {"action", "handoff"}
            ),
            None,
        )

    def _candidate_priority_intents(self, session: SessionState) -> list[DetectedIntent]:
        candidates = [self._get_intent(session, intent_id) for intent_id in session.priorityPromptState.intentIds]
        return [intent for intent in candidates if intent is not None]

    def _queued_actionable_intents(self, session: SessionState) -> list[DetectedIntent]:
        return [
            intent
            for intent in session.intentQueue.intents
            if intent.kind in {"action", "handoff"} and intent.status in {"queued", "paused", "detected"}
        ]

    def _actionable_detected_intents(self, decision: SupervisorDecision) -> list[DetectedIntent]:
        return [intent for intent in decision.detectedIntents if intent.kind in {"action", "handoff"}]

    def _clear_priority_prompt(self, session: SessionState):
        session.awaitingIntentPriority = False
        session.priorityPromptState.active = False
        session.priorityPromptState.promptType = "initial"
        session.priorityPromptState.promptText = ""
        session.priorityPromptState.intentIds = []
        session.priorityPromptState.knowledgeReply = None
        session.priorityPromptState.requestedAt = None

    def _record_intent_event(
        self,
        session: SessionState,
        event_type: str,
        *,
        intent: Optional[DetectedIntent] = None,
        data: Optional[Dict[str, Any]] = None,
    ):
        payload = data or {}
        if intent:
            payload = {
                "intentId": intent.intentId,
                "kind": intent.kind,
                "summary": intent.summary,
                "status": intent.status,
                "detectedOrder": intent.detectedOrder,
                "selectedOrder": intent.selectedOrder,
                "sourceText": intent.sourceText,
                **payload,
            }
        session.events.append(
            SessionEvent(
                type=event_type,
                actionName=event_type,
                domain=intent.domain if intent else session.activeDomain,
                operatorSummary=intent.summary if intent else None,
                data=payload,
            )
        )

    def _register_detected_intents(self, session: SessionState, intents: list[DetectedIntent]) -> list[DetectedIntent]:
        registered: list[DetectedIntent] = []
        for intent in intents:
            existing = next(
                (
                    item
                    for item in session.intentQueue.intents
                    if item.domain == intent.domain and item.status not in {"resolved", "cancelled", "dropped"}
                ),
                None,
            )
            if existing:
                if not existing.summary and intent.summary:
                    existing.summary = intent.summary
                if not existing.sourceText and intent.sourceText:
                    existing.sourceText = intent.sourceText
                if intent.matchedKeywords:
                    existing.matchedKeywords = list(dict.fromkeys(existing.matchedKeywords + intent.matchedKeywords))
                registered.append(existing)
                continue

            registered_intent = intent.model_copy(
                update={
                    "detectedOrder": session.intentQueue.nextDetectedOrder,
                    "status": "queued" if intent.kind in {"action", "handoff"} else "detected",
                }
            )
            session.intentQueue.nextDetectedOrder += 1
            session.intentQueue.intents.append(registered_intent)
            self._record_intent_event(session, "intent_detected", intent=registered_intent)
            registered.append(registered_intent)
        return registered

    def _ensure_current_issue_intent(self, session: SessionState) -> Optional[DetectedIntent]:
        current = self._current_intent(session)
        if current:
            return current
        if not session.activeDomain or session.activeDomain in {"knowledge", "safety"}:
            return None

        summary = session.pendingConfirmation.summary if session.pendingConfirmation else f"{session.activeDomain} request"
        intent = DetectedIntent(
            domain=session.activeDomain,
            kind="handoff" if session.activeDomain == "handoff" else "action",
            sourceText=session.pendingConfirmation.callerRequestSummary if session.pendingConfirmation else summary,
            summary=summary,
            status="active",
            detectedOrder=session.intentQueue.nextDetectedOrder,
            selectedOrder=session.intentQueue.nextSelectedOrder,
            slotState=dict(session.slotState.get(session.activeDomain, {})),
            missingFields=list(session.missingSlots),
            pendingAction=session.pendingConfirmation.model_copy(deep=True) if session.pendingConfirmation else None,
        )
        session.intentQueue.nextDetectedOrder += 1
        session.intentQueue.nextSelectedOrder += 1
        session.intentQueue.activeIntentId = intent.intentId
        session.intentQueue.intents.append(intent)
        self._record_intent_event(session, "intent_detected", intent=intent)
        self._record_intent_event(session, "intent_selected", intent=intent)
        return intent

    def _activate_intent(self, session: SessionState, intent: DetectedIntent, *, resumed: bool = False):
        if intent.selectedOrder is None:
            intent.selectedOrder = session.intentQueue.nextSelectedOrder
            session.intentQueue.nextSelectedOrder += 1
        intent.status = "active"
        session.intentQueue.activeIntentId = intent.intentId
        session.activeDomain = intent.domain
        session.intent = intent.domain
        session.awaitingAnythingElse = False
        self._clear_priority_prompt(session)
        if intent.pendingAction:
            session.pendingConfirmation = intent.pendingAction.model_copy(deep=True)
            session.stage = "confirmation"
            session.missingSlots = []
        else:
            session.pendingConfirmation = None
            if intent.slotState:
                session.slotState[intent.domain] = dict(intent.slotState)
            session.missingSlots = list(intent.missingFields)
            session.stage = "intake"
        self._record_intent_event(session, "intent_resumed" if resumed else "intent_selected", intent=intent)

    def _pause_current_intent(self, session: SessionState) -> Optional[DetectedIntent]:
        current = self._ensure_current_issue_intent(session)
        if not current:
            return None
        current.status = "paused"
        current.slotState = dict(session.slotState.get(current.domain, current.slotState))
        current.missingFields = list(session.missingSlots)
        current.pendingAction = session.pendingConfirmation.model_copy(deep=True) if session.pendingConfirmation else None
        session.pausedDomainState[current.domain] = {
            "slotState": dict(current.slotState),
            "missingFields": list(current.missingFields),
            "pendingAction": current.pendingAction.model_dump() if current.pendingAction else None,
        }
        session.intentQueue.activeIntentId = None
        session.pendingConfirmation = None
        session.missingSlots = []
        self._record_intent_event(session, "intent_paused", intent=current)
        return current

    def _remaining_priority_prompt(self, session: SessionState, *, prompt_type: str, knowledge_reply: str = "") -> str:
        candidates = self._candidate_priority_intents(session)
        if len(candidates) > 3:
            candidates = candidates[:3]
        summaries = [intent.summary for intent in candidates]
        if prompt_type == "switch" and len(candidates) >= 2:
            prompt = f"I can keep working on {summaries[0]}, or switch to {summaries[1]} now. Which should I handle first?"
        elif len(candidates) == 1:
            prompt = f"You also asked about {summaries[0]}. Should I handle that next?"
        else:
            prompt = f"I heard {', '.join(summaries[:-1])}, and {summaries[-1]}. Which should I handle first?"
        return f"{knowledge_reply} {prompt}".strip() if knowledge_reply else prompt

    async def _prompt_for_intent_priority(
        self,
        session: SessionState,
        intent_ids: list[str],
        *,
        prompt_type: str,
        knowledge_reply: str = "",
    ) -> Dict[str, Any]:
        session.awaitingIntentPriority = True
        session.priorityPromptState.active = True
        session.priorityPromptState.promptType = prompt_type  # type: ignore[assignment]
        session.priorityPromptState.intentIds = intent_ids
        session.priorityPromptState.knowledgeReply = knowledge_reply or None
        session.priorityPromptState.requestedAt = datetime.now(timezone.utc).isoformat()
        reply = self._remaining_priority_prompt(session, prompt_type=prompt_type, knowledge_reply=knowledge_reply)
        session.priorityPromptState.promptText = reply
        self._record_intent_event(
            session,
            "intent_priority_prompt",
            data={
                "promptType": prompt_type,
                "promptText": reply,
                "intentIds": list(intent_ids),
            },
        )
        await self._append_and_persist_assistant_message(session, reply)
        await self._sync_call_state(session, tag=self._current_call_tag(session))
        return self._build_turn_response(session, reply, session.activeDomain or "knowledge", False)

    def _selection_matches_intent(self, intent: DetectedIntent, text: str) -> bool:
        lowered = _normalize(text)
        domain_keywords = {
            "scheduling": ["appointment", "schedule", "physical", "follow-up"],
            "refill": ["refill", "medication", "prescription", "pharmacy"],
            "insurance": ["insurance", "coverage", "carrier", "plan"],
            "billing": ["billing", "statement", "balance", "payment", "account"],
            "handoff": ["staff", "callback", "call back", "human", "someone"],
            "knowledge": ["hours", "services", "billing", "refill", "insurance", "recording", "transcript"],
        }
        return any(keyword in lowered for keyword in domain_keywords.get(intent.domain, []))

    def _resolve_priority_selection(self, session: SessionState, text: str) -> tuple[Optional[DetectedIntent], bool]:
        candidates = self._candidate_priority_intents(session)
        lowered = _normalize(text)
        if not candidates:
            return None, False

        if any(phrase in lowered for phrase in ["whichever is easier", "whatever is easier", "either one is fine"]):
            return candidates[0], True

        for intent in candidates:
            if self._selection_matches_intent(intent, text):
                return intent, False

        ordinal_map = {
            "first": 0,
            "1": 0,
            "one": 0,
            "second": 1,
            "2": 1,
            "two": 1,
            "third": 2,
            "3": 2,
            "three": 2,
        }
        for token, index in ordinal_map.items():
            if re.search(rf"\b{re.escape(token)}\b", lowered) and index < len(candidates):
                return candidates[index], False

        if len(candidates) == 1 and lowered in {"yes", "yeah", "yep", "sure", "okay"}:
            return candidates[0], False

        return None, False

    async def _resume_selected_intent(
        self,
        session: SessionState,
        intent: DetectedIntent,
        *,
        reply_prefix: str = "",
    ) -> Dict[str, Any]:
        resumed = intent.status == "paused" or bool(intent.pendingAction or intent.slotState or intent.missingFields)
        self._activate_intent(session, intent, resumed=resumed)

        if session.pendingConfirmation:
            reply = session.pendingConfirmation.confirmationPrompt or f"I have {session.pendingConfirmation.summary}. Should I send that to the practice?"
            if reply_prefix:
                reply = f"{reply_prefix} {reply}".strip()
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session, tag=self._current_call_tag(session))
            return self._build_turn_response(session, reply, intent.domain, True)

        if resumed:
            result = await self._run_domain_specialist(session, intent.domain, "")
            return await self._handle_specialist_result(session, result, reply_prefix=reply_prefix)

        result = await self._run_domain_specialist(session, intent.domain, intent.sourceText or intent.summary)
        return await self._handle_specialist_result(session, result, reply_prefix=reply_prefix)

    async def _handle_intent_priority(self, session: SessionState, text: str) -> Dict[str, Any]:
        lowered = _normalize(text)
        candidates = self._candidate_priority_intents(session)
        if not candidates:
            self._clear_priority_prompt(session)
            return await self._handle_anything_else(session, text) or self._build_turn_response(session, "", "knowledge", False)

        if any(phrase in lowered for phrase in ["not now", "skip", "don't need", "do not need", "never mind"]):
            cancelled = next((intent for intent in candidates if self._selection_matches_intent(intent, text)), None)
            if cancelled or len(candidates) == 1:
                cancelled = cancelled or candidates[0]
                cancelled.status = "cancelled"
                self._record_intent_event(session, "intent_cancelled", intent=cancelled)
                remaining = [intent.intentId for intent in candidates if intent.intentId != cancelled.intentId]
                if remaining:
                    return await self._prompt_for_intent_priority(
                        session,
                        remaining,
                        prompt_type=session.priorityPromptState.promptType,
                    )
                self._clear_priority_prompt(session)
                reply = self._offer_anything_else(session, "Okay, I won't handle that right now.", cancelled.domain)
                await self._append_and_persist_assistant_message(session, reply)
                await self._sync_call_state(session)
                return self._build_turn_response(session, reply, cancelled.domain, False)

        selected, defaulted = self._resolve_priority_selection(session, text)
        if not selected:
            reply = f"{session.priorityPromptState.promptText} Please tell me which one to handle first."
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session, tag=self._current_call_tag(session))
            return self._build_turn_response(session, reply, session.activeDomain or "knowledge", False)

        if session.priorityPromptState.promptType == "switch":
            current = candidates[0] if candidates else None
            if current and selected.intentId != current.intentId and current.status in {"active", "selected"}:
                self._pause_current_intent(session)

        return await self._resume_selected_intent(
            session,
            selected,
            reply_prefix=f"Okay, I'll start with {selected.summary}." if defaulted else "",
        )

    async def _handle_multi_intent_decision(
        self,
        session: SessionState,
        caller_text: str,
        decision: SupervisorDecision,
    ) -> Optional[Dict[str, Any]]:
        actionable_intents = self._actionable_detected_intents(decision)
        if decision.mode == "clarify" and decision.priorityRequired and decision.clarificationPrompt:
            reply = decision.clarificationPrompt
            await self._append_and_persist_assistant_message(session, reply)
            await self._sync_call_state(session, tag=self._current_call_tag(session))
            return self._build_turn_response(session, reply, "knowledge", False)

        if decision.priorityRequired:
            registered = self._register_detected_intents(session, decision.detectedIntents)
            knowledge_reply = ""
            if decision.fragmentText:
                knowledge_match = self.knowledge.match(session, decision.fragmentText)
                knowledge_result = self.knowledge.handle(session, decision.fragmentText)
                if knowledge_match and knowledge_result:
                    self._record_knowledge_result(session, knowledge_result, knowledge_match, decision.fragmentText)
                    knowledge_reply = knowledge_result.nextPrompt
            prompt_ids = [intent.intentId for intent in registered if intent.kind in {"action", "handoff", "knowledge"}]
            if decision.reason == "multi-intent-priority-prompt" and len(actionable_intents) > 3:
                prompt_ids = prompt_ids[:3]
            return await self._prompt_for_intent_priority(
                session,
                prompt_ids,
                prompt_type="initial",
                knowledge_reply=knowledge_reply,
            )

        if (
            session.activeDomain
            and session.activeDomain not in {"knowledge", "safety"}
            and (session.missingSlots or session.pendingConfirmation)
            and actionable_intents
            and any(intent.domain != session.activeDomain for intent in actionable_intents)
        ):
            current_intent = self._ensure_current_issue_intent(session)
            registered = self._register_detected_intents(
                session,
                [intent for intent in actionable_intents if intent.domain != session.activeDomain],
            )
            if current_intent and registered:
                current_intent.status = "active" if session.pendingConfirmation else "selected"
                return await self._prompt_for_intent_priority(
                    session,
                    [current_intent.intentId, registered[0].intentId],
                    prompt_type="switch",
                )

        return None

    async def _offer_next_queued_issue(
        self,
        session: SessionState,
        reply: str,
        domain: DomainName,
    ) -> tuple[str, bool]:
        remaining = self._queued_actionable_intents(session)
        if not remaining:
            return self._offer_anything_else(session, reply, domain), False

        prompt_ids = [intent.intentId for intent in remaining[:3]]
        session.awaitingAnythingElse = False
        session.awaitingIntentPriority = True
        session.priorityPromptState.active = True
        session.priorityPromptState.promptType = "resume"
        session.priorityPromptState.intentIds = prompt_ids
        session.priorityPromptState.knowledgeReply = None
        session.priorityPromptState.requestedAt = datetime.now(timezone.utc).isoformat()
        prompt = self._remaining_priority_prompt(session, prompt_type="resume")
        session.priorityPromptState.promptText = prompt
        combined = f"{reply} {prompt}".strip()
        self._record_intent_event(
            session,
            "intent_priority_prompt",
            data={
                "promptType": "resume",
                "promptText": prompt,
                "intentIds": prompt_ids,
            },
        )
        return combined, True

    def _mark_current_intent_status(
        self,
        session: SessionState,
        status: str,
        *,
        follow_up_task_id: Optional[str] = None,
        fallback_reason: Optional[str] = None,
        action_name: Optional[str] = None,
    ):
        current = self._current_intent(session)
        if not current:
            return
        current.status = status  # type: ignore[assignment]
        current.missingFields = []
        current.pendingAction = None
        current.slotState = {}
        if status in {"resolved", "cancelled", "dropped"}:
            session.intentQueue.activeIntentId = None
        self._record_intent_event(
            session,
            f"intent_{status}",
            intent=current,
            data={
                "followUpTaskId": follow_up_task_id,
                "fallbackReason": fallback_reason,
                "actionName": action_name,
            },
        )

    def _sync_current_intent_from_result(self, session: SessionState, result: SpecialistResult):
        current = self._current_intent(session)
        if not current or current.domain != result.domain:
            return
        if result.callerRequestSummary:
            current.summary = result.callerRequestSummary
        current.slotState = dict(result.extractedFields)
        current.missingFields = list(result.missingFields)
        current.pendingAction = None
        if result.status == "needs_information":
            current.status = "active"
        elif result.status == "ready_for_confirmation":
            current.status = "active"
        elif result.status == "voicemail":
            current.status = "active"

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
        self._sync_current_intent_from_result(session, result)
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
            current_intent = self._current_intent(session)
            if current_intent and current_intent.domain == result.domain:
                current_intent.pendingAction = session.pendingConfirmation.model_copy(deep=True)
                current_intent.slotState = dict(result.extractedFields)
                current_intent.missingFields = []
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

    async def _handle_safety_result(
        self,
        session: SessionState,
        caller_text: str,
        result: SpecialistResult,
    ) -> Dict[str, Any]:
        preempted_domain = session.activeDomain
        had_pending_confirmation = session.pendingConfirmation is not None

        if session.activeDomain and session.activeDomain not in {"knowledge", "safety"} and (
            session.pendingConfirmation
            or session.missingSlots
            or session.activeDomain in session.slotState
        ):
            self._pause_current_intent(session)

        self._clear_priority_prompt(session)
        if result.safetyAssessment:
            self._record_safety_trigger(
                session,
                caller_text=caller_text,
                preempted_domain=preempted_domain,
                had_pending_confirmation=had_pending_confirmation,
                assessment=result.safetyAssessment,
            )

        if result.safetyAssessment and result.safetyAssessment.severity == "emergency":
            session.isEmergency = True
            session.lastSpecialistResult = result
            session.intent = "safety"
            session.activeDomain = "safety"
            session.missingSlots = []
            if result.requestHumanFollowUp:
                await self._create_manual_follow_up_event(
                    session,
                    result.operatorSummary.headline if result.operatorSummary else caller_text,
                )
            session.lastOperatorSummary = result.operatorSummary
            return await self._begin_final_close(
                session,
                result.nextPrompt,
                domain="safety",
                reason="emergency-detected",
                tag="EMERGENCY",
            )

        if result.safetyAssessment and result.safetyAssessment.severity == "urgent_handoff":
            if session.isAfterHours:
                handoff_result = self.handoff.build_after_hours_urgent_reply(session, caller_text)
            else:
                handoff_result = self.handoff.handle(session, caller_text)
            return await self._handle_specialist_result(session, handoff_result, reply_prefix=result.nextPrompt)

        if result.requestHumanFollowUp:
            await self._create_manual_follow_up_event(
                session,
                result.operatorSummary.headline if result.operatorSummary else caller_text,
            )
            session.lastOperatorSummary = result.operatorSummary
        return await self._finalize_specialist_result(session, result)

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
        if (
            result.resolved
            and result.status in {"answered", "execute_now", "handoff"}
            and not awaiting_voicemail
            and not session.isEmergency
        ):
            reply, _ = await self._offer_next_queued_issue(session, reply, result.domain)
        else:
            session.awaitingAnythingElse = False

        await self._append_and_persist_assistant_message(session, reply)
        await self._sync_call_state(
            session,
            tag=self._domain_to_tag(result.domain) or ("EMERGENCY" if session.isEmergency else None),
        )
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
            result = await self._run_domain_specialist(session, pending.domain, _strip_change_prefix(text))
            return await self._handle_specialist_result(session, result)

        if any(keyword in lowered for keyword in ["yes", "yeah", "yep", "correct", "confirm"]):
            return await self._execute_pending_action(session)

        if any(keyword in lowered for keyword in ["no", "cancel", "stop", "not now"]):
            if pending.actionName == "handoff-transfer":
                callback_result = self._build_daytime_callback_result(
                    session,
                    summary=pending.payload.get("reasonSummary") or pending.summary,
                    reason_category=pending.payload.get("reasonCategory"),
                    callback_phone=pending.payload.get("callbackPhone"),
                    preferred_callback_window=pending.payload.get("preferredCallbackWindow"),
                    extra_metadata={
                        "transferDeclined": True,
                        "transferTargetLabel": pending.payload.get("transferTargetLabel"),
                        "transferPhone": pending.payload.get("transferPhone"),
                    },
                )
                session.pendingConfirmation = None
                session.stage = "intake"
                session.slotState.pop(pending.domain, None)
                session.missingSlots = []
                self._clear_domain_slot_retries(session, pending.domain)
                return await self._execute_daytime_callback_result(
                    session,
                    callback_result,
                    close_reason="daytime-transfer-declined",
                )

            session.pendingConfirmation = None
            session.stage = "intake"
            session.slotState.pop(pending.domain, None)
            session.missingSlots = []
            self._clear_domain_slot_retries(session, pending.domain)
            self._mark_current_intent_status(session, "cancelled")
            reply, _ = await self._offer_next_queued_issue(session, "Okay, I won't submit that.", pending.domain)
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

        if pending.actionName == "handoff-transfer":
            return await self._attempt_daytime_transfer(
                session,
                payload=dict(pending.payload),
                caller_request=pending.callerRequestSummary or pending.summary,
                operator_summary=session.lastOperatorSummary,
            )

        if pending.domain == "handoff" and pending.actionName == "manual-follow-up" and not session.isAfterHours:
            callback_result = self._build_daytime_callback_result(
                session,
                summary=pending.payload.get("summary") or pending.summary,
                reason_category=(pending.payload.get("metadata") or {}).get("reasonCategory")
                if isinstance(pending.payload.get("metadata"), dict)
                else pending.payload.get("reasonCategory"),
                callback_phone=(pending.payload.get("metadata") or {}).get("callbackPhone")
                if isinstance(pending.payload.get("metadata"), dict)
                else pending.payload.get("callbackPhone"),
                preferred_callback_window=(pending.payload.get("metadata") or {}).get("preferredCallbackWindow")
                if isinstance(pending.payload.get("metadata"), dict)
                else pending.payload.get("preferredCallbackWindow"),
                extra_metadata=(pending.payload.get("metadata") if isinstance(pending.payload.get("metadata"), dict) else None),
            )
            session.pendingConfirmation = None
            return await self._execute_daytime_callback_result(
                session,
                callback_result,
                close_reason="daytime-callback-confirmed",
            )

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
        current_intent = self._current_intent(session)
        self._mark_current_intent_status(
            session,
            "resolved",
            follow_up_task_id=outcome.followUpTaskId,
            fallback_reason=outcome.fallbackReason,
            action_name=pending.actionName,
        )
        enriched_summary = self._combine_operator_summary(
            base=session.lastOperatorSummary,
            outcome=outcome,
            domain=pending.domain,
            caller_request=pending.callerRequestSummary,
        )
        self._record_runtime_action_outcome(
            session,
            pending.domain,
            pending.actionName,
            outcome,
            enriched_summary,
            intent_id=current_intent.intentId if current_intent else None,
        )
        caller_reply = self._build_caller_outcome_reply(session, pending.domain, pending.actionName, outcome)
        reply, _ = await self._offer_next_queued_issue(session, caller_reply, pending.domain)
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

        if result.runtimeAction == "handoff-transfer":
            return await self._attempt_daytime_transfer(
                session,
                payload=dict(result.runtimePayload),
                caller_request=result.callerRequestSummary or result.nextPrompt,
                operator_summary=result.operatorSummary,
                reply_prefix=reply_prefix,
            )

        if result.domain == "handoff" and result.runtimeAction == "manual-follow-up" and not session.isAfterHours:
            return await self._execute_daytime_callback_result(
                session,
                result,
                close_reason="daytime-callback-requested",
                reply_prefix=reply_prefix,
            )

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
        current_intent = self._current_intent(session)
        self._mark_current_intent_status(
            session,
            "resolved",
            follow_up_task_id=outcome.followUpTaskId,
            fallback_reason=outcome.fallbackReason,
            action_name=result.runtimeAction,
        )
        enriched_summary = self._combine_operator_summary(
            base=result.operatorSummary,
            outcome=outcome,
            domain=result.domain,
            caller_request=result.callerRequestSummary or result.nextPrompt,
        )
        self._record_runtime_action_outcome(
            session,
            result.domain,
            result.runtimeAction,
            outcome,
            enriched_summary,
            intent_id=current_intent.intentId if current_intent else None,
        )
        caller_reply = self._build_caller_outcome_reply(session, result.domain, result.runtimeAction, outcome)
        if reply_prefix:
            caller_reply = f"{reply_prefix} {caller_reply}".strip()
        reply, _ = await self._offer_next_queued_issue(session, caller_reply, result.domain)
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

        registered = self._register_detected_intents(session, decision.detectedIntents)
        selected_intent = next(
            (
                intent
                for intent in registered
                if intent.kind in {"action", "handoff"} and intent.domain == follow_on.domain
            ),
            None,
        )
        if selected_intent:
            self._activate_intent(session, selected_intent)

        result = await self._run_domain_specialist(session, follow_on.domain, follow_on.text)
        return await self._handle_specialist_result(
            session,
            result,
            reply_prefix=knowledge_result.nextPrompt if knowledge_result else "",
        )

    def _intent_queue_snapshot(
        self,
        session: SessionState,
        *,
        exclude_intent_id: Optional[str] = None,
    ) -> list[Dict[str, Any]]:
        return [
            {
                "intentId": intent.intentId,
                "domain": intent.domain,
                "summary": intent.summary,
                "status": intent.status,
                "detectedOrder": intent.detectedOrder,
                "selectedOrder": intent.selectedOrder,
            }
            for intent in session.intentQueue.intents
            if intent.kind in {"action", "handoff"}
            and intent.status not in {"resolved", "cancelled", "dropped"}
            and intent.intentId != exclude_intent_id
        ]

    def _pending_issue_summaries(
        self,
        session: SessionState,
        *,
        exclude_intent_id: Optional[str] = None,
    ) -> list[str]:
        return [
            str(item.get("summary"))
            for item in self._intent_queue_snapshot(session, exclude_intent_id=exclude_intent_id)
            if item.get("summary")
        ]

    def _handoff_metadata(
        self,
        session: SessionState,
        *,
        exclude_intent_id: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        metadata = {
            "pendingIssues": self._pending_issue_summaries(session, exclude_intent_id=exclude_intent_id),
            "queueSnapshot": self._intent_queue_snapshot(session, exclude_intent_id=exclude_intent_id),
        }
        if extra_metadata:
            metadata.update(extra_metadata)
        return metadata

    def _build_daytime_callback_result(
        self,
        session: SessionState,
        *,
        summary: str,
        reason_category: Any = None,
        callback_phone: Any = None,
        preferred_callback_window: Any = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> SpecialistResult:
        slots = HandoffSlotState.model_validate(
            {
                "reasonSummary": summary,
                "reasonCategory": reason_category,
                "callbackPhone": callback_phone or session.callerPhone,
                "preferredCallbackWindow": preferred_callback_window,
            }
        )
        current_intent = self._current_intent(session)
        return self.handoff.build_daytime_callback_result(
            session,
            slots,
            metadata=self._handoff_metadata(
                session,
                exclude_intent_id=current_intent.intentId if current_intent else None,
                extra_metadata=extra_metadata,
            ),
        )

    async def _create_daytime_callback_outcome(
        self,
        session: SessionState,
        result: SpecialistResult,
        *,
        fallback_reason: Optional[str] = None,
        intent_id: Optional[str] = None,
    ) -> RuntimeActionOutcome:
        payload = dict(result.runtimePayload)
        payload_metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        payload["metadata"] = self._handoff_metadata(
            session,
            exclude_intent_id=intent_id,
            extra_metadata=payload_metadata,
        )
        payload["callId"] = session.callId
        payload["callerName"] = session.callerName
        payload["callerPhone"] = payload_metadata.get("callbackPhone") or session.callerPhone
        outcome = await self._run_runtime_action(session, "manual-follow-up", payload)
        if fallback_reason and not outcome.fallbackReason:
            outcome = outcome.model_copy(update={"fallbackReason": fallback_reason})
        return outcome

    async def _execute_daytime_callback_result(
        self,
        session: SessionState,
        result: SpecialistResult,
        *,
        close_reason: str,
        fallback_reason: Optional[str] = None,
        reply_prefix: str = "",
    ) -> Dict[str, Any]:
        session.pendingConfirmation = None
        session.completedDomains.append("handoff")
        session.slotState.pop("handoff", None)
        session.missingSlots = []
        session.activeDomain = "handoff"
        self._clear_domain_slot_retries(session, "handoff")
        current_intent = self._current_intent(session)
        outcome = await self._create_daytime_callback_outcome(
            session,
            result,
            fallback_reason=fallback_reason,
            intent_id=current_intent.intentId if current_intent else None,
        )
        operator_summary = self._combine_operator_summary(
            base=result.operatorSummary,
            outcome=outcome,
            domain="handoff",
            caller_request=result.callerRequestSummary or result.nextPrompt,
        )
        self._mark_current_intent_status(
            session,
            "resolved",
            follow_up_task_id=outcome.followUpTaskId,
            fallback_reason=outcome.fallbackReason,
            action_name="manual-follow-up",
        )
        self._record_runtime_action_outcome(
            session,
            "handoff",
            "manual-follow-up",
            outcome,
            operator_summary,
            intent_id=current_intent.intentId if current_intent else None,
        )
        reply = result.nextPrompt
        if reply_prefix:
            reply = f"{reply_prefix} {reply}".strip()
        return await self._begin_final_close(
            session,
            reply,
            domain="handoff",
            reason=close_reason,
            tag="HUMAN_TRANSFER",
        )

    async def _attempt_daytime_transfer(
        self,
        session: SessionState,
        *,
        payload: Dict[str, Any],
        caller_request: str,
        operator_summary: Optional[OperatorSummary],
        reply_prefix: str = "",
    ) -> Dict[str, Any]:
        current_intent = self._current_intent(session)
        pending_issues = self._pending_issue_summaries(
            session,
            exclude_intent_id=current_intent.intentId if current_intent else None,
        )
        queue_snapshot = self._intent_queue_snapshot(
            session,
            exclude_intent_id=current_intent.intentId if current_intent else None,
        )
        transfer_target_label = str(payload.get("transferTargetLabel") or "front desk")
        transfer_phone = str(payload.get("transferPhone") or "").strip()
        callback_phone = str(payload.get("callbackPhone") or session.callerPhone or "").strip()
        preferred_callback_window = (
            str(payload.get("preferredCallbackWindow")).strip()
            if payload.get("preferredCallbackWindow")
            else None
        )
        reason_summary = str(payload.get("reasonSummary") or caller_request or "Staff transfer requested").strip()
        reason_category = str(payload.get("reasonCategory") or "general")

        callback_result = self._build_daytime_callback_result(
            session,
            summary=reason_summary,
            reason_category=reason_category,
            callback_phone=callback_phone,
            preferred_callback_window=preferred_callback_window,
            extra_metadata={
                "transferTargetLabel": transfer_target_label,
                "transferPhone": transfer_phone,
                "pendingIssues": pending_issues,
                "queueSnapshot": queue_snapshot,
            },
        )

        if not transfer_phone:
            return await self._execute_daytime_callback_result(
                session,
                callback_result,
                close_reason="daytime-transfer-misconfigured",
                fallback_reason="missing_transfer_phone",
                reply_prefix=reply_prefix,
            )

        escalation_payload = {
            "callId": session.callId,
            "businessId": session.businessId,
            "callerPhone": session.callerPhone,
            "callerName": session.callerName,
            "intentKey": "handoff-transfer",
            "isEmergency": session.isEmergency,
            "transcript": caller_request,
            "collectedFields": payload,
            "resolvedTurns": [event.model_dump() for event in session.events[-20:]],
            "escalationReason": reason_summary,
            "transferTargetLabel": transfer_target_label,
            "transferPhone": transfer_phone,
            "attemptMode": session.runtimeConfig.voicePolicyV2.daytimeHandoffPolicy.mode,
            "reasonCategory": reason_category,
            "callbackPhone": callback_phone,
            "pendingIssues": pending_issues,
            "queueSnapshot": queue_snapshot,
            "handoffSummary": reason_summary,
        }

        try:
            escalation_record = await self.api_client.escalate_to_human(escalation_payload) or {}
            action_url = build_public_callback_url(
                f"/telephony/twilio/transfer-action?sessionId={session.sessionId}"
            )
            transfer_twiml = self.twilio.build_transfer_twiml(
                transfer_phone=transfer_phone,
                action_url=action_url,
                timeout_seconds=int(payload.get("ringTimeoutSeconds") or 20),
                caller_id=session.calledPhone,
                preamble_message=f"One moment while I try to connect you to the {transfer_target_label}.",
            )
            await self.twilio.redirect_live_call(call_sid=session.callSid, transfer_twiml=transfer_twiml)
        except Exception:
            return await self._execute_daytime_callback_result(
                session,
                callback_result,
                close_reason="daytime-transfer-request-failed",
                fallback_reason="transfer_request_failed",
                reply_prefix=reply_prefix,
            )

        session.pendingConfirmation = None
        session.awaitingAnythingElse = False
        session.awaitingVoicemail = False
        self._clear_priority_prompt(session)
        session.stage = "handoff"
        session.activeDomain = "handoff"
        session.transferAttempt = TransferAttemptState(
            active=True,
            intentId=current_intent.intentId if current_intent else None,
            transferTargetLabel=transfer_target_label,
            transferPhone=transfer_phone,
            reasonSummary=reason_summary,
            reasonCategory=reason_category,
            callbackPhone=callback_phone,
            preferredCallbackWindow=preferred_callback_window,
            pendingIssues=pending_issues,
            queueSnapshot=queue_snapshot,
            escalationRecord=escalation_record,
            requestedAt=datetime.now(timezone.utc).isoformat(),
        )
        session.lastOperatorSummary = (operator_summary or OperatorSummary(
            headline="Daytime live transfer requested",
            nextStep=f"Attempt a live transfer to the {transfer_target_label}.",
            specialist="handoff",
            callerRequest=reason_summary,
            followUpRequired=True,
        )).model_copy(update={"handledLive": True})
        session.events.append(
            SessionEvent(
                type="handoff_transfer_requested",
                actionName="handoff-transfer",
                domain="handoff",
                operatorSummary=session.lastOperatorSummary.headline,
                data={
                    "intentId": current_intent.intentId if current_intent else None,
                    "transferTargetLabel": transfer_target_label,
                    "transferPhone": transfer_phone,
                    "reasonSummary": reason_summary,
                    "reasonCategory": reason_category,
                    "callbackPhone": callback_phone,
                    "pendingIssues": pending_issues,
                    "queueSnapshot": queue_snapshot,
                },
            )
        )
        reply = f"One moment while I try to connect you to the {transfer_target_label} now."
        if reply_prefix:
            reply = f"{reply_prefix} {reply}".strip()
        await self._append_and_persist_assistant_message(session, reply)
        await self._sync_call_state(session, tag="HUMAN_TRANSFER", status="ONGOING")
        return self._build_turn_response(session, reply, "handoff", False)

    async def handle_transfer_action_callback(self, session_id: str, payload: Dict[str, Any]) -> str:
        async with self._exclusive_session(session_id) as session:
            transfer_attempt = session.transferAttempt
            if not transfer_attempt.active:
                await self._sync_call_state(session, tag=self._current_call_tag(session), status=session.lifecycleStatus)
                return self.twilio.build_error_twiml("That transfer request is no longer active.")
    
            dial_status = _normalize(str(payload.get("DialCallStatus") or payload.get("DialStatus") or "failed"))
            current_intent = self._get_intent(session, transfer_attempt.intentId) if transfer_attempt.intentId else None
            if current_intent:
                session.intentQueue.activeIntentId = current_intent.intentId
                session.activeDomain = current_intent.domain
    
            if dial_status in {"completed", "answered"}:
                session.completedDomains.append("handoff")
                session.slotState.pop("handoff", None)
                session.missingSlots = []
                self._clear_domain_slot_retries(session, "handoff")
                session.lastOperatorSummary = OperatorSummary(
                    headline="Live transfer connected",
                    nextStep="Review the human handoff record if additional context is needed.",
                    specialist="handoff",
                    callerRequest=transfer_attempt.reasonSummary or "Live transfer requested",
                    handledLive=True,
                )
                self._mark_current_intent_status(session, "resolved", action_name="handoff-transfer")
                session.events.append(
                    SessionEvent(
                        type="handoff_transfer_connected",
                        actionName="handoff-transfer",
                        domain="handoff",
                        operatorSummary=session.lastOperatorSummary.headline,
                        data={
                            "intentId": transfer_attempt.intentId,
                            "transferTargetLabel": transfer_attempt.transferTargetLabel,
                            "transferPhone": transfer_attempt.transferPhone,
                            "reasonSummary": transfer_attempt.reasonSummary,
                            "reasonCategory": transfer_attempt.reasonCategory,
                            "callbackPhone": transfer_attempt.callbackPhone,
                            "pendingIssues": transfer_attempt.pendingIssues,
                        },
                    )
                )
                session.transferAttempt = TransferAttemptState()
                session.stage = "completed"
                await self._sync_call_state(session, tag="HUMAN_TRANSFER", status="COMPLETED")
                return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup /></Response>'
    
            callback_result = self._build_daytime_callback_result(
                session,
                summary=transfer_attempt.reasonSummary or "Staff callback requested by caller.",
                reason_category=transfer_attempt.reasonCategory,
                callback_phone=transfer_attempt.callbackPhone,
                preferred_callback_window=transfer_attempt.preferredCallbackWindow,
                extra_metadata={
                    "transferAttempted": True,
                    "transferTargetLabel": transfer_attempt.transferTargetLabel,
                    "transferPhone": transfer_attempt.transferPhone,
                    "pendingIssues": transfer_attempt.pendingIssues,
                    "queueSnapshot": transfer_attempt.queueSnapshot,
                },
            )
            outcome = await self._create_daytime_callback_outcome(
                session,
                callback_result,
                fallback_reason=dial_status,
                intent_id=transfer_attempt.intentId,
            )
            session.completedDomains.append("handoff")
            session.slotState.pop("handoff", None)
            session.missingSlots = []
            self._clear_domain_slot_retries(session, "handoff")
            self._mark_current_intent_status(
                session,
                "resolved",
                follow_up_task_id=outcome.followUpTaskId,
                fallback_reason=outcome.fallbackReason,
                action_name="manual-follow-up",
            )
            callback_summary = self._combine_operator_summary(
                base=callback_result.operatorSummary,
                outcome=outcome,
                domain="handoff",
                caller_request=callback_result.callerRequestSummary or callback_result.nextPrompt,
            )
            self._record_runtime_action_outcome(
                session,
                "handoff",
                "manual-follow-up",
                outcome,
                callback_summary,
                intent_id=transfer_attempt.intentId,
            )
            session.events.append(
                SessionEvent(
                    type="handoff_transfer_failed",
                    actionName="handoff-transfer",
                    domain="handoff",
                    operatorSummary="Live transfer failed",
                    followUpTaskId=outcome.followUpTaskId,
                    fallbackReason=dial_status,
                    data={
                        "intentId": transfer_attempt.intentId,
                        "transferTargetLabel": transfer_attempt.transferTargetLabel,
                        "transferPhone": transfer_attempt.transferPhone,
                        "reasonSummary": transfer_attempt.reasonSummary,
                        "reasonCategory": transfer_attempt.reasonCategory,
                        "callbackPhone": transfer_attempt.callbackPhone,
                        "pendingIssues": transfer_attempt.pendingIssues,
                        "followUpTaskId": outcome.followUpTaskId,
                        "fallbackReason": dial_status,
                    },
                )
            )
            session.events.append(
                SessionEvent(
                    type="handoff_callback_requested",
                    actionName="manual-follow-up",
                    domain="handoff",
                    operatorSummary=callback_summary.headline,
                    followUpTaskId=outcome.followUpTaskId,
                    fallbackReason=dial_status,
                    data={
                        "intentId": transfer_attempt.intentId,
                        "transferTargetLabel": transfer_attempt.transferTargetLabel,
                        "transferPhone": transfer_attempt.transferPhone,
                        "reasonSummary": transfer_attempt.reasonSummary,
                        "reasonCategory": transfer_attempt.reasonCategory,
                        "callbackPhone": transfer_attempt.callbackPhone,
                        "pendingIssues": transfer_attempt.pendingIssues,
                        "followUpTaskId": outcome.followUpTaskId,
                        "fallbackReason": dial_status,
                    },
                )
            )
            session.transferAttempt = TransferAttemptState()
            session.stage = "completed"
            callback_reply = (
                "No one was available to take the call live, so I created a callback request for the staff."
            )
            await self._append_and_persist_assistant_message(session, callback_reply)
            await self._sync_call_state(session, tag="HUMAN_TRANSFER", status="COMPLETED")
            return self.twilio.build_error_twiml(f"{callback_reply} Thank you for calling.")
    
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
        state_patch: Dict[str, Any] = {
            "status": resolved_status,
            "isEmergency": session.isEmergency,
            "turnCount": session.turns,
        }
        if tag is not None:
            state_patch["tag"] = tag
        if resolved_status in {"COMPLETED", "ABANDONED", "FAILED"}:
            state_patch["endedAt"] = datetime.now(timezone.utc).isoformat()

        pending_events: list[Dict[str, Any]] = []
        for event in session.events[session.persistedEventCount:]:
            if event.sequence is None:
                event.sequence = session.nextEventSequence
                session.nextEventSequence += 1
            pending_events.append(event.model_dump())

        transcript_segments = list(session.pendingTranscriptSegments)

        ingest_result = await self.api_client.ingest_call(
            session.callId,
            {
                "sessionId": session.sessionId,
                "events": pending_events,
                "transcriptSegments": transcript_segments,
                "statePatch": state_patch,
            },
        )
        if ingest_result is not None:
            session.persistedEventCount = len(session.events)
            session.pendingTranscriptSegments.clear()

        if settings.voice_runtime_legacy_call_sync:
            logger.info(
                "legacy_call_sync_active",
                call_id=session.callId,
                session_id=session.sessionId,
                pending_event_count=len(pending_events),
                transcript_segment_count=len(transcript_segments),
            )
            await self._legacy_sync_call_state(session, state_patch)

    async def _legacy_sync_call_state(self, session: SessionState, state_patch: Dict[str, Any]):
        if not session.callId:
            return

        legacy_payload: Dict[str, Any] = {
            **state_patch,
            "turnsJson": [event.model_dump() for event in session.events],
        }
        await self.api_client.update_call_session(session.callId, legacy_payload)

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
            "awaitingIntentPriority": session.awaitingIntentPriority,
            "missingSlots": list(session.missingSlots),
            "slotState": dict(session.slotState),
            "pendingAction": session.pendingConfirmation.model_dump() if session.pendingConfirmation else None,
            "priorityPromptState": session.priorityPromptState.model_dump(),
            "intentQueue": [intent.model_dump() for intent in session.intentQueue.intents],
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
        self._clear_priority_prompt(session)
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
                    "detectedIntents": [intent.model_dump() for intent in decision.detectedIntents],
                    "selectedIntentId": decision.selectedIntentId,
                    "priorityRequired": decision.priorityRequired,
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

    def _record_safety_trigger(
        self,
        session: SessionState,
        *,
        caller_text: str,
        preempted_domain: Optional[DomainName],
        had_pending_confirmation: bool,
        assessment: Any,
    ):
        session.events.append(
            SessionEvent(
                type="safety_triggered",
                actionName="safety",
                domain="safety",
                operatorSummary=assessment.headline,
                requiresFollowUp=True,
                data={
                    "category": assessment.category,
                    "severity": assessment.severity,
                    "matchedPatterns": assessment.matchedPatterns,
                    "preemptedDomain": preempted_domain,
                    "hadPendingConfirmation": had_pending_confirmation,
                    "queuedIntentCount": len(
                        [
                            intent
                            for intent in session.intentQueue.intents
                            if intent.status not in {"resolved", "cancelled", "dropped"}
                        ]
                    ),
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
                    "intentId": self._current_intent(session).intentId if self._current_intent(session) else None,
                    "missingFields": result.missingFields,
                    "extractedFields": result.extractedFields,
                    "callerRequestSummary": result.callerRequestSummary,
                    "fallbackRecommendation": result.fallbackRecommendation,
                    "safetyAssessment": result.safetyAssessment.model_dump() if result.safetyAssessment else None,
                },
            )
        )
        if result.domain == "insurance" and result.extractedFields.get("inquiryType"):
            session.events.append(
                SessionEvent(
                    type="insurance_inquiry_classified",
                    actionName="insurance-check",
                    domain="insurance",
                    operatorSummary=result.operatorSummary.headline if result.operatorSummary else None,
                    data={
                        "intentId": self._current_intent(session).intentId if self._current_intent(session) else None,
                        "inquiryType": result.extractedFields.get("inquiryType"),
                        "carrierName": result.extractedFields.get("carrierName"),
                        "planName": result.extractedFields.get("planName"),
                        "memberId": result.extractedFields.get("memberId"),
                        "patientDob": result.extractedFields.get("patientDob"),
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
        *,
        intent_id: Optional[str] = None,
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
                    "intentId": intent_id,
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
            if action_name == "manual-follow-up":
                return "Okay, I passed that insurance request to the staff for review."
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

        session.pendingTranscriptSegments.append(
            {
                "speaker": speaker,
                "text": clean_text,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "startTimeMs": start_ms,
                "endTimeMs": end_ms,
                "confidence": confidence,
            }
        )

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

    async def _choose_domain(self, session: SessionState, cleaned_text: str) -> SupervisorDecision:
        llm_decision = await route_turn_llm(session, cleaned_text)
        if llm_decision is not None:
            return llm_decision
        return self.supervisor.choose_domain(session, cleaned_text, knowledge_agent=self.knowledge)

    def _apply_llm_slot_enrichment(self, session: SessionState, decision: SupervisorDecision) -> None:
        enrichment = decision.llmSlotEnrichment
        if not enrichment:
            return
        target: DomainName | None = decision.domain
        if decision.followOnIntent:
            target = decision.followOnIntent.domain
        if target in {"knowledge", "safety"} or target is None:
            return
        base = dict(session.slotState.get(target, {}))
        for key, value in enrichment.items():
            if value is not None and value != "":
                base[key] = value
        session.slotState[target] = base

    async def _run_domain_specialist(self, session: SessionState, domain: DomainName, text: str) -> SpecialistResult:
        if domain == "handoff":
            if session.isAfterHours:
                if _contains(text, URGENT_AFTER_HOURS_KEYWORDS) and session.runtimeConfig.voicePolicyV2.afterHoursPolicy.sendUrgentToVoicemail:
                    return self.handoff.build_after_hours_urgent_reply(session, text)
                return self.handoff.build_after_hours_standard_reply(session, text)

        llm_result = await run_llm_agent(session, domain, text)
        if llm_result is not None:
            merge_slots_conservative(session, domain, llm_result.extractedFields)
            session.slotState[domain] = {
                **session.slotState.get(domain, {}),
                **llm_result.extractedFields,
            }
            session.missingSlots = list(llm_result.missingFields)
            return llm_result

        phase2 = await extract_slots_llm(session, domain, text)
        merge_slots_conservative(session, domain, phase2)

        if domain == "handoff":
            return self.handoff.handle(session, text)

        specialist = self._select_specialist(domain)
        result = specialist.handle(session, text)
        if result is None:
            return SpecialistResult(
                domain=domain,
                status="clarify",
                confidence=0.5,
                nextPrompt="Could you say that again in a few words?",
                callerRequestSummary="Assistant could not interpret the last utterance.",
            )
        return result

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

    async def _fetch_caller_context(self, business_id: str, caller_phone: str) -> Optional[CallerContext]:
        try:
            raw = await self.api_client.get_caller_context(business_id, caller_phone)
            if not raw or not raw.get("caller"):
                return None
            c = raw["caller"]
            return CallerContext(
                callerId=c.get("id"),
                callerName=c.get("name"),
                callerPhone=c.get("phone"),
                callerDob=str(c["dob"]) if c.get("dob") else None,
                recentCalls=[RecentCallSummary.model_validate(rc) for rc in (raw.get("recentCalls") or [])],
                knownInsurance=KnownInsurance.model_validate(raw["knownInsurance"]) if raw.get("knownInsurance") else None,
                knownMedications=raw.get("knownMedications") or [],
            )
        except Exception as exc:
            logger.warning("caller_context_fetch_failed", error=str(exc))
            return None

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
