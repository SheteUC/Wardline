"""
LLM-powered specialist agents for each domain.

Each agent receives the full context of the conversation, the caller's history with
the practice, the practice's policies, and current slot state. It returns a structured
SpecialistResult that the service layer consumes identically to the rule-based agents.

Multi-tenant safety: every LLM call is scoped to a single SessionState which carries
the businessId, runtimeConfig, and callerContext for exactly one practice. Two
concurrent calls (even to the same practice) use separate SessionState objects and
never share mutable data.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, cast

from config import settings
from llm_client import chat_json_completion
from llm_slots import SLOT_KEYS_BY_DOMAIN, sanitize_slot_dict
from models import (
    CallerContext,
    DomainName,
    OperatorSummary,
    SessionState,
    SpecialistResult,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _conversation_block(session: SessionState, max_messages: int = 16) -> str:
    lines: List[str] = []
    for msg in session.messages[-max_messages:]:
        role = "caller" if msg.role == "caller" else "assistant"
        text = (msg.text or "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines) if lines else "(no prior messages)"


def _caller_context_block(ctx: Optional[CallerContext]) -> str:
    if not ctx:
        return "No prior caller history available."
    parts: List[str] = []
    if ctx.callerName:
        parts.append(f"Name on file: {ctx.callerName}")
    if ctx.callerDob:
        parts.append(f"DOB on file: {ctx.callerDob}")
    if ctx.knownInsurance:
        ins = ctx.knownInsurance
        bits = []
        if ins.carrierName:
            bits.append(ins.carrierName)
        if ins.planName:
            bits.append(ins.planName)
        if bits:
            parts.append(f"Insurance on file: {', '.join(bits)}")
    if ctx.knownMedications:
        parts.append(f"Known medications: {', '.join(ctx.knownMedications[:5])}")
    if ctx.recentCalls:
        summaries = []
        for rc in ctx.recentCalls[:3]:
            label = rc.resolutionLabel or rc.resolution or rc.domain or rc.tag or "call"
            summaries.append(f"  - {label} ({rc.status or 'unknown'}, {rc.startedAt or '?'})")
        parts.append("Recent calls:\n" + "\n".join(summaries))
    return "\n".join(parts) if parts else "Caller has no prior history."


def _policy_notes(session: SessionState, domain: str) -> str:
    policy = session.runtimeConfig.voicePolicyV2.servicePolicies.get(domain)
    if not policy:
        return ""
    notes = []
    if policy.intakeNotes:
        notes.append(f"Practice intake notes: {policy.intakeNotes}")
    if policy.fallbackSummary:
        notes.append(f"Fallback instructions: {policy.fallbackSummary}")
    dialogue = session.runtimeConfig.voicePolicyV2.dialoguePolicies.get(domain)
    if dialogue:
        if dialogue.clarificationStyle:
            notes.append(f"Clarification style: {dialogue.clarificationStyle}")
        if dialogue.slotPrompts:
            prompts_str = "; ".join(f"{k}: {v}" for k, v in dialogue.slotPrompts.items())
            notes.append(f"Slot prompt overrides: {prompts_str}")
    return "\n".join(notes) if notes else "No special practice policy notes."


def _slot_state_block(session: SessionState, domain: str) -> str:
    existing = session.slotState.get(domain, {})
    if not existing:
        return "{}"
    return json.dumps(existing, ensure_ascii=False)


def _missing_slots_block(session: SessionState) -> str:
    if not session.missingSlots:
        return "none"
    return ", ".join(session.missingSlots)


# ---------------------------------------------------------------------------
# Shared system preamble
# ---------------------------------------------------------------------------

_PREAMBLE = """You are a domain specialist agent for a medical practice phone assistant.
You handle ONE domain at a time and your job is to:
1. Understand what the caller needs using full conversation history and their prior history with the practice.
2. Extract structured slot values from the conversation.
3. Decide the next action: ask for missing information, confirm before submitting, or execute immediately.

RULES:
- Never diagnose, give medical advice, or interpret test results.
- Never invent data (DOB, IDs, phone numbers) — only use what is clearly stated or on file.
- Be warm, professional, concise. Use the caller's name if known.
- If the caller already provided a value in a prior turn, do NOT re-ask.
- If a slot was pre-filled from caller history, acknowledge it ("I see we have X on file — is that still correct?").
- Resolve pronouns and references using conversation history ("that medication" → the one mentioned earlier).
- Respect the practice's custom prompts and policies when provided.

