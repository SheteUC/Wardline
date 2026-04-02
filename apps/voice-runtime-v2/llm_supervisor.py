"""
LLM-backed routing: maps caller turns to SupervisorDecision with optional slot enrichment.
Falls back to rule-based SupervisorAgent when disabled, misconfigured, or on errors.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, cast, get_args

from config import settings

from llm_client import chat_json_completion
from llm_slots import sanitize_slot_dict
from models import (
    DetectedIntent,
    DomainName,
    FollowOnIntent,
    KnowledgeTopic,
    SessionState,
    SupervisorDecision,
    SupervisorMode,
)
logger = logging.getLogger(__name__)

_ACTIONABLE = frozenset({"action", "handoff"})
_VALID_DOMAINS: frozenset[str] = frozenset(get_args(DomainName))
_VALID_MODES: frozenset[str] = frozenset(get_args(SupervisorMode))
_VALID_KNOWLEDGE_TOPICS: frozenset[str] = frozenset(get_args(KnowledgeTopic))

def _coerce_domain(value: Any, enabled: set[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None
    d = value.strip().lower()
    if d not in _VALID_DOMAINS:
        return None
    if d == "safety":
        return None
    if d not in enabled and d != "knowledge":
        return None
    return d


def _coerce_mode(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    m = value.strip().lower()
    if m not in _VALID_MODES:
        return None
    return m


def _kind_for_domain(domain: str) -> str:
    if domain == "handoff":
        return "handoff"
    if domain == "knowledge":
        return "knowledge"
    return "action"


def _parse_knowledge_topic(raw: Any) -> Optional[KnowledgeTopic]:
    if raw is None or not isinstance(raw, str):
        return None
    key = raw.strip().lower().replace("-", "_")
    if key in _VALID_KNOWLEDGE_TOPICS:
        return cast(KnowledgeTopic, key)
    return None


def _build_conversation_block(session: SessionState, max_messages: int = 12) -> str:
    lines: List[str] = []
    for msg in session.messages[-max_messages:]:
        role = "caller" if msg.role == "caller" else "assistant"
        text = (msg.text or "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines) if lines else "(no prior messages)"


SYSTEM_PROMPT = """You route phone calls for a medical practice virtual assistant. Output a single JSON object only.

Goals:
- Choose the best domain and mode using conversation context (resolve pronouns using history).
- Support paraphrases (e.g. "checkup" = scheduling, "money I owe" = billing).
- If the caller is answering a question in an ongoing task, use mode "continue" with the same active domain.
- If multiple distinct actionable requests appear, set priority_required true and list intents (max 3 actionable).
- If the caller asks a practice FAQ AND also requests an action (e.g. hours + book appointment), use compound path (see below).
- Never diagnose or give medical advice. Do not invent facts; use routing only.

Modes:
- delegate: start or switch to a domain specialist.
- continue: caller is continuing the current domain (slot answer, correction).
- knowledge: practice information only (hours, policies, services FAQ).
- clarify: unclear what they want; set clarification_prompt.
- handoff: caller insists on a person / transfer / callback request as the main intent (domain handoff).

Domains (subset enabled in request): scheduling, refill, insurance, billing, handoff, knowledge.

Knowledge topics (optional, for knowledge mode): office_hours, services, after_hours, appointment_policy, refill_policy, insurance_policy, billing_policy, recording_policy, transcript_retention, custom_faq

Compound knowledge + action:
- Set mode "knowledge", domain "knowledge", compound_knowledge_then_action true.
- knowledge_fragment: the FAQ part. follow_on_domain + follow_on_text: the action part.
- intents: include two entries (knowledge + action/handoff) in order.

slot_enrichment: optional object with slot fields ONLY for the target domain when you can extract structured data from the latest message (e.g. dates, medication name, carrier). Use empty object if none. Do not guess dates of birth or phone numbers; leave blank if not clearly stated.

JSON schema (all keys required; use null where appropriate):
{
  "mode": "delegate|continue|knowledge|clarify|handoff",
  "domain": "scheduling|refill|insurance|billing|handoff|knowledge",
  "confidence": 0.0,
  "reason": "short_snake_case",
  "continuation": false,
  "fragment_text": null,
  "priority_required": false,
  "clarification_prompt": null,
  "knowledge_topic": null,
  "compound_knowledge_then_action": false,
  "knowledge_fragment": null,
  "follow_on_domain": null,
  "follow_on_text": null,
  "intents": [],
  "slot_enrichment": {}
}

