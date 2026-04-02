"""
Phase 2: dedicated LLM slot extraction for specialist domains.
Merges conservatively into session.slotState before rule-based specialists run.
Shared slot allowlists are used by llm_supervisor for routing-time hints.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from config import settings

from llm_client import chat_json_completion
from models import SessionState

logger = logging.getLogger(__name__)

SLOT_KEYS_BY_DOMAIN: Dict[str, frozenset[str]] = {
    "scheduling": frozenset({"requestType", "visitType", "preferredDate", "preferredTime"}),
    "refill": frozenset({"medicationName", "callerDob", "pharmacyName", "pharmacyPhone", "prescriberName"}),
    "insurance": frozenset(
        {
            "inquiryType",
            "carrierName",
            "planName",
            "memberId",
            "groupNumber",
            "patientName",
            "patientDob",
            "subscriberRelation",
            "serviceType",
            "callbackPhone",
        }
    ),
    "billing": frozenset({"billingTopic", "accountReference"}),
    "handoff": frozenset({"reasonSummary", "callbackPhone", "preferredCallbackWindow", "reasonCategory", "transferConsent"}),
}

_VALID_INQUIRY = frozenset({"acceptance", "eligibility", "coverage", "claim_status", "prior_auth_status"})
_VALID_REQUEST_TYPE = frozenset({"schedule", "reschedule", "cancel"})
_VALID_RELATION = frozenset({"self", "spouse", "child", "other"})
_VALID_REASON_CAT = frozenset({"general", "appointments", "refill", "insurance", "billing", "clinical"})


def sanitize_slot_dict(domain: str, raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    allowed = SLOT_KEYS_BY_DOMAIN.get(domain, frozenset())
    out: Dict[str, Any] = {}
    for key, value in raw.items():
        if key not in allowed or value is None:
            continue
        if isinstance(value, str):
            s = value.strip()
            if not s:
                continue
            if key == "inquiryType":
                v = s.lower().replace("-", "_")
                if v in _VALID_INQUIRY:
                    out[key] = v
                continue
            if key == "requestType":
                v = s.lower()
                if v in _VALID_REQUEST_TYPE:
                    out[key] = v
                continue
            if key == "subscriberRelation":
                v = s.lower()
                if v in _VALID_RELATION:
                    out[key] = v
                continue
            if key == "reasonCategory":
                v = s.lower()
                if v in _VALID_REASON_CAT:
                    out[key] = v
                continue
            out[key] = s
            continue
        if isinstance(value, bool):
            if key == "transferConsent":
                out[key] = value
            continue
        if isinstance(value, (int, float)):
            out[key] = value
    return out


def _slot_value_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def merge_slots_conservative(session: SessionState, domain: str, extracted: Dict[str, Any]) -> None:
    if not extracted or domain not in SLOT_KEYS_BY_DOMAIN:
        return
    base = dict(session.slotState.get(domain, {}))
    for key, value in extracted.items():
        if key not in SLOT_KEYS_BY_DOMAIN.get(domain, frozenset()):
            continue
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        normalized: Any = value.strip() if isinstance(value, str) else value
        current = base.get(key)
        if _slot_value_empty(current):
            base[key] = normalized
    session.slotState[domain] = base


def _conversation_block(session: SessionState, max_messages: int = 14) -> str:
    lines: List[str] = []
    for msg in session.messages[-max_messages:]:
        role = "caller" if msg.role == "caller" else "assistant"
        text = (msg.text or "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines) if lines else "(no prior messages)"


SLOT_EXTRACT_SYSTEM = """You extract structured slot values for a medical practice phone assistant. Output JSON only.

Rules:
- Use the latest caller message and conversation context (resolve "that medication", "same pharmacy", etc. when obvious).
- Only include fields you are confident about from what was said. Use null or omit for unknown.
- Do not invent dates of birth, member IDs, or phone numbers; only fill if clearly spoken or written in the transcript.
- Normalize dates to ISO YYYY-MM-DD when you can infer a complete date; otherwise keep the caller's phrase for preferredDate/preferredTime (e.g. "Tuesday", "3pm").
- Phone numbers: US-style digits, optional +1; normalize to a string the practice can read (e.g. 555-123-4567).
- inquiryType (insurance): one of acceptance, eligibility, coverage, claim_status, prior_auth_status
- requestType (scheduling): schedule | reschedule | cancel
- subscriberRelation: self | spouse | child | other
- reasonCategory (handoff): general | appointments | refill | insurance | billing | clinical
- transferConsent: boolean only when the caller clearly agrees or declines a live transfer

Return shape: {"slots": { ... allowed keys for this domain ... }, "confidence": 0.0-1.0}
If nothing to extract: {"slots": {}, "confidence": 1.0}

Domain-specific keys:
- scheduling: requestType, visitType, preferredDate, preferredTime (strings)
- refill: medicationName, callerDob, pharmacyName, pharmacyPhone, prescriberName
- insurance: inquiryType, carrierName, planName, memberId, groupNumber, patientName, patientDob, subscriberRelation, serviceType, callbackPhone
- billing: billingTopic, accountReference
- handoff: reasonSummary, callbackPhone, preferredCallbackWindow, reasonCategory, transferConsent
"""


def should_run_slot_extract(session: SessionState, domain: str, text: str) -> bool:
    if not settings.voice_llm_slots:
        return False
    if settings.active_llm_provider() == "none":
        return False
    if domain not in SLOT_KEYS_BY_DOMAIN:
        return False
    stripped = text.strip()
    if len(stripped) < 2:
        return False
    trivial = frozenset(
        {
            "yes",
            "yeah",
            "yep",
            "yup",
            "no",
            "nope",
            "nah",
            "ok",
            "okay",
            "sure",
            "uh huh",
            "mhm",
        }
    )
    lower = stripped.lower()
    words = lower.split()
    if not session.missingSlots and len(words) <= 1 and lower in trivial:
        return False
    if not session.missingSlots and len(stripped) < 4:
        return False
    return True


async def extract_slots_llm(session: SessionState, domain: str, caller_text: str) -> Dict[str, Any]:
    if not should_run_slot_extract(session, domain, caller_text):
        return {}

    payload = {
        "domain": domain,
        "business_name": session.businessName,
        "current_slots_for_domain": dict(session.slotState.get(domain, {})),
        "missing_slot_labels": list(session.missingSlots),
        "conversation": _conversation_block(session),
        "latest_caller_message": caller_text.strip(),
    }
    raw = await chat_json_completion(
        system_prompt=SLOT_EXTRACT_SYSTEM,
        user_prompt=json.dumps(payload, ensure_ascii=False),
        temperature=0.1,
        max_tokens=500,
    )
    if not raw:
        return {}

    try:
        conf = float(raw.get("confidence", 0.5))
    except (TypeError, ValueError):
        conf = 0.5
    if conf < 0.35:
        return {}

    slots = raw.get("slots")
    return sanitize_slot_dict(domain, slots)