OUTPUT FORMAT (JSON only):
{
  "status": "needs_information|ready_for_confirmation|execute_now|clarify",
  "next_prompt": "What to say to the caller",
  "slots": { ... extracted/updated slot values ... },
  "missing_fields": ["field1", "field2"],
  "confidence": 0.0-1.0,
  "confirmation_summary": "Human-readable summary of the request (for confirmation)",
  "operator_headline": "Short headline for the practice dashboard",
  "operator_next_step": "What the practice staff should do next"
}
"""

# ---------------------------------------------------------------------------
# Domain-specific system prompts (appended to _PREAMBLE)
# ---------------------------------------------------------------------------

_SCHEDULING_PROMPT = """
DOMAIN: Scheduling
You help callers schedule, reschedule, or cancel appointments.

SLOTS: requestType (schedule|reschedule|cancel), visitType, preferredDate, preferredTime
REQUIRED: visitType, preferredDate, preferredTime

IMPORTANT ABOUT VISIT TYPES:
- Accept ANY visit type the caller mentions: dental, eye exam, physical, follow-up, checkup, cleaning, consultation, wellness visit, urgent care, new patient, or any other type.
- DO NOT say "we don't handle that type" or reject the visit type.
- DO NOT ask for more specificity about the visit type unless the caller hasn't mentioned ANY type at all.
- Examples of acceptable visit types: "dental appointment", "teeth cleaning", "eye exam", "physical", "follow-up", "checkup", "wellness visit", "new patient visit", etc.

IMPORTANT ABOUT CONFIRMATION LANGUAGE:
- Use CONDITIONAL language: "I can schedule you for..." NOT "I have scheduled you for..."
- Say "I can set that up for you" NOT "I've set that up for you"
- The appointment is NOT confirmed until the caller says yes, so use tentative language.

Flow:
- If requestType is unclear from context, assume "schedule".
- For dates, ask for CLARIFICATION if the caller gives a vague timeframe:
  - "next week" or "this week" → ask "Which day works best for you?"
  - "sometime next month" → ask "What date would you prefer?"
  - "in a few days" → ask "What specific date works for you?"
  - "soon" → ask "What day and time would work for you?"
- ONLY ask "What kind of appointment?" if the caller truly hasn't mentioned ANY visit type at all.
- Normalize dates: "next Tuesday" → the actual date if you can infer it, otherwise keep the phrase.
- If the caller gives an explicit date (e.g. "January 15th"), use it directly.
- Once all required slots are filled, set status "ready_for_confirmation" and compose a summary.
- If the caller gives multiple pieces of info at once (e.g. "annual physical next Monday at 3"), fill all slots.
"""

_REFILL_PROMPT = """
DOMAIN: Prescription Refill
You help callers request medication refills.

SLOTS: medicationName, callerDob, pharmacyName, pharmacyPhone, prescriberName
REQUIRED: medicationName, callerDob, pharmacyName, pharmacyPhone

Flow:
- If the caller's medications are listed in their history, confirm which one: "I see you have [medications] on file. Which medication needs a refill?"- If DOB is on file, say "I have your date of birth on file as X — is that still correct?" rather than asking again.
- IMPORTANT: Ask clarifying questions when information is vague:
  - If medication name is unclear (e.g. "my heart meds"), ask "Which specific medication do you need refilled?"
  - If pharmacy name is generic (e.g. "the pharmacy"), ask "Which pharmacy would you like me to send the refill to?"
- Ask for pharmacy details if not provided. If caller says "same pharmacy", use any pharmacy from prior context.
- Once all required slots are filled, set status "ready_for_confirmation".
"""

_INSURANCE_PROMPT = """
DOMAIN: Insurance
You help callers with insurance acceptance checks, eligibility verification, coverage questions, claim status, and prior auth status.

SLOTS: inquiryType (acceptance|eligibility|coverage|claim_status|prior_auth_status), carrierName, planName, memberId, groupNumber, patientName, patientDob, subscriberRelation (self|spouse|child|other), serviceType, callbackPhone
REQUIRED (varies by inquiryType):
- acceptance: carrierName
- eligibility: carrierName, memberId, patientName, patientDob
- coverage/claim_status/prior_auth_status: carrierName, memberId, patientName