intents items: {"domain": "...", "kind": "knowledge|action|handoff", "summary": "...", "source_text": "..."}
"""


def _build_user_payload(session: SessionState, latest_text: str) -> str:
    enabled = set(session.runtimeConfig.voicePolicyV2.enabledDomains)
    slot_summary: Dict[str, Any] = {}
    for key in ("scheduling", "refill", "insurance", "billing", "handoff"):
        if key in session.slotState and session.slotState[key]:
            slot_summary[key] = session.slotState[key]

    caller_hint = ""
    if session.callerContext:
        ctx = session.callerContext
        parts = []
        if ctx.callerName:
            parts.append(f"name={ctx.callerName}")
        if ctx.knownMedications:
            parts.append(f"meds={','.join(ctx.knownMedications[:3])}")
        if ctx.knownInsurance and ctx.knownInsurance.carrierName:
            parts.append(f"insurance={ctx.knownInsurance.carrierName}")
        if ctx.recentCalls:
            domains = [rc.domain for rc in ctx.recentCalls[:3] if rc.domain]
            if domains:
                parts.append(f"recent_domains={','.join(domains)}")
        caller_hint = "; ".join(parts) if parts else ""

    payload = {
        "business_name": session.businessName,
        "after_hours": session.isAfterHours,
        "enabled_domains": sorted(d for d in enabled if d not in {"safety"}),
        "active_domain": session.activeDomain,
        "intent_queue_domains": [i.domain for i in session.intentQueue.intents if i.status not in {"resolved", "cancelled", "dropped"}],
        "pending_confirmation": bool(session.pendingConfirmation),
        "missing_slots": list(session.missingSlots),
        "slot_state_summary": slot_summary,
        "caller_history_hint": caller_hint,
        "conversation": _build_conversation_block(session),
        "latest_caller_message": latest_text.strip(),
    }
    return json.dumps(payload, ensure_ascii=False)


def _intents_from_llm(raw: Any, enabled: set[str]) -> List[DetectedIntent]:
    if not isinstance(raw, list):
        return []
    out: List[DetectedIntent] = []
    for item in raw[:6]:
        if not isinstance(item, dict):
            continue
        domain = _coerce_domain(item.get("domain"), enabled)
        if not domain:
            continue
        kind = item.get("kind") if isinstance(item.get("kind"), str) else _kind_for_domain(domain)
        if kind not in {"knowledge", "action", "handoff"}:
            kind = _kind_for_domain(domain)
        summary = item.get("summary") if isinstance(item.get("summary"), str) else domain
        source = item.get("source_text") if isinstance(item.get("source_text"), str) else summary
        out.append(
            DetectedIntent(
                domain=cast(DomainName, domain),
                kind=kind,  # type: ignore[arg-type]
                sourceText=source.strip(),
                summary=summary.strip() or domain,
                matchedKeywords=["llm-route"],
            )
        )
    return out


def _json_to_decision(data: Dict[str, Any], session: SessionState, latest_text: str) -> Optional[SupervisorDecision]:
    enabled = set(session.runtimeConfig.voicePolicyV2.enabledDomains)

    mode = _coerce_mode(data.get("mode"))
    domain = _coerce_domain(data.get("domain"), enabled)
    if not mode or not domain:
        return None

    try:
        confidence = float(data.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    reason = data.get("reason") if isinstance(data.get("reason"), str) else "llm-route"
    continuation = bool(data.get("continuation"))
    fragment = data.get("fragment_text") if isinstance(data.get("fragment_text"), str) else None
    fragment = fragment.strip() if fragment else None
    fragment_text = fragment or latest_text.strip()

    clarification = data.get("clarification_prompt") if isinstance(data.get("clarification_prompt"), str) else None
    clarification = clarification.strip() if clarification else None

    priority_required = bool(data.get("priority_required"))
    knowledge_topic = _parse_knowledge_topic(data.get("knowledge_topic"))

    compound = bool(data.get("compound_knowledge_then_action"))
    kfrag = data.get("knowledge_fragment") if isinstance(data.get("knowledge_fragment"), str) else None
    kfrag = kfrag.strip() if kfrag else None
    follow_dom = _coerce_domain(data.get("follow_on_domain"), enabled)
    follow_txt = data.get("follow_on_text") if isinstance(data.get("follow_on_text"), str) else None
    follow_txt = follow_txt.strip() if follow_txt else None

    intents = _intents_from_llm(data.get("intents"), enabled)

    follow_on: Optional[FollowOnIntent] = None
    detected = list(intents)

    if compound and kfrag and follow_dom and follow_txt and follow_dom != "knowledge":
        mode = "knowledge"
        domain = "knowledge"
        knowledge_topic = knowledge_topic or _parse_knowledge_topic("custom_faq")
        follow_on = FollowOnIntent(
            domain=cast(DomainName, follow_dom),
            text=follow_txt,
            knowledgeTopic=knowledge_topic,
            reason="llm-compound-knowledge-action",
        )
        detected = [
            DetectedIntent(
                domain="knowledge",
                kind="knowledge",
                sourceText=kfrag,
                summary="Practice question",
                knowledgeTopic=knowledge_topic,
                matchedKeywords=["llm-route"],
            ),
            DetectedIntent(
                domain=cast(DomainName, follow_dom),
                kind="handoff" if follow_dom == "handoff" else "action",
                sourceText=follow_txt,
                summary=follow_txt[:120],
                matchedKeywords=["llm-route"],
            ),
        ]
        priority_required = False

    specialist_enabled = enabled - {"safety", "knowledge"}
    if mode == "continue" and session.activeDomain and session.activeDomain in specialist_enabled:
        domain = session.activeDomain

    slot_domain = follow_on.domain if follow_on else domain
    slot_enrichment: Dict[str, Any] = {}
    if settings.voice_llm_slots and slot_domain not in {"knowledge", "safety"}:
        slot_enrichment = sanitize_slot_dict(str(slot_domain), data.get("slot_enrichment"))

    actionable = [i for i in detected if i.kind in _ACTIONABLE]
    if len(actionable) > 1:
        priority_required = True

    knowledge_only = [i for i in detected if i.kind == "knowledge"]
    if priority_required:
        if len(actionable) < 2 and len(knowledge_only) < 2:
            priority_required = False

    if mode == "clarify" and not clarification:
        clarification = "What would you like help with today?"

    if mode == "clarify":
        return SupervisorDecision(
            mode="clarify",
            domain="knowledge",
            confidence=confidence,
            reason=reason[:120],
            clarificationPrompt=clarification,
            fragmentText=fragment_text,
            detectedIntents=detected,
            priorityRequired=priority_required,
            llmSlotEnrichment={},
        )

    cast_mode = cast(SupervisorMode, mode)
    cast_domain = cast(DomainName, domain)

    if priority_required and len(actionable) > 3:
        detected = detected[:6]

    return SupervisorDecision(
        mode=cast_mode,
        domain=cast_domain,
        confidence=confidence,
        reason=reason[:120],
        continuation=continuation,
        clarificationPrompt=clarification,
        knowledgeTopic=knowledge_topic,
        matchedKeywords=["llm-route"],
        followOnIntent=follow_on,
        fragmentText=fragment_text,
        detectedIntents=detected,
        priorityRequired=priority_required,
        llmSlotEnrichment=slot_enrichment,
    )


async def route_turn_llm(session: SessionState, latest_text: str) -> Optional[SupervisorDecision]:
    if not settings.voice_llm_supervisor:
        return None
    if settings.active_llm_provider() == "none":
        return None
    if not latest_text.strip():
        return None

    user_prompt = _build_user_payload(session, latest_text)
    data = await chat_json_completion(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        temperature=0.15,
    )
    if not data:
        return None

    try:
        decision = _json_to_decision(data, session, latest_text)
        if decision and decision.confidence < 0.25 and decision.mode not in {"clarify"}:
            return None
        return decision
    except Exception as exc:
        logger.warning("llm_supervisor parse failed: %s", exc)
        return None