Flow:
- If insurance is on file, confirm it: "I see [carrier] [plan] on file — is that the plan you're asking about?"
- IMPORTANT: Ask clarifying questions when information is vague:
  - If inquiry type is unclear, ask: "Are you asking about insurance acceptance, eligibility, coverage, a claim, or a prior authorization?"
  - If carrier name is generic (e.g. "my insurance"), ask: "Which insurance carrier is it, such as Blue Cross, Aetna, or Cigna?"
  - If the caller mentions a family member without clarifying, ask: "Is this for you, a spouse, or a child?"
- For acceptance checks ("do you take X?"), you can go straight to execute_now once carrier is known.
- For eligibility/coverage, collect member details patiently.
- If the inquiry type is complex (claim_status, prior_auth_status), set status "ready_for_confirmation" to hand off.
"""

_BILLING_PROMPT = """
DOMAIN: Billing
You help callers with billing questions — outstanding balances, payment plans, statement inquiries.

SLOTS: billingTopic, accountReference
REQUIRED: billingTopic

Flow:
- Common topics: outstanding_balance, payment_plan, statement_question, payment_method, charge_dispute
- IMPORTANT: Ask clarifying questions when information is vague:
  - If billing topic is unclear, ask: "Are you asking about your balance, a payment plan, a statement, or something else?"
  - If the caller mentions a vague amount without context, ask: "Is this about your current balance, a past statement, or a payment you made?"
- If the topic is something that needs staff review (charge dispute, complex payment plan), set status "ready_for_confirmation" and summarize.
- For simple balance inquiries, set status "execute_now".
"""

_HANDOFF_PROMPT = """
DOMAIN: Handoff / Transfer
The caller wants to speak with a real person or leave a callback request.

SLOTS: reasonSummary, callbackPhone, preferredCallbackWindow, reasonCategory (general|appointments|refill|insurance|billing|clinical), transferConsent (boolean)
REQUIRED: reasonSummary

Flow:
- Summarize the reason for handoff using conversation context.
- If the practice offers live transfer, ask: "I can try to connect you now, or I can take a callback request. Which would you prefer?"
- If transfer is declined or unavailable, collect callbackPhone and preferredCallbackWindow.
- Set status "ready_for_confirmation" with the handoff details.
"""

_DOMAIN_PROMPTS: Dict[str, str] = {
    "scheduling": _SCHEDULING_PROMPT,
    "refill": _REFILL_PROMPT,
    "insurance": _INSURANCE_PROMPT,
    "billing": _BILLING_PROMPT,
    "handoff": _HANDOFF_PROMPT,
}


# ---------------------------------------------------------------------------
# Build the full user-prompt payload for a domain specialist call
# ---------------------------------------------------------------------------

def _build_agent_payload(session: SessionState, domain: str, caller_text: str) -> str:
    payload: Dict[str, Any] = {
        "domain": domain,
        "business_name": session.businessName,
        "after_hours": session.isAfterHours,
        "caller_context": _caller_context_block(session.callerContext),
        "practice_policy": _policy_notes(session, domain),
        "current_slot_state": json.loads(_slot_state_block(session, domain)),
        "missing_slots": list(session.missingSlots),
        "conversation_history": _conversation_block(session),
        "latest_caller_message": caller_text.strip(),
    }
    return json.dumps(payload, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Parse LLM response into SpecialistResult
# ---------------------------------------------------------------------------

_VALID_STATUSES = frozenset({"needs_information", "ready_for_confirmation", "execute_now", "clarify"})


def _runtime_action_requires_confirmation(action_name: Optional[str]) -> bool:
    return action_name in {"appointment-request", "refill-request", "billing-request"}


def _stringify_notes(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return " ".join(str(item).strip() for item in value if str(item).strip()).strip()
    return ""


def _build_runtime_payload(
    domain: DomainName,
    session: SessionState,
    slots: Dict[str, Any],
    *,
    action_name: Optional[str],
    status: str,
) -> Dict[str, Any]:
    caller_name = session.callerName or (session.callerContext.callerName if session.callerContext else None) or "Caller"
    confirmed = status == "execute_now" or _runtime_action_requires_confirmation(action_name)

    if domain == "scheduling":
        request_type = str(slots.get("requestType") or "schedule").strip().lower()
        notes = _stringify_notes(slots.get("notes"))
        if request_type and request_type != "schedule":
            request_note = f"Request type: {request_type}."
            notes = f"{request_note} {notes}".strip() if notes else request_note
        return {
            "callerName": caller_name,
            "callerPhone": session.callerPhone,
            "serviceType": slots.get("visitType") or slots.get("serviceType") or "appointment",
            "preferredDate": slots.get("preferredDate"),
            "preferredTime": slots.get("preferredTime"),
            "notes": notes,
            "confirmed": confirmed,
        }

    payload = {
        "callerName": caller_name,
        "callerPhone": session.callerPhone,
        **slots,
        "confirmed": confirmed,
    }
    return payload


_REQUIRED_FIELDS_BY_DOMAIN: Dict[str, frozenset[str]] = {
    "scheduling": frozenset({"visitType", "preferredDate", "preferredTime"}),
    "refill": frozenset({"medicationName", "callerDob", "pharmacyName", "pharmacyPhone"}),
    "billing": frozenset({"billingTopic"}),
}


def _parse_agent_response(
    data: Dict[str, Any],
    domain: DomainName,
    session: SessionState,
    caller_text: str,
) -> Optional[SpecialistResult]:
    status = str(data.get("status", "")).strip().lower()
    if status not in _VALID_STATUSES:
        return None

    next_prompt = str(data.get("next_prompt", "")).strip()
    if not next_prompt:
        return None

    try:
        confidence = max(0.0, min(1.0, float(data.get("confidence", 0.8))))
    except (TypeError, ValueError):
        confidence = 0.8

    slots_raw = data.get("slots") or {}
    slots = sanitize_slot_dict(domain, slots_raw)

    missing = data.get("missing_fields")
    if not isinstance(missing, list):
        missing = []
    missing = [f for f in missing if isinstance(f, str) and f in SLOT_KEYS_BY_DOMAIN.get(domain, frozenset())]

    # Validate missing_fields against actual required slots for domains with intake flows
    # This ensures the LLM doesn't skip required intake questions
    required = _REQUIRED_FIELDS_BY_DOMAIN.get(domain)
    if required and status == "needs_information":
        actually_missing = [f for f in required if f not in slots or not slots[f]]
        if set(missing) != set(actually_missing) and actually_missing:
            missing = actually_missing

    confirmation = data.get("confirmation_summary")
    if isinstance(confirmation, str):
        confirmation = confirmation.strip() or None
    else:
        confirmation = None

    headline = str(data.get("operator_headline", f"{domain.title()} specialist"))[:200]
    next_step = str(data.get("operator_next_step", "Continue processing."))[:300]

    runtime_action: Optional[str] = None
    runtime_payload: Dict[str, Any] = {}
    fallback: Optional[str] = None

    policy = session.runtimeConfig.voicePolicyV2.servicePolicies.get(domain)
    if status in ("ready_for_confirmation", "execute_now") and policy:
        runtime_action = policy.runtimeAction
        runtime_payload = _build_runtime_payload(
            domain,
            session,
            slots,
            action_name=runtime_action,
            status=status,
        )
        fallback = policy.fallbackSummary or None

    return SpecialistResult(
        domain=domain,
        status=cast(Any, status),
        confidence=confidence,
        nextPrompt=next_prompt,
        extractedFields=slots,
        missingFields=missing,
        confirmationSummary=confirmation,
        runtimeAction=runtime_action,
        runtimePayload=runtime_payload,
        fallbackRecommendation=fallback,
        operatorSummary=OperatorSummary(
            headline=headline,
            nextStep=next_step,
            specialist=domain,
            callerRequest=caller_text.strip() or f"{domain} request",
        ),
        callerRequestSummary=confirmation or f"{domain.title()} request in progress",
    )


# ---------------------------------------------------------------------------
# Main entry point — run an LLM specialist agent for a domain
# ---------------------------------------------------------------------------

async def run_llm_agent(
    session: SessionState,
    domain: DomainName,
    caller_text: str,
) -> Optional[SpecialistResult]:
    if not settings.voice_llm_agents:
        return None
    if settings.active_llm_provider() == "none":
        return None
    if domain not in _DOMAIN_PROMPTS:
        return None

    system_prompt = _PREAMBLE + _DOMAIN_PROMPTS[domain]
    user_prompt = _build_agent_payload(session, domain, caller_text)

    data = await chat_json_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.15,
        max_tokens=800,
    )
    if not data:
        return None

    try:
        result = _parse_agent_response(data, domain, session, caller_text)
        if result and result.confidence < 0.3:
            logger.info("LLM agent %s confidence %.2f too low, falling back", domain, result.confidence)
            return None
        return result
    except Exception as exc:
        logger.warning("LLM agent %s parse failed: %s", domain, exc)
        return None
