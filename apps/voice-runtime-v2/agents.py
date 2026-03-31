"""
Internal supervisor and specialist agents for Voice Runtime V2.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from models import (
    BillingSlotState,
    DetectedIntent,
    DomainName,
    DialoguePolicy,
    FollowOnIntent,
    HandoffSlotState,
    InsuranceSlotState,
    KnowledgeMatch,
    KnowledgeTopic,
    OperatorSummary,
    RefillSlotState,
    SchedulingSlotState,
    SessionState,
    SpecialistResult,
    SupervisorDecision,
)

EMERGENCY_KEYWORDS = [
    "chest pain",
    "can't breathe",
    "difficulty breathing",
    "stroke",
    "heart attack",
    "severe bleeding",
    "unconscious",
    "suicidal",
    "kill myself",
]

CLINICAL_ADVICE_PHRASES = [
    "what do i have",
    "should i be worried",
    "diagnosis",
    "medical advice",
    "what should i take",
]

URGENT_AFTER_HOURS_KEYWORDS = [
    "urgent",
    "as soon as possible",
    "asap",
    "today",
    "same day",
    "right away",
    "cannot wait",
]

COMMON_INSURANCE_CARRIERS = [
    "aetna",
    "blue cross",
    "blue shield",
    "cigna",
    "united healthcare",
    "humana",
    "medicare",
    "medicaid",
]

WEEKDAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

DAY_OF_WEEK_LABELS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
]

WEEKDAY_TO_DAY_INDEX = {label.lower(): index for index, label in enumerate(DAY_OF_WEEK_LABELS)}

MONTH_NAMES = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
]

WORD_NUMBER_MAP = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}

FAQ_TOKEN_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "how",
    "can",
    "do",
    "for",
    "i",
    "if",
    "is",
    "it",
    "me",
    "my",
    "of",
    "or",
    "the",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "why",
    "you",
    "your",
}

REQUIRED_SLOT_RETRY_THRESHOLD = 2
EXPLICIT_UNKNOWN_PHRASES = [
    "don't know",
    "do not know",
    "not sure",
    "no idea",
    "don't have it",
    "do not have it",
    "i'm not sure",
    "i am not sure",
    "not with me",
    "can't find it",
    "cannot find it",
]

REFILL_REQUIRED_FIELDS = ["medicationName", "callerDob", "pharmacyName", "pharmacyPhone"]
BILLING_REQUIRED_FIELDS = ["billingTopic", "accountReference"]
INSURANCE_ACCEPTANCE_REQUIRED_FIELDS = ["carrierName"]
INSURANCE_ELIGIBILITY_REQUIRED_FIELDS = ["carrierName", "memberId", "patientDob"]
INSURANCE_FOLLOW_UP_REQUIRED_FIELDS = ["carrierName", "memberId", "patientDob"]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _clean_phrase(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip(" .,:;-")).strip()


def _phrase_in_text(lowered: str, phrase: str) -> bool:
    normalized_phrase = _normalize(phrase)
    if not normalized_phrase:
        return False
    pattern = r"\b" + re.escape(normalized_phrase).replace(r"\ ", r"\s+") + r"\b"
    return re.search(pattern, lowered) is not None


def _dialogue_policy(session: SessionState, domain: str) -> DialoguePolicy:
    return session.runtimeConfig.voicePolicyV2.dialoguePolicies.get(domain, DialoguePolicy())


def _slot_prompt(session: SessionState, domain: str, slot_name: str, fallback: str) -> str:
    policy = _dialogue_policy(session, domain)
    prompt = policy.slotPrompts.get(slot_name, "").strip()
    return prompt or fallback


def _extract_after_keyword(text: str, keyword: str) -> str:
    lowered = text.lower()
    index = lowered.find(keyword)
    if index < 0:
        return ""
    fragment = text[index + len(keyword):].strip(" .,:;-")
    return _clean_phrase(fragment)


def _extract_medication_name(text: str) -> str:
    patterns = [
        r"refill(?: for| of)? (?P<value>[a-zA-Z0-9 \-]+?)(?=$|[,.]| and\b| but\b| my\b| the\b)",
        r"medication(?: for)? (?P<value>[a-zA-Z0-9 \-]+?)(?=$|[,.]| and\b| but\b| my\b| the\b)",
        r"(?:it'?s|it is) for (?P<value>[a-zA-Z0-9 \-]+?)(?=$|[,.]| and\b| but\b| my\b| the\b)",
        r"\bfor (?P<value>[a-zA-Z0-9 \-]+?)(?=$|[,.]| and\b| but\b| my\b| the\b)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group("value").strip(" .")
    return ""


def _extract_request_type(text: str) -> Optional[str]:
    lowered = _normalize(text)
    if any(token in lowered for token in ["reschedule", "move my appointment", "change my appointment"]):
        return "reschedule"
    if any(token in lowered for token in ["cancel", "cancellation"]):
        return "cancel"
    if any(token in lowered for token in ["schedule", "appointment", "book", "set up"]):
        return "schedule"
    return None


def _extract_visit_type(text: str) -> Optional[str]:
    lowered = _normalize(text)
    visit_patterns = [
        ("physical", [r"\bphysical\b", r"\bannual physical\b"]),
        ("follow-up", [r"\bfollow(?: |-)?up\b"]),
        ("consultation", [r"\bconsult(?:ation)?\b"]),
        ("new patient visit", [r"\bnew patient\b"]),
        ("sick visit", [r"\bsick visit\b"]),
        ("annual visit", [r"\bannual visit\b"]),
        ("checkup", [r"\bcheck(?: |-)?up\b"]),
    ]
    for label, patterns in visit_patterns:
        if any(re.search(pattern, lowered) for pattern in patterns):
            return label
    return None


def _extract_preferred_date(text: str) -> Optional[str]:
    lowered = _normalize(text)

    for keyword in ["today", "tomorrow"]:
        if re.search(rf"\b{keyword}\b", lowered):
            return keyword.capitalize()

    weekday_match = re.search(
        r"\b(?:(next)\s+)?(" + "|".join(WEEKDAY_NAMES) + r")\b",
        lowered,
    )
    if weekday_match:
        prefix = "next " if weekday_match.group(1) else ""
        return f"{prefix}{weekday_match.group(2).capitalize()}".strip()

    month_match = re.search(
        r"\b(" + "|".join(MONTH_NAMES) + r")\s+\d{1,2}(?:st|nd|rd|th)?\b",
        lowered,
    )
    if month_match:
        return month_match.group(0).title()

    return None


def _format_time_label(hour: int, minute: int, meridiem: Optional[str]) -> Optional[str]:
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None

    if meridiem:
        normalized = meridiem.lower().replace(".", "")
        if normalized == "pm" and hour < 12:
            hour += 12
        if normalized == "am" and hour == 12:
            hour = 0

    display_hour = hour
    suffix = "AM"
    if hour == 0:
        display_hour = 12
    elif hour == 12:
        suffix = "PM"
    elif hour > 12:
        display_hour = hour - 12
        suffix = "PM"

    return f"{display_hour}:{minute:02d} {suffix}"


def _extract_preferred_time(text: str) -> Optional[str]:
    lowered = _normalize(text)
    if "noon" in lowered:
        return "12:00 PM"
    if "midnight" in lowered:
        return "12:00 AM"

    numeric_patterns = [
        r"\bat\s+(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?\s*(?P<meridiem>a\.?m\.?|p\.?m\.?)?\b",
        r"\bfor\s+(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?\s*(?P<meridiem>a\.?m\.?|p\.?m\.?)\b",
    ]
    for pattern in numeric_patterns:
        match = re.search(pattern, lowered)
        if not match:
            continue
        hour = int(match.group("hour"))
        minute = int(match.group("minute") or "0")
        return _format_time_label(hour, minute, match.group("meridiem"))

    standalone_numeric = re.fullmatch(r"(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?\s*(?P<meridiem>a\.?m\.?|p\.?m\.?)?", lowered)
    if standalone_numeric:
        hour = int(standalone_numeric.group("hour"))
        minute = int(standalone_numeric.group("minute") or "0")
        return _format_time_label(hour, minute, standalone_numeric.group("meridiem"))

    word_match = re.search(
        r"\bat\s+(?P<hour_word>" + "|".join(WORD_NUMBER_MAP.keys()) + r")\s*(?P<meridiem>a\.?m\.?|p\.?m\.?)?\b",
        lowered,
    )
    if word_match:
        hour = WORD_NUMBER_MAP[word_match.group("hour_word")]
        return _format_time_label(hour, 0, word_match.group("meridiem"))

    standalone_word = re.fullmatch(
        r"(?P<hour_word>" + "|".join(WORD_NUMBER_MAP.keys()) + r")\s*(?P<meridiem>a\.?m\.?|p\.?m\.?)?",
        lowered,
    )
    if standalone_word:
        hour = WORD_NUMBER_MAP[standalone_word.group("hour_word")]
        return _format_time_label(hour, 0, standalone_word.group("meridiem"))

    return None


def _with_indefinite_article(value: str) -> str:
    cleaned = _clean_phrase(value)
    if not cleaned:
        return ""
    article = "an" if cleaned[0].lower() in {"a", "e", "i", "o", "u"} else "a"
    return f"{article} {cleaned}"


def _build_scheduling_summary(slots: SchedulingSlotState) -> str:
    visit_phrase = _with_indefinite_article(slots.visitType or "appointment")
    if slots.requestType == "reschedule":
        base = f"to reschedule {visit_phrase}"
    elif slots.requestType == "cancel":
        base = f"to cancel {visit_phrase}"
    else:
        base = visit_phrase

    if slots.preferredDate:
        base += f" on {slots.preferredDate}"
    if slots.preferredTime:
        base += f" at {slots.preferredTime}"
    return base


def _slot_retry_key(domain: str, slot_name: str) -> str:
    return f"{domain}.{slot_name}"


def _clear_slot_retry(session: SessionState, domain: str, slot_name: str):
    session.slotRetryCounts.pop(_slot_retry_key(domain, slot_name), None)


def _is_explicit_unknown(text: str) -> bool:
    lowered = _normalize(text)
    return any(phrase in lowered for phrase in EXPLICIT_UNKNOWN_PHRASES)


def _should_escalate_missing_slot(session: SessionState, domain: str, slot_name: str, text: str) -> bool:
    if _is_explicit_unknown(text):
        session.slotRetryCounts[_slot_retry_key(domain, slot_name)] = REQUIRED_SLOT_RETRY_THRESHOLD
        return True

    prior_missing_slot = session.missingSlots[0] if session.missingSlots else None
    if session.activeDomain == domain and session.stage == "intake" and prior_missing_slot == slot_name:
        retry_key = _slot_retry_key(domain, slot_name)
        attempts = session.slotRetryCounts.get(retry_key, 0) + 1
        session.slotRetryCounts[retry_key] = attempts
        return attempts >= REQUIRED_SLOT_RETRY_THRESHOLD

    return False


def _append_note(notes: List[str], text: str, *ignored_values: Optional[str]):
    cleaned_text = _clean_phrase(text)
    if not cleaned_text:
        return

    ignored = {_normalize(value) for value in ignored_values if value}
    if ignored and len(cleaned_text.split()) <= 6:
        return
    normalized = _normalize(cleaned_text)
    if normalized in ignored:
        return
    if normalized not in {_normalize(note) for note in notes}:
        notes.append(cleaned_text)


def _is_simple_slot_response(text: str, max_words: int = 6) -> bool:
    cleaned = _clean_phrase(text)
    return bool(cleaned) and len(cleaned.split()) <= max_words


def _looks_like_account_reference(text: str) -> bool:
    cleaned = _clean_phrase(text)
    return bool(re.fullmatch(r"[A-Za-z0-9\- ]{3,40}", cleaned)) and any(
        character.isdigit() or character == "-" for character in cleaned
    )


def _condense_notes(notes: List[str], limit: int = 4) -> str:
    return " ".join(notes[-limit:]).strip()


def _render_confirmation_prompt(
    session: SessionState,
    domain: str,
    fallback: str,
    replacements: Dict[str, str],
) -> str:
    template = _dialogue_policy(session, domain).confirmationTemplate.strip()
    if not template:
        return fallback

    rendered = template
    for key, value in replacements.items():
        rendered = rendered.replace(f"{{{key}}}", value)
    return re.sub(r"\s+", " ", rendered).strip()


def _humanize_slot_name(slot_name: str) -> str:
    return {
        "callerDob": "date of birth",
        "pharmacyName": "pharmacy name",
        "pharmacyPhone": "pharmacy phone number",
        "accountReference": "account or statement reference",
        "billingTopic": "billing issue",
        "medicationName": "medication name",
        "memberId": "member ID",
        "groupNumber": "group number",
        "patientName": "patient name",
        "patientDob": "patient date of birth",
        "subscriberRelation": "subscriber relationship",
        "serviceType": "visit or service type",
        "callbackPhone": "callback number",
        "reasonSummary": "reason for the handoff",
    }.get(slot_name, slot_name)


def _normalize_spoken_date(month: int, day: int, year: int) -> Optional[str]:
    try:
        return datetime(year, month, day).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _normalize_two_digit_year(year: int) -> int:
    if year >= 100:
        return year
    current_two_digit_year = int(datetime.now(timezone.utc).strftime("%y"))
    return 2000 + year if year <= current_two_digit_year else 1900 + year


def _extract_caller_dob(text: str) -> Optional[str]:
    iso_match = re.search(r"\b(?P<year>\d{4})-(?P<month>\d{1,2})-(?P<day>\d{1,2})\b", text)
    if iso_match:
        return _normalize_spoken_date(
            int(iso_match.group("month")),
            int(iso_match.group("day")),
            int(iso_match.group("year")),
        )

    numeric_match = re.search(r"\b(?P<month>\d{1,2})[/-](?P<day>\d{1,2})[/-](?P<year>\d{2,4})\b", text)
    if numeric_match:
        return _normalize_spoken_date(
            int(numeric_match.group("month")),
            int(numeric_match.group("day")),
            _normalize_two_digit_year(int(numeric_match.group("year"))),
        )

    month_match = re.search(
        r"\b(?P<month>"
        + "|".join(MONTH_NAMES)
        + r")\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(?P<year>\d{2,4})\b",
        text,
        re.IGNORECASE,
    )
    if month_match:
        month_number = MONTH_NAMES.index(month_match.group("month").lower()) + 1
        return _normalize_spoken_date(
            month_number,
            int(month_match.group("day")),
            _normalize_two_digit_year(int(month_match.group("year"))),
        )

    return None


def _normalize_phone_number(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return ""
    return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"


def _extract_phone_number(text: str) -> str:
    match = re.search(
        r"(?P<value>(?:\+?1[\s.\-]*)?(?:\(?\d{3}\)?[\s.\-]*)\d{3}[\s.\-]*\d{4})",
        text,
        re.IGNORECASE,
    )
    if not match:
        return ""
    return _normalize_phone_number(match.group("value"))


def _extract_pharmacy_name(text: str) -> str:
    patterns = [
        r"(?:my pharmacy is|the pharmacy is|pharmacy is|send it to|use|at)\s+(?P<value>[A-Za-z][A-Za-z0-9 '&.\-]{1,60}?)(?=$|[,.]| and\b| phone\b| number\b)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return _clean_phrase(match.group("value"))
    return ""


def _extract_prescriber_name(text: str) -> str:
    patterns = [
        r"(?:from|for)\s+(?P<value>dr\.?\s+[A-Za-z][A-Za-z.\- ]+?)(?=$|[,.]| and\b)",
        r"prescriber(?: is|:)?\s+(?P<value>dr\.?\s+[A-Za-z][A-Za-z.\- ]+?)(?=$|[,.]| and\b)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return _clean_phrase(match.group("value"))
    return ""


def _extract_account_reference(text: str) -> tuple[str, str]:
    patterns = [
        r"(?:account(?: number| ref(?:erence)?)?|reference number|statement number|invoice number)\s*(?:is|:|#)?\s*(?P<value>[A-Za-z0-9][A-Za-z0-9\- ]*?[A-Za-z0-9])(?=$|[,.]| and\b| about\b| regarding\b| because\b)",
        r"account ending in\s*(?P<value>[A-Za-z0-9][A-Za-z0-9\- ]*?[A-Za-z0-9])(?=$|[,.]| and\b| about\b| regarding\b| because\b)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        value = _clean_phrase(match.group("value"))
        stripped = _clean_phrase(f"{text[:match.start()]} {text[match.end():]}")
        return value, stripped
    return "", text.strip()


def _normalize_billing_topic(text: str) -> str:
    cleaned = _clean_phrase(text)
    if not cleaned:
        return ""

    patterns = [
        r"^(?:i(?:'m| am)?\s+)?(?:have|need)\s+(?:a\s+)?billing (?:question|issue|request|problem)\s*(?:about|for|regarding|with)?\s*",
        r"^(?:billing (?:question|issue|request|problem))\s*(?:about|for|regarding|with)?\s*",
        r"^(?:it'?s|it is)\s*(?:about|for|regarding|with)\s*",
        r"^(?:question|issue|problem)\s*(?:about|for|regarding|with)?\s*",
        r"^(?:i(?:'m| am)?\s+calling about|calling about|need help with|help with)\s*",
        r"^(?:about|for|regarding|with)\s*",
    ]
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    return _clean_phrase(cleaned)


def _build_refill_summary(slots: RefillSlotState) -> str:
    parts = []
    if slots.medicationName:
        parts.append(f"for {slots.medicationName}")
    if slots.callerDob:
        parts.append(f"date of birth {slots.callerDob}")
    if slots.pharmacyName:
        parts.append(f"pharmacy {slots.pharmacyName}")
    if slots.pharmacyPhone:
        parts.append(f"phone {slots.pharmacyPhone}")
    return f"a refill request {', '.join(parts)}" if parts else "a refill request"


def _build_billing_summary(slots: BillingSlotState) -> str:
    topic = slots.billingTopic or "billing question"
    if slots.accountReference:
        return f"a billing request about {topic} for account {slots.accountReference}"
    return f"a billing request about {topic}"


def _format_missing_labels(missing_fields: List[str]) -> str:
    return ", ".join(_humanize_slot_name(field) for field in missing_fields)


def _build_manual_follow_up_result(
    session: SessionState,
    *,
    domain: str,
    title: str,
    summary: str,
    next_prompt: str,
    extracted_fields: Dict[str, Any],
    missing_fields: List[str],
    operator_headline: str,
    operator_next_step: str,
) -> SpecialistResult:
    return SpecialistResult(
        domain=domain,  # type: ignore[arg-type]
        status="ready_for_confirmation",
        confidence=0.9,
        nextPrompt=next_prompt,
        extractedFields=extracted_fields,
        missingFields=missing_fields,
        confirmationSummary=summary,
        runtimeAction="manual-follow-up",
        runtimePayload={
            "callerName": session.callerName or "Caller",
            "callerPhone": session.callerPhone,
            "title": title,
            "summary": summary,
            "priority": "HIGH",
            "metadata": {
                "originatingDomain": domain,
                "missingRequiredFields": missing_fields,
                "capturedFields": extracted_fields,
            },
            "confirmed": True,
        },
        fallbackRecommendation=session.runtimeConfig.voicePolicyV2.fallbackRuntimeAction,
        operatorSummary=OperatorSummary(
            headline=operator_headline,
            nextStep=operator_next_step,
            specialist=domain,  # type: ignore[arg-type]
            callerRequest=summary,
            followUpRequired=True,
        ),
        callerRequestSummary=summary,
    )


def _strip_change_prefix(text: str) -> str:
    updated = re.sub(
        r"^(?:actually|wait|hold on|sorry|no|not that|change it to|make it|instead)\b[ ,.-]*",
        "",
        text.strip(),
        flags=re.IGNORECASE,
    )
    return updated.strip() or text.strip()


def _extract_insurance_carrier(text: str) -> str:
    lowered = text.lower()
    for carrier in COMMON_INSURANCE_CARRIERS:
        if carrier in lowered:
            return carrier.title()
    return ""


def _extract_insurance_inquiry_type(text: str) -> Optional[str]:
    lowered = _normalize(text)
    if any(token in lowered for token in ["prior auth", "prior authorization", "authorization status"]):
        return "prior_auth_status"
    if any(token in lowered for token in ["claim status", "claim", "appeal"]):
        return "claim_status"
    if any(token in lowered for token in ["copay", "co pay", "deductible", "benefits", "covered for", "coverage for"]):
        return "coverage"
    if any(token in lowered for token in ["eligibility", "eligible", "active coverage", "coverage active", "still active"]):
        return "eligibility"
    if any(token in lowered for token in ["take ", "accept", "accepted", "works with", "in network", "participate with"]):
        return "acceptance"
    return None


def _extract_plan_name(text: str) -> str:
    patterns = [
        r"(?:plan(?: name)?|policy)\s*(?:is|:)?\s*(?P<value>[A-Za-z0-9][A-Za-z0-9 \-]{1,40})",
        r"\b(?P<value>(?:ppo|hmo|epo|pos|medicare advantage|medicaid managed care))\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return _clean_phrase(match.group("value"))
    return ""


def _extract_member_id(text: str) -> str:
    patterns = [
        r"(?:member(?: id| number)?|subscriber(?: id| number)?|policy number)\s*(?:is|:|#)?\s*(?P<value>[A-Za-z0-9\-]{3,40})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return _clean_phrase(match.group("value"))
    cleaned = _clean_phrase(text)
    if cleaned and len(cleaned.split()) <= 3 and re.fullmatch(r"[A-Za-z0-9\-]{3,40}", cleaned):
        return cleaned
    return ""


def _extract_group_number(text: str) -> str:
    match = re.search(r"(?:group(?: number)?|grp)\s*(?:is|:|#)?\s*(?P<value>[A-Za-z0-9\-]{2,40})", text, re.IGNORECASE)
    if match:
        return _clean_phrase(match.group("value"))
    return ""


def _extract_subscriber_relation(text: str) -> Optional[str]:
    lowered = _normalize(text)
    if any(token in lowered for token in ["my plan", "for me", "i am the subscriber", "self"]):
        return "self"
    if "spouse" in lowered or "husband" in lowered or "wife" in lowered:
        return "spouse"
    if "child" in lowered or "daughter" in lowered or "son" in lowered:
        return "child"
    if any(token in lowered for token in ["parent", "other family member", "other person"]):
        return "other"
    return None


def _extract_patient_name(text: str) -> str:
    patterns = [
        r"(?:patient(?: name)?|for)\s*(?:is|:)?\s*(?P<value>[A-Z][a-z]+(?: [A-Z][a-z]+){1,2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return _clean_phrase(match.group("value"))
    return ""


def _extract_service_type(text: str) -> str:
    visit_type = _extract_visit_type(text)
    if visit_type:
        return visit_type
    lowered = _normalize(text)
    if "procedure" in lowered:
        return "procedure"
    if "lab" in lowered or "labs" in lowered:
        return "lab work"
    if "imaging" in lowered or "x-ray" in lowered or "x ray" in lowered:
        return "imaging"
    return ""


def _extract_reason_summary(text: str) -> str:
    cleaned = _clean_phrase(text)
    generic_phrases = {
        "i need to speak to someone",
        "can a person help me",
        "transfer me",
        "i need a person",
        "i need someone",
        "someone please",
        "staff please",
        "human please",
    }
    if _normalize(cleaned) in generic_phrases:
        return ""
    return cleaned


def _extract_reason_category(text: str, active_domain: Optional[str] = None) -> str:
    lowered = _normalize(text)
    if any(token in lowered for token in ["clinical", "nurse", "symptom", "medication issue"]):
        return "clinical"
    if any(token in lowered for token in ["appointment", "schedule", "physical", "follow-up"]):
        return "appointments"
    if any(token in lowered for token in ["refill", "prescription", "pharmacy"]):
        return "refill"
    if any(token in lowered for token in ["insurance", "coverage", "claim", "prior auth"]):
        return "insurance"
    if any(token in lowered for token in ["billing", "statement", "balance", "payment"]):
        return "billing"
    if active_domain in {"scheduling", "refill", "insurance", "billing"}:
        return {
            "scheduling": "appointments",
            "refill": "refill",
            "insurance": "insurance",
            "billing": "billing",
        }[active_domain]
    return "general"


def _extract_callback_window(text: str) -> str:
    patterns = [
        r"(?:after|around|at)\s+(?P<value>\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)",
        r"(?P<value>this afternoon|this morning|tomorrow morning|tomorrow afternoon|later today)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return _clean_phrase(match.group("value"))
    return ""


def _looks_like_transfer_request(text: str) -> bool:
    lowered = _normalize(text)
    return any(token in lowered for token in ["transfer me now", "connect me now", "put me through", "transfer me"])


def _build_insurance_summary(slots: InsuranceSlotState) -> str:
    inquiry_label = slots.inquiryType.replace("_", " ") if slots.inquiryType else "insurance"
    parts = []
    if slots.carrierName:
        parts.append(slots.carrierName)
    if slots.planName:
        parts.append(slots.planName)
    if slots.memberId:
        parts.append(f"member ID {slots.memberId}")
    if slots.patientDob:
        parts.append(f"date of birth {slots.patientDob}")
    if slots.serviceType:
        parts.append(f"for {slots.serviceType}")
    details = ", ".join(parts)
    return f"{inquiry_label} request about {details}" if details else f"{inquiry_label} request"


def _insurance_required_fields(slots: InsuranceSlotState, session: SessionState) -> List[str]:
    inquiry_type = slots.inquiryType or "acceptance"
    if inquiry_type == "eligibility":
        missing = [
            field
            for field in INSURANCE_ELIGIBILITY_REQUIRED_FIELDS
            if not getattr(slots, field)
        ]
        if not session.callerName and not slots.patientName:
            missing.append("patientName")
        return missing
    if inquiry_type in {"coverage", "claim_status", "prior_auth_status"}:
        missing = [
            field
            for field in INSURANCE_FOLLOW_UP_REQUIRED_FIELDS
            if not getattr(slots, field)
        ]
        if not session.callerName and not slots.patientName:
            missing.append("patientName")
        return missing
    return [field for field in INSURANCE_ACCEPTANCE_REQUIRED_FIELDS if not getattr(slots, field)]


def _insurance_follow_up_only(slots: InsuranceSlotState, text: str) -> bool:
    inquiry_type = slots.inquiryType or _extract_insurance_inquiry_type(text) or "acceptance"
    return inquiry_type in {"coverage", "claim_status", "prior_auth_status"}


def _meaningful_tokens(text: str) -> List[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", _normalize(text))
        if token and token not in FAQ_TOKEN_STOPWORDS
    ]


def _current_local_time(session: SessionState) -> datetime:
    try:
        return datetime.now(ZoneInfo(session.runtimeConfig.business.timeZone))
    except ZoneInfoNotFoundError:
        return datetime.now(timezone.utc)


def _find_hours_entry(session: SessionState, day_of_week: int) -> Optional[Dict[str, Any]]:
    operating_hours = session.runtimeConfig.settings.get("operatingHours") or []
    return next((entry for entry in operating_hours if entry.get("dayOfWeek") == day_of_week), None)


def _is_entry_open_now(entry: Dict[str, Any], current_time: datetime) -> bool:
    if not entry or entry.get("isClosed"):
        return False

    start_time = entry.get("startTime")
    end_time = entry.get("endTime")
    if not start_time or not end_time:
        return False

    local_time = current_time.strftime("%H:%M")
    return start_time <= local_time <= end_time


def _format_day_hours_answer(
    session: SessionState,
    *,
    day_of_week: int,
    day_label: str,
    qualifier: str,
) -> str:
    entry = _find_hours_entry(session, day_of_week)
    if not entry or entry.get("isClosed"):
        return f"The office is closed {qualifier} {day_label}. I can still take a message for the staff."

    start_time = entry.get("startTime")
    end_time = entry.get("endTime")
    if not start_time or not end_time:
        return f"The office is open {qualifier} {day_label}, but I do not have the exact posted hours right now."
    return f"The office is open {qualifier} {day_label} from {start_time} to {end_time}."


def _format_hours(session: SessionState) -> str:
    operating_hours = session.runtimeConfig.settings.get("operatingHours") or []
    if not operating_hours:
        return "The practice has not published office hours yet, but I can still take a message for the staff."

    current_time = _current_local_time(session)
    day_of_week = int(current_time.strftime("%w"))
    today_label = current_time.strftime("%A")
    return _format_day_hours_answer(
        session,
        day_of_week=day_of_week,
        day_label=today_label,
        qualifier="today,",
    )


def _enabled_service_labels(session: SessionState) -> str:
    enabled_domains = set(session.runtimeConfig.voicePolicyV2.enabledDomains)
    labels = []
    if "scheduling" in enabled_domains:
        labels.append("appointments")
    if "refill" in enabled_domains:
        labels.append("prescription refills")
    if "insurance" in enabled_domains:
        labels.append("insurance questions")
    if "billing" in enabled_domains:
        labels.append("billing support")
    return ", ".join(labels) or "general staff messages"


class SafetyAgent:
    def evaluate(self, session: SessionState, text: str) -> Optional[SpecialistResult]:
        lowered = _normalize(text)
        emergency_keywords = EMERGENCY_KEYWORDS + session.runtimeConfig.voicePolicyV2.emergencyKeywords
        matched = [keyword for keyword in emergency_keywords if keyword and keyword in lowered]
        if matched:
            session.isEmergency = True
            return SpecialistResult(
                domain="safety",
                status="handoff",
                confidence=1.0,
                nextPrompt=(
                    "I'm hearing something that may be a medical emergency. "
                    "Please call 911 right away or go to the nearest emergency room."
                ),
                operatorSummary=OperatorSummary(
                    headline="Emergency language detected",
                    nextStep="Escalate immediately and confirm emergency guidance was given.",
                    specialist="safety",
                    callerRequest=text.strip() or "Emergency concern",
                    followUpRequired=True,
                ),
                callerRequestSummary="Emergency concern reported by caller.",
                requestHumanFollowUp=True,
                resolved=True,
            )

        if any(phrase in lowered for phrase in CLINICAL_ADVICE_PHRASES):
            return SpecialistResult(
                domain="safety",
                status="handoff",
                confidence=0.92,
                nextPrompt=(
                    "I'm not able to provide medical advice, but I can connect you with a staff member or capture a message for clinical follow-up."
                ),
                fallbackRecommendation="manual-follow-up",
                operatorSummary=OperatorSummary(
                    headline="Clinical advice request redirected",
                    nextStep="Route to staff follow-up for clinical guidance.",
                    specialist="safety",
                    callerRequest=text.strip() or "Clinical advice request",
                    followUpRequired=True,
                ),
                callerRequestSummary="Caller requested medical advice and was redirected to staff.",
                requestHumanFollowUp=True,
                resolved=True,
            )

        return None


class KnowledgeAgent:
    OFFICE_HOURS_KEYWORDS = [
        "hours",
        "open",
        "open right now",
        "open now",
        "close",
        "closing",
    ]
    SERVICES_KEYWORDS = [
        "services",
        "what do you do",
        "what can you help with",
        "what do you handle",
        "what do you help with",
    ]
    AFTER_HOURS_KEYWORDS = [
        "after hours",
        "after-hours",
        "voicemail",
        "callback",
        "call back",
    ]
    APPOINTMENT_POLICY_KEYWORDS = [
        "appointment",
        "appointments",
        "new patient",
        "physical",
        "follow-up",
        "follow up",
        "walk-ins",
        "walk ins",
    ]
    REFILL_POLICY_KEYWORDS = [
        "refill",
        "refills",
        "prescription",
        "prescriptions",
        "pharmacy info",
        "pharmacy information",
    ]
    INSURANCE_POLICY_KEYWORDS = [
        "insurance accepted",
        "insurance",
        "coverage",
        "carrier",
        "copay",
    ]
    BILLING_POLICY_KEYWORDS = [
        "billing",
        "statement",
        "balance",
        "payment",
    ]
    RECORDING_POLICY_KEYWORDS = [
        "record calls",
        "recorded",
        "recording",
        "record",
    ]
    RETENTION_POLICY_KEYWORDS = [
        "transcript",
        "retention",
        "how long do you keep",
        "keep transcripts",
    ]
    QUESTION_PREFIXES = [
        "what",
        "when",
        "how",
        "which",
        "do you",
        "are you",
        "can you",
        "will you",
        "does the",
        "is the",
        "tell me",
    ]

    def match(self, session: SessionState, text: str) -> Optional[KnowledgeMatch]:
        return self._match_knowledge_topic(session, text)

    def contains_out_of_scope_keywords(self, session: SessionState, text: str) -> List[str]:
        return self._contains_out_of_scope_keyword(session, text)

    def handle(self, session: SessionState, text: str) -> Optional[SpecialistResult]:
        matched_out_of_scope = self._contains_out_of_scope_keyword(session, text)
        if matched_out_of_scope:
            return SpecialistResult(
                domain="knowledge",
                status="answered",
                confidence=0.89,
                nextPrompt=(
                    "I'm not able to help with that topic, but I can answer practice questions or take a message for the staff."
                ),
                operatorSummary=OperatorSummary(
                    headline="Out-of-scope request safely deflected",
                    nextStep="Offer practice help or staff follow-up if the caller still needs assistance.",
                    specialist="knowledge",
                    callerRequest=text.strip() or "Out-of-scope request",
                ),
                callerRequestSummary="Out-of-scope request safely deflected.",
                resolved=True,
            )

        match = self._match_knowledge_topic(session, text)
        if not match:
            return None

        return SpecialistResult(
            domain="knowledge",
            status="answered",
            confidence=0.94 if match.topic != "custom_faq" else 0.96,
            nextPrompt=match.answer,
            operatorSummary=OperatorSummary(
                headline=self._knowledge_headline(match.topic),
                nextStep="No staff follow-up is needed unless the caller asks for something else.",
                specialist="knowledge",
                callerRequest=text.strip() or "Practice question",
            ),
            callerRequestSummary=self._knowledge_summary(match.topic, match.source),
            resolved=True,
        )

    def _match_keywords(self, lowered: str, keywords: List[str]) -> List[str]:
        return [keyword for keyword in keywords if keyword and _phrase_in_text(lowered, keyword)]

    def _looks_like_question(self, lowered: str, text: str) -> bool:
        return "?" in text or any(lowered.startswith(prefix) for prefix in self.QUESTION_PREFIXES)

    def _match_knowledge_topic(self, session: SessionState, text: str) -> Optional[KnowledgeMatch]:
        lowered = _normalize(text)
        question_like = self._looks_like_question(lowered, text)

        custom_faq_match = self._match_custom_faq(session, text)
        if custom_faq_match:
            return custom_faq_match

        after_hours_keywords = self._match_keywords(lowered, self.AFTER_HOURS_KEYWORDS)
        if after_hours_keywords:
            return KnowledgeMatch(
                topic="after_hours",
                answer=session.runtimeConfig.voicePolicyV2.afterHoursPolicy.greeting,
                matchedKeywords=after_hours_keywords,
                source="after_hours_policy",
            )

        recording_keywords = self._match_keywords(lowered, self.RECORDING_POLICY_KEYWORDS)
        if recording_keywords:
            return KnowledgeMatch(
                topic="recording_policy",
                answer=self._answer_recording_question(session),
                matchedKeywords=recording_keywords,
                source="recording_default",
            )

        retention_keywords = self._match_keywords(lowered, self.RETENTION_POLICY_KEYWORDS)
        if retention_keywords:
            return KnowledgeMatch(
                topic="transcript_retention",
                answer=self._answer_retention_question(session),
                matchedKeywords=retention_keywords,
                source="transcript_retention_days",
            )

        office_hours_keywords = self._match_keywords(lowered, self.OFFICE_HOURS_KEYWORDS)
        weekday_keywords = [weekday for weekday in WEEKDAY_NAMES if weekday in lowered]
        day_reference_keywords = [keyword for keyword in ["today", "tomorrow"] if keyword in lowered] + weekday_keywords
        if office_hours_keywords or (
            day_reference_keywords and any(keyword in lowered for keyword in ["hours", "open", "close", "closing"])
        ):
            return KnowledgeMatch(
                topic="office_hours",
                answer=self._answer_hours_question(session, text),
                matchedKeywords=office_hours_keywords + day_reference_keywords,
                source="operating_hours",
            )

        services_keywords = self._match_keywords(lowered, self.SERVICES_KEYWORDS)
        common_question_matches = [
            question.lower()
            for question in session.runtimeConfig.voicePolicyV2.knowledgeConfig.commonQuestions
            if question and question.lower() in lowered
        ]
        if services_keywords or common_question_matches:
            return KnowledgeMatch(
                topic="services",
                answer=self._answer_services_question(session),
                matchedKeywords=services_keywords + common_question_matches,
                source="knowledge_config.servicesSummary" if session.runtimeConfig.voicePolicyV2.knowledgeConfig.servicesSummary else "knowledge_config.faqSummary",
            )

        appointment_keywords = self._match_keywords(lowered, self.APPOINTMENT_POLICY_KEYWORDS)
        if appointment_keywords and question_like:
            return KnowledgeMatch(
                topic="appointment_policy",
                answer=self._answer_policy_question(session, "appointment_policy"),
                matchedKeywords=appointment_keywords,
                source="knowledge_config.appointmentSummary",
            )

        refill_keywords = self._match_keywords(lowered, self.REFILL_POLICY_KEYWORDS)
        if refill_keywords and question_like:
            return KnowledgeMatch(
                topic="refill_policy",
                answer=self._answer_policy_question(session, "refill_policy"),
                matchedKeywords=refill_keywords,
                source="knowledge_config.refillSummary",
            )

        insurance_keywords = self._match_keywords(lowered, self.INSURANCE_POLICY_KEYWORDS)
        if insurance_keywords and question_like:
            return KnowledgeMatch(
                topic="insurance_policy",
                answer=self._answer_policy_question(session, "insurance_policy"),
                matchedKeywords=insurance_keywords,
                source="knowledge_config.insuranceSummary",
            )

        billing_keywords = self._match_keywords(lowered, self.BILLING_POLICY_KEYWORDS)
        if billing_keywords and question_like:
            return KnowledgeMatch(
                topic="billing_policy",
                answer=self._answer_policy_question(session, "billing_policy"),
                matchedKeywords=billing_keywords,
                source="knowledge_config.billingSummary",
            )

        return None

    def _answer_hours_question(self, session: SessionState, text: str) -> str:
        lowered = _normalize(text)
        operating_hours = session.runtimeConfig.settings.get("operatingHours") or []
        if not operating_hours:
            return "The practice has not published office hours yet, but I can still take a message for the staff."

        current_time = _current_local_time(session)
        current_day = int(current_time.strftime("%w"))
        current_label = current_time.strftime("%A")

        if "open right now" in lowered or "open now" in lowered:
            entry = _find_hours_entry(session, current_day)
            if not entry or entry.get("isClosed"):
                return f"The office is closed right now. It is closed today, {current_label}. I can still take a message for the staff."
            start_time = entry.get("startTime")
            end_time = entry.get("endTime")
            if not start_time or not end_time:
                return f"The office is open on {current_label}, but I do not have the exact posted hours right now."
            if _is_entry_open_now(entry, current_time):
                return f"Yes, the office is open right now. Today's hours are {current_label} from {start_time} to {end_time}."
            return f"The office is closed right now. Today's hours are {current_label} from {start_time} to {end_time}."

        if "tomorrow" in lowered:
            tomorrow = current_time + timedelta(days=1)
            return _format_day_hours_answer(
                session,
                day_of_week=int(tomorrow.strftime("%w")),
                day_label=tomorrow.strftime("%A"),
                qualifier="tomorrow,",
            )

        for weekday in WEEKDAY_NAMES:
            if weekday in lowered:
                day_of_week = WEEKDAY_TO_DAY_INDEX.get(weekday, current_day)
                return _format_day_hours_answer(
                    session,
                    day_of_week=day_of_week,
                    day_label=weekday.capitalize(),
                    qualifier="on",
                )

        return _format_hours(session)

    def _answer_services_question(self, session: SessionState) -> str:
        knowledge = session.runtimeConfig.voicePolicyV2.knowledgeConfig
        return knowledge.servicesSummary or knowledge.faqSummary or f"I can help with {_enabled_service_labels(session)}."

    def _answer_policy_question(self, session: SessionState, topic: KnowledgeTopic) -> str:
        knowledge = session.runtimeConfig.voicePolicyV2.knowledgeConfig
        if topic == "appointment_policy":
            return knowledge.appointmentSummary or knowledge.servicesSummary or knowledge.faqSummary
        if topic == "refill_policy":
            return knowledge.refillSummary or knowledge.servicesSummary or knowledge.faqSummary
        if topic == "insurance_policy":
            return knowledge.insuranceSummary or knowledge.servicesSummary or knowledge.faqSummary
        if topic == "billing_policy":
            return knowledge.billingSummary or knowledge.servicesSummary or knowledge.faqSummary
        return knowledge.servicesSummary or knowledge.faqSummary or f"I can help with {_enabled_service_labels(session)}."

    def _answer_recording_question(self, session: SessionState) -> str:
        default_setting = str(session.runtimeConfig.settings.get("recordingDefault") or "ASK").upper()
        if default_setting == "ON":
            return "Calls are recorded by default for operational review."
        if default_setting == "OFF":
            return "Calls are not recorded by default."
        return "Recording is requested from the caller before a call is recorded."

    def _answer_retention_question(self, session: SessionState) -> str:
        retention_days = int(session.runtimeConfig.settings.get("transcriptRetentionDays") or 0)
        if retention_days <= 0:
            return "Transcript retention is controlled by the practice policy."
        day_label = "day" if retention_days == 1 else "days"
        return f"Call transcripts are kept for {retention_days} {day_label} before automated cleanup."

    def _match_custom_faq(self, session: SessionState, text: str) -> Optional[KnowledgeMatch]:
        lowered = _normalize(text)
        text_tokens = set(_meaningful_tokens(text))
        best_match: Optional[KnowledgeMatch] = None
        best_overlap = 0

        for item in session.runtimeConfig.voicePolicyV2.knowledgeConfig.customFaqs:
            question = _normalize(item.question)
            if not question or not item.answer:
                continue

            matched_keywords: List[str] = []
            if question in lowered:
                matched_keywords = [question]
            else:
                question_tokens = set(_meaningful_tokens(item.question))
                overlap = sorted(question_tokens & text_tokens)
                required_overlap = 1 if len(question_tokens) <= 2 else 2
                if len(overlap) >= required_overlap:
                    matched_keywords = overlap

            if not matched_keywords:
                continue

            overlap_score = len(matched_keywords)
            if overlap_score < best_overlap:
                continue

            route_to = item.routeTo if item.routeTo in {"knowledge", "scheduling", "refill", "insurance", "billing", "handoff"} else None
            best_match = KnowledgeMatch(
                topic="custom_faq",
                answer=item.answer.strip(),
                matchedKeywords=matched_keywords,
                source=item.question.strip(),
                routeToDomain=route_to,
            )
            best_overlap = overlap_score

        return best_match

    def _contains_out_of_scope_keyword(self, session: SessionState, text: str) -> List[str]:
        lowered = _normalize(text)
        return [
            keyword
            for keyword in session.runtimeConfig.voicePolicyV2.outOfScopeKeywords
            if keyword and _phrase_in_text(lowered, keyword)
        ]

    def _knowledge_headline(self, topic: KnowledgeTopic) -> str:
        return {
            "office_hours": "Answered office-hours question",
            "services": "Answered services question",
            "after_hours": "Answered after-hours policy question",
            "appointment_policy": "Answered appointment policy question",
            "refill_policy": "Answered refill policy question",
            "insurance_policy": "Answered insurance policy question",
            "billing_policy": "Answered billing policy question",
            "recording_policy": "Answered recording policy question",
            "transcript_retention": "Answered transcript retention question",
            "custom_faq": "Answered custom practice FAQ",
        }[topic]

    def _knowledge_summary(self, topic: KnowledgeTopic, source: str) -> str:
        if topic == "custom_faq":
            return f"Custom FAQ answered from '{source}'."
        return f"{topic.replace('_', ' ')} question answered from configured practice knowledge."


class SchedulingAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        existing = session.slotState.get("scheduling", {})
        slots = SchedulingSlotState.model_validate(existing or {})

        request_type = _extract_request_type(text)
        visit_type = _extract_visit_type(text)
        preferred_date = _extract_preferred_date(text)
        preferred_time = _extract_preferred_time(text)

        if request_type:
            slots.requestType = request_type  # type: ignore[assignment]
        if visit_type:
            slots.visitType = visit_type
        if preferred_date:
            slots.preferredDate = preferred_date
        if preferred_time:
            slots.preferredTime = preferred_time

        cleaned_text = _clean_phrase(text)
        if cleaned_text and cleaned_text not in slots.notes:
            slots.notes.append(cleaned_text)

        payload = slots.model_dump(exclude_none=True)
        session.slotState["scheduling"] = payload

        missing_fields = [
            field_name
            for field_name, value in [
                ("visitType", slots.visitType),
                ("preferredDate", slots.preferredDate),
                ("preferredTime", slots.preferredTime),
            ]
            if not value
        ]

        if missing_fields:
            next_field = missing_fields[0]
            next_prompt = {
                "visitType": _slot_prompt(
                    session,
                    "scheduling",
                    "visitType",
                    "What kind of appointment do you need, like a physical, follow-up, or consultation?",
                ),
                "preferredDate": _slot_prompt(
                    session,
                    "scheduling",
                    "preferredDate",
                    "What day would you like that?",
                ),
                "preferredTime": _slot_prompt(
                    session,
                    "scheduling",
                    "preferredTime",
                    "What time works best for you?",
                ),
            }[next_field]

            return SpecialistResult(
                domain="scheduling",
                status="needs_information",
                confidence=0.88,
                nextPrompt=next_prompt,
                missingFields=missing_fields,
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting appointment details",
                    nextStep=f"Continue intake until {next_field} is captured.",
                    specialist="scheduling",
                    callerRequest=text.strip() or "Appointment request",
                ),
                callerRequestSummary=_build_scheduling_summary(slots),
            )

        summary = _build_scheduling_summary(slots)
        confirmation = (
            f"I have a request for {summary}. Should I send that to the practice?"
            if slots.requestType == "schedule"
            else f"I have a request {summary}. Should I send that to the practice?"
        )

        return SpecialistResult(
            domain="scheduling",
            status="ready_for_confirmation",
            confidence=0.95,
            nextPrompt=confirmation,
            extractedFields=payload,
            confirmationSummary=summary,
            runtimeAction="appointment-request",
            runtimePayload={
                "callerName": session.callerName or "Caller",
                "callerPhone": session.callerPhone,
                "serviceType": slots.visitType,
                "preferredDate": slots.preferredDate,
                "preferredTime": slots.preferredTime,
                "requestType": slots.requestType,
                "notes": " ".join(slots.notes[-3:]),
                "confirmed": True,
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.servicePolicies["scheduling"].fallbackSummary,
            operatorSummary=OperatorSummary(
                headline="Appointment request ready",
                nextStep="Submit after explicit caller confirmation.",
                specialist="scheduling",
                callerRequest=summary,
            ),
            callerRequestSummary=summary,
        )


class RefillAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        existing = session.slotState.get("refill", {})
        slots = RefillSlotState.model_validate(existing or {})
        prompted_slot = session.missingSlots[0] if session.activeDomain == "refill" and session.missingSlots else None

        medication_name = _extract_medication_name(text)
        if (
            not medication_name
            and prompted_slot == "medicationName"
            and not _is_explicit_unknown(text)
            and _is_simple_slot_response(text)
        ):
            medication_name = _clean_phrase(text)

        caller_dob = _extract_caller_dob(text)
        pharmacy_phone = _extract_phone_number(text)
        prescriber_name = _extract_prescriber_name(text)
        pharmacy_name = _extract_pharmacy_name(text)
        if (
            not pharmacy_name
            and prompted_slot == "pharmacyName"
            and not _is_explicit_unknown(text)
            and not caller_dob
            and not pharmacy_phone
            and not prescriber_name
            and _is_simple_slot_response(text)
        ):
            pharmacy_name = _clean_phrase(text)

        if medication_name:
            slots.medicationName = medication_name
            _clear_slot_retry(session, "refill", "medicationName")
        if caller_dob:
            slots.callerDob = caller_dob
            _clear_slot_retry(session, "refill", "callerDob")
        if pharmacy_name:
            slots.pharmacyName = pharmacy_name
            _clear_slot_retry(session, "refill", "pharmacyName")
        if pharmacy_phone:
            slots.pharmacyPhone = pharmacy_phone
            _clear_slot_retry(session, "refill", "pharmacyPhone")
        if prescriber_name:
            slots.prescriberName = prescriber_name

        _append_note(
            slots.notes,
            text,
            medication_name,
            caller_dob,
            pharmacy_name,
            pharmacy_phone,
            prescriber_name,
        )

        payload = slots.model_dump(exclude_none=True)
        session.slotState["refill"] = payload
        missing_fields = [field for field in REFILL_REQUIRED_FIELDS if not getattr(slots, field)]

        if missing_fields:
            next_field = missing_fields[0]
            if _should_escalate_missing_slot(session, "refill", next_field, text):
                missing_label = _humanize_slot_name(next_field)
                summary = f"{_build_refill_summary(slots)}. Missing {_format_missing_labels(missing_fields)}."
                return _build_manual_follow_up_result(
                    session,
                    domain="refill",
                    title="Refill request needs manual completion",
                    summary=summary,
                    next_prompt=(
                        f"I'm missing the {missing_label}. "
                        "I can pass this refill request to the staff to complete manually. Should I do that?"
                    ),
                    extracted_fields=payload,
                    missing_fields=missing_fields,
                    operator_headline="Refill intake incomplete",
                    operator_next_step="Create a manual refill follow-up after caller confirmation.",
                )

            prompt = {
                "medicationName": _slot_prompt(
                    session,
                    "refill",
                    "medicationName",
                    "Which medication would you like refilled?",
                ),
                "callerDob": _slot_prompt(
                    session,
                    "refill",
                    "callerDob",
                    "What is the caller's date of birth?",
                ),
                "pharmacyName": _slot_prompt(
                    session,
                    "refill",
                    "pharmacyName",
                    "Which pharmacy should I include?",
                ),
                "pharmacyPhone": _slot_prompt(
                    session,
                    "refill",
                    "pharmacyPhone",
                    "What is the pharmacy phone number?",
                ),
            }[next_field]

            return SpecialistResult(
                domain="refill",
                status="needs_information",
                confidence=0.88,
                nextPrompt=prompt,
                missingFields=missing_fields,
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting refill details",
                    nextStep=f"Continue intake until the {_humanize_slot_name(next_field)} is captured.",
                    specialist="refill",
                    callerRequest=text.strip() or "Refill request",
                ),
                callerRequestSummary=_build_refill_summary(slots),
            )

        summary = _build_refill_summary(slots)
        confirmation_prompt = _render_confirmation_prompt(
            session,
            "refill",
            f"I have {summary}. Should I send that to the practice?",
            {
                "medicationName": slots.medicationName or "",
                "callerDob": slots.callerDob or "",
                "pharmacyName": slots.pharmacyName or "",
                "pharmacyPhone": slots.pharmacyPhone or "",
            },
        )
        return SpecialistResult(
            domain="refill",
            status="ready_for_confirmation",
            confidence=0.93,
            nextPrompt=confirmation_prompt,
            extractedFields=payload,
            confirmationSummary=summary,
            runtimeAction="refill-request",
            runtimePayload={
                "callerName": session.callerName or "Caller",
                "callerPhone": session.callerPhone,
                "callerDob": slots.callerDob,
                "medicationName": slots.medicationName,
                "prescriberName": slots.prescriberName,
                "pharmacyName": slots.pharmacyName,
                "pharmacyPhone": slots.pharmacyPhone,
                "notes": _condense_notes(slots.notes),
                "confirmed": True,
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.servicePolicies["refill"].fallbackSummary,
            operatorSummary=OperatorSummary(
                headline="Refill request ready",
                nextStep="Submit after explicit caller confirmation.",
                specialist="refill",
                callerRequest=summary,
            ),
            callerRequestSummary=summary,
        )


class InsuranceAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        existing = session.slotState.get("insurance", {})
        slots = InsuranceSlotState.model_validate(existing or {})
        prompted_slot = session.missingSlots[0] if session.activeDomain == "insurance" and session.missingSlots else None

        inquiry_type = _extract_insurance_inquiry_type(text)
        if inquiry_type:
            slots.inquiryType = inquiry_type  # type: ignore[assignment]
            _clear_slot_retry(session, "insurance", "inquiryType")

        carrier_name = _extract_insurance_carrier(text)
        if carrier_name:
            slots.carrierName = carrier_name
            _clear_slot_retry(session, "insurance", "carrierName")

        plan_name = _extract_plan_name(text)
        if plan_name:
            slots.planName = plan_name
            _clear_slot_retry(session, "insurance", "planName")

        member_id = _extract_member_id(text)
        if member_id:
            slots.memberId = member_id
            _clear_slot_retry(session, "insurance", "memberId")

        group_number = _extract_group_number(text)
        if group_number:
            slots.groupNumber = group_number
            _clear_slot_retry(session, "insurance", "groupNumber")

        patient_name = _extract_patient_name(text)
        if patient_name:
            slots.patientName = patient_name
            _clear_slot_retry(session, "insurance", "patientName")

        patient_dob = _extract_caller_dob(text)
        if patient_dob:
            slots.patientDob = patient_dob
            _clear_slot_retry(session, "insurance", "patientDob")

        subscriber_relation = _extract_subscriber_relation(text)
        if subscriber_relation:
            slots.subscriberRelation = subscriber_relation  # type: ignore[assignment]
            _clear_slot_retry(session, "insurance", "subscriberRelation")

        service_type = _extract_service_type(text)
        if service_type:
            slots.serviceType = service_type
            _clear_slot_retry(session, "insurance", "serviceType")

        callback_phone = _extract_phone_number(text)
        if callback_phone:
            slots.callbackPhone = callback_phone
            _clear_slot_retry(session, "insurance", "callbackPhone")
        elif not slots.callbackPhone and session.callerPhone:
            slots.callbackPhone = session.callerPhone

        if prompted_slot == "patientName" and not slots.patientName and _is_simple_slot_response(text, max_words=4):
            cleaned = _clean_phrase(text)
            if cleaned and len(cleaned.split()) <= 4:
                slots.patientName = cleaned
                _clear_slot_retry(session, "insurance", "patientName")

        _append_note(
            slots.notes,
            text,
            slots.carrierName,
            slots.planName,
            slots.memberId,
            slots.groupNumber,
            slots.patientName,
            slots.patientDob,
            slots.callbackPhone,
            slots.serviceType,
        )

        if not slots.inquiryType:
            slots.inquiryType = "acceptance"

        payload = slots.model_dump(exclude_none=True)
        session.slotState["insurance"] = payload
        missing_fields = _insurance_required_fields(slots, session)
        follow_up_only = _insurance_follow_up_only(slots, text)

        if missing_fields:
            next_field = missing_fields[0]
            if _should_escalate_missing_slot(session, "insurance", next_field, text):
                summary = f"{_build_insurance_summary(slots)}. Missing {_format_missing_labels(missing_fields)}."
                return _build_manual_follow_up_result(
                    session,
                    domain="insurance",
                    title="Insurance intake needs staff review",
                    summary=summary,
                    next_prompt=(
                        f"I'm missing the {_humanize_slot_name(next_field)}. "
                        "I can pass this insurance request to the staff to review manually. Should I do that?"
                    ),
                    extracted_fields=payload,
                    missing_fields=missing_fields,
                    operator_headline="Insurance intake incomplete",
                    operator_next_step="Create a manual insurance follow-up after caller confirmation.",
                )

            prompt_map = {
                "inquiryType": _slot_prompt(
                    session,
                    "insurance",
                    "inquiryType",
                    "Are you asking whether the practice accepts the plan, or whether coverage looks active for a patient?",
                ),
                "carrierName": _slot_prompt(
                    session,
                    "insurance",
                    "carrierName",
                    "Which insurance carrier should I check?",
                ),
                "planName": _slot_prompt(
                    session,
                    "insurance",
                    "planName",
                    "Do you know the plan name, like PPO or HMO?",
                ),
                "memberId": _slot_prompt(
                    session,
                    "insurance",
                    "memberId",
                    "What is the member ID on the insurance card?",
                ),
                "groupNumber": _slot_prompt(
                    session,
                    "insurance",
                    "groupNumber",
                    "Do you know the group number?",
                ),
                "patientName": _slot_prompt(
                    session,
                    "insurance",
                    "patientName",
                    "What is the patient's full name?",
                ),
                "patientDob": _slot_prompt(
                    session,
                    "insurance",
                    "patientDob",
                    "What is the patient's date of birth?",
                ),
                "subscriberRelation": _slot_prompt(
                    session,
                    "insurance",
                    "subscriberRelation",
                    "Is the patient the subscriber, or are they covered through someone else?",
                ),
                "serviceType": _slot_prompt(
                    session,
                    "insurance",
                    "serviceType",
                    "What type of visit or service is this for?",
                ),
                "callbackPhone": _slot_prompt(
                    session,
                    "insurance",
                    "callbackPhone",
                    "What callback number should the staff use if they need to follow up?",
                ),
            }
            return SpecialistResult(
                domain="insurance",
                status="needs_information",
                confidence=0.87,
                nextPrompt=prompt_map[next_field],
                missingFields=missing_fields,
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting insurance details",
                    nextStep=f"Continue intake until the {_humanize_slot_name(next_field)} is captured.",
                    specialist="insurance",
                    callerRequest=text.strip() or "Insurance request",
                ),
                callerRequestSummary=_build_insurance_summary(slots),
            )

        summary = _build_insurance_summary(slots)
        if follow_up_only:
            inquiry_label = (slots.inquiryType or "insurance").replace("_", " ")
            return _build_manual_follow_up_result(
                session,
                domain="insurance",
                title="Insurance request needs staff review",
                summary=summary,
                next_prompt=(
                    f"This {inquiry_label} request needs staff review. "
                    "Should I pass it to the staff for follow-up?"
                ),
                extracted_fields=payload,
                missing_fields=[],
                operator_headline="Insurance request needs staff review",
                operator_next_step="Create a manual insurance follow-up after caller confirmation.",
            )

        caller_request = summary
        headline = (
            "Insurance eligibility check ready"
            if slots.inquiryType == "eligibility"
            else "Insurance acceptance check ready"
        )
        return SpecialistResult(
            domain="insurance",
            status="execute_now",
            confidence=0.91,
            nextPrompt="I'll check that for you now.",
            extractedFields=payload,
            runtimeAction="insurance-check",
            runtimePayload={
                "callerName": session.callerName or slots.patientName or None,
                "callerPhone": session.callerPhone or slots.callbackPhone or None,
                "carrierName": slots.carrierName,
                "planName": slots.planName,
                "inquiryType": slots.inquiryType,
                "patientName": slots.patientName,
                "patientDob": slots.patientDob,
                "memberId": slots.memberId,
                "groupNumber": slots.groupNumber,
                "subscriberRelation": slots.subscriberRelation,
                "serviceType": slots.serviceType,
                "callbackPhone": slots.callbackPhone,
                "notes": _condense_notes(slots.notes),
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.servicePolicies["insurance"].fallbackSummary,
            operatorSummary=OperatorSummary(
                headline=headline,
                nextStep="Run the live insurance check now.",
                specialist="insurance",
                callerRequest=caller_request,
            ),
            callerRequestSummary=caller_request,
            resolved=True,
        )


class BillingAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        existing = session.slotState.get("billing", {})
        slots = BillingSlotState.model_validate(existing or {})
        prompted_slot = session.missingSlots[0] if session.activeDomain == "billing" and session.missingSlots else None

        account_reference, topic_text = _extract_account_reference(text)
        billing_topic = ""
        if prompted_slot == "billingTopic":
            billing_topic = _normalize_billing_topic(text)
        elif prompted_slot != "accountReference":
            billing_topic = _normalize_billing_topic(topic_text)
        if (
            not account_reference
            and prompted_slot == "accountReference"
            and not _is_explicit_unknown(text)
            and _is_simple_slot_response(text)
            and _looks_like_account_reference(text)
        ):
            account_reference = _clean_phrase(text)

        if billing_topic:
            slots.billingTopic = billing_topic
            _clear_slot_retry(session, "billing", "billingTopic")
        if account_reference:
            slots.accountReference = account_reference
            _clear_slot_retry(session, "billing", "accountReference")

        _append_note(slots.notes, text, billing_topic, account_reference)

        payload = slots.model_dump(exclude_none=True)
        session.slotState["billing"] = payload
        missing_fields = [field for field in BILLING_REQUIRED_FIELDS if not getattr(slots, field)]

        if missing_fields:
            next_field = missing_fields[0]
            if _should_escalate_missing_slot(session, "billing", next_field, text):
                missing_label = _humanize_slot_name(next_field)
                summary = f"{_build_billing_summary(slots)}. Missing {_format_missing_labels(missing_fields)}."
                return _build_manual_follow_up_result(
                    session,
                    domain="billing",
                    title="Billing request needs manual completion",
                    summary=summary,
                    next_prompt=(
                        f"I'm missing the {missing_label}. "
                        "I can pass this billing request to the staff to complete manually. Should I do that?"
                    ),
                    extracted_fields=payload,
                    missing_fields=missing_fields,
                    operator_headline="Billing intake incomplete",
                    operator_next_step="Create a manual billing follow-up after caller confirmation.",
                )

            prompt = {
                "billingTopic": _slot_prompt(
                    session,
                    "billing",
                    "billingTopic",
                    "What billing issue are you calling about?",
                ),
                "accountReference": _slot_prompt(
                    session,
                    "billing",
                    "accountReference",
                    "What account or statement reference should I include?",
                ),
            }[next_field]

            return SpecialistResult(
                domain="billing",
                status="needs_information",
                confidence=0.86,
                nextPrompt=prompt,
                missingFields=missing_fields,
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting billing details",
                    nextStep=f"Continue intake until the {_humanize_slot_name(next_field)} is captured.",
                    specialist="billing",
                    callerRequest=text.strip() or "Billing request",
                ),
                callerRequestSummary=_build_billing_summary(slots),
            )

        summary = _build_billing_summary(slots)
        confirmation_prompt = _render_confirmation_prompt(
            session,
            "billing",
            f"I have {summary}. Should I send that to the practice?",
            {
                "billingTopic": slots.billingTopic or "",
                "accountReference": slots.accountReference or "",
            },
        )
        return SpecialistResult(
            domain="billing",
            status="ready_for_confirmation",
            confidence=0.91,
            nextPrompt=confirmation_prompt,
            extractedFields=payload,
            confirmationSummary=summary,
            runtimeAction="billing-request",
            runtimePayload={
                "callerName": session.callerName or "Caller",
                "callerPhone": session.callerPhone,
                "billingTopic": slots.billingTopic,
                "accountReference": slots.accountReference,
                "notes": _condense_notes(slots.notes),
                "confirmed": True,
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.servicePolicies["billing"].fallbackSummary,
            operatorSummary=OperatorSummary(
                headline="Billing request ready",
                nextStep="Submit after explicit caller confirmation.",
                specialist="billing",
                callerRequest=summary,
            ),
            callerRequestSummary=summary,
        )


class HandoffAgent:
    def build_after_hours_urgent_reply(self, session: SessionState, text: str) -> SpecialistResult:
        callback_window = session.runtimeConfig.voicePolicyV2.escalationConfig.urgentCallbackWindowMinutes
        return SpecialistResult(
            domain="handoff",
            status="voicemail",
            confidence=0.98,
            nextPrompt=(
                f"{session.runtimeConfig.voicePolicyV2.afterHoursPolicy.greeting} "
                "Please say the message you'd like me to pass along, "
                f"and the team will review urgent callbacks within about {callback_window} minutes during staffed hours."
            ),
            operatorSummary=OperatorSummary(
                headline="After-hours urgent voicemail required",
                nextStep="Capture an urgent voicemail and route it for staff review.",
                specialist="handoff",
                callerRequest=text.strip() or "Urgent after-hours request",
                followUpRequired=True,
            ),
            callerRequestSummary="Urgent after-hours request routed to voicemail.",
            requestHumanFollowUp=True,
            resolved=True,
        )

    def build_after_hours_standard_reply(self, session: SessionState, text: str) -> SpecialistResult:
        policy = session.runtimeConfig.voicePolicyV2.afterHoursPolicy
        if policy.mode == "next_business_day_callback":
            return self.build_manual_follow_up(
                text=text,
                headline="After-hours callback requested",
                next_step="Create a next-business-day follow-up task for staff.",
                priority="HIGH",
            )

        return SpecialistResult(
            domain="handoff",
            status="voicemail",
            confidence=0.95,
            nextPrompt=(
                f"{policy.greeting} "
                "Please say the message you'd like me to pass along, and the practice will follow up during business hours."
            ),
            operatorSummary=OperatorSummary(
                headline="After-hours voicemail required",
                nextStep="Capture voicemail and review during staffed hours.",
                specialist="handoff",
                callerRequest=text.strip() or "After-hours request",
                followUpRequired=True,
            ),
            callerRequestSummary="After-hours request routed to voicemail.",
            requestHumanFollowUp=True,
            resolved=True,
        )

    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        existing = session.slotState.get("handoff", {})
        slots = HandoffSlotState.model_validate(existing or {})
        prompted_slot = session.missingSlots[0] if session.activeDomain == "handoff" and session.missingSlots else None
        policy = session.runtimeConfig.voicePolicyV2.daytimeHandoffPolicy

        reason_summary = _extract_reason_summary(text)
        if reason_summary:
            slots.reasonSummary = reason_summary
            _clear_slot_retry(session, "handoff", "reasonSummary")
        elif prompted_slot == "reasonSummary" and _is_simple_slot_response(text, max_words=12):
            cleaned = _clean_phrase(text)
            if cleaned:
                slots.reasonSummary = cleaned
                _clear_slot_retry(session, "handoff", "reasonSummary")

        callback_phone = _extract_phone_number(text)
        if callback_phone:
            slots.callbackPhone = callback_phone
            _clear_slot_retry(session, "handoff", "callbackPhone")
        elif not slots.callbackPhone and session.callerPhone:
            slots.callbackPhone = session.callerPhone

        preferred_callback_window = _extract_callback_window(text)
        if preferred_callback_window:
            slots.preferredCallbackWindow = preferred_callback_window

        if slots.reasonSummary or text.strip():
            slots.reasonCategory = _extract_reason_category(slots.reasonSummary or text, session.activeDomain)  # type: ignore[assignment]

        if _looks_like_transfer_request(text) and slots.reasonSummary:
            slots.transferConsent = True

        _append_note(slots.notes, text, slots.reasonSummary, slots.callbackPhone, slots.preferredCallbackWindow)

        payload = slots.model_dump(exclude_none=True)
        session.slotState["handoff"] = payload

        if policy.collectReasonFirst and not slots.reasonSummary:
            return SpecialistResult(
                domain="handoff",
                status="needs_information",
                confidence=0.86,
                nextPrompt=_slot_prompt(
                    session,
                    "handoff",
                    "reasonSummary",
                    "What should I tell the staff this is about?",
                ),
                missingFields=["reasonSummary"],
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting daytime handoff details",
                    nextStep="Capture the reason for the transfer or callback request.",
                    specialist="handoff",
                    callerRequest=text.strip() or "Staff request",
                    followUpRequired=True,
                ),
                callerRequestSummary="Staff follow-up requested.",
            )

        if policy.mode == "callback_only" or not policy.transferPhone.strip():
            return self.build_daytime_callback_result(session, slots)

        summary = slots.reasonSummary or "staff follow-up requested"
        transfer_prompt = (
            f"I can try to connect you to the {policy.transferTargetLabel} now. "
            "If no one answers, I can create a callback request for the staff. "
            "Would you like me to try the live transfer?"
        )

        if slots.transferConsent:
            return SpecialistResult(
                domain="handoff",
                status="execute_now",
                confidence=0.9,
                nextPrompt=f"Okay, I'll try to connect you to the {policy.transferTargetLabel} now.",
                extractedFields=payload,
                runtimeAction="handoff-transfer",
                runtimePayload={
                    "reasonSummary": summary,
                    "reasonCategory": slots.reasonCategory,
                    "callbackPhone": slots.callbackPhone,
                    "preferredCallbackWindow": slots.preferredCallbackWindow,
                    "transferTargetLabel": policy.transferTargetLabel,
                    "transferPhone": policy.transferPhone,
                    "ringTimeoutSeconds": policy.ringTimeoutSeconds,
                    "fallbackSummary": policy.fallbackSummary,
                },
                fallbackRecommendation=policy.fallbackSummary,
                operatorSummary=OperatorSummary(
                    headline="Daytime live transfer requested",
                    nextStep=f"Attempt a live transfer to the {policy.transferTargetLabel}.",
                    specialist="handoff",
                    callerRequest=summary,
                    followUpRequired=True,
                ),
                callerRequestSummary=summary,
                requestHumanFollowUp=True,
                resolved=True,
            )

        return SpecialistResult(
            domain="handoff",
            status="ready_for_confirmation",
            confidence=0.88,
            nextPrompt=transfer_prompt,
            extractedFields=payload,
            confirmationSummary=summary,
            runtimeAction="handoff-transfer",
            runtimePayload={
                "reasonSummary": summary,
                "reasonCategory": slots.reasonCategory,
                "callbackPhone": slots.callbackPhone,
                "preferredCallbackWindow": slots.preferredCallbackWindow,
                "transferTargetLabel": policy.transferTargetLabel,
                "transferPhone": policy.transferPhone,
                "ringTimeoutSeconds": policy.ringTimeoutSeconds,
                "fallbackSummary": policy.fallbackSummary,
            },
            fallbackRecommendation=policy.fallbackSummary,
            operatorSummary=OperatorSummary(
                headline="Daytime live transfer offered",
                nextStep=f"Attempt a live transfer to the {policy.transferTargetLabel} after caller consent.",
                specialist="handoff",
                callerRequest=summary,
                followUpRequired=True,
            ),
            callerRequestSummary=summary,
            requestHumanFollowUp=True,
            resolved=True,
        )

    def build_manual_follow_up(
        self,
        text: str,
        headline: str = "Manual follow-up requested",
        next_step: str = "Create a staff follow-up task.",
        priority: str = "HIGH",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SpecialistResult:
        summary = text.strip() or "Staff follow-up requested by caller."
        return SpecialistResult(
            domain="handoff",
            status="execute_now",
            confidence=0.84,
            nextPrompt="I can pass that along to the staff and ask them to follow up with you.",
            runtimeAction="manual-follow-up",
            runtimePayload={
                "title": headline,
                "summary": summary,
                "priority": priority,
                "metadata": metadata or {},
            },
            fallbackRecommendation="manual-follow-up",
            operatorSummary=OperatorSummary(
                headline=headline,
                nextStep=next_step,
                specialist="handoff",
                callerRequest=summary,
                followUpRequired=True,
            ),
            callerRequestSummary=summary,
            requestHumanFollowUp=True,
            resolved=True,
        )

    def build_daytime_callback_follow_up(self, session: SessionState, slots: HandoffSlotState) -> SpecialistResult:
        summary = slots.reasonSummary or "Staff callback requested by caller."
        metadata = {
            "originatingDomain": "handoff",
            "reasonCategory": slots.reasonCategory,
            "callbackPhone": slots.callbackPhone,
            "preferredCallbackWindow": slots.preferredCallbackWindow,
        }
        return SpecialistResult(
            domain="handoff",
            status="execute_now",
            confidence=0.86,
            nextPrompt="Okay, I’ll pass that to the staff and ask them to call you back.",
            extractedFields=slots.model_dump(exclude_none=True),
            runtimeAction="manual-follow-up",
            runtimePayload={
                "title": "Daytime callback requested",
                "summary": summary,
                "priority": "HIGH",
                "metadata": metadata,
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.daytimeHandoffPolicy.fallbackSummary,
            operatorSummary=OperatorSummary(
                headline="Daytime callback requested",
                nextStep="Review the callback request and contact the caller during staffed hours.",
                specialist="handoff",
                callerRequest=summary,
                followUpRequired=True,
            ),
            callerRequestSummary=summary,
            requestHumanFollowUp=True,
            resolved=True,
        )

    def build_daytime_callback_result(
        self,
        session: SessionState,
        slots: HandoffSlotState,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SpecialistResult:
        summary = slots.reasonSummary or "Staff callback requested by caller."
        callback_metadata = {
            "originatingDomain": "handoff",
            "reasonCategory": slots.reasonCategory,
            "callbackPhone": slots.callbackPhone,
            "preferredCallbackWindow": slots.preferredCallbackWindow,
        }
        if metadata:
            callback_metadata.update(metadata)
        return SpecialistResult(
            domain="handoff",
            status="execute_now",
            confidence=0.86,
            nextPrompt="Okay, I'll pass that to the staff and ask them to call you back.",
            extractedFields=slots.model_dump(exclude_none=True),
            runtimeAction="manual-follow-up",
            runtimePayload={
                "title": "Daytime callback requested",
                "summary": summary,
                "priority": "HIGH",
                "metadata": callback_metadata,
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.daytimeHandoffPolicy.fallbackSummary,
            operatorSummary=OperatorSummary(
                headline="Daytime callback requested",
                nextStep="Review the callback request and contact the caller during staffed hours.",
                specialist="handoff",
                callerRequest=summary,
                followUpRequired=True,
            ),
            callerRequestSummary=summary,
            requestHumanFollowUp=True,
            resolved=True,
        )


class SupervisorAgent:
    HANDOFF_PRIORITY_KEYWORDS = ["callback", "call back", "staff", "human", "representative", "someone", "transfer", "front desk"]
    ACTION_REQUEST_SIGNALS = [
        "i need",
        "i want",
        "i have",
        "i'd like",
        "i would like",
        "can i",
        "can you",
        "please",
        "help me with",
        "i'm calling about",
        "i am calling about",
        "i also need",
    ]
    DOMAIN_KEYWORDS = {
        "scheduling": ["appointment", "schedule", "reschedule", "cancel", "book", "physical", "follow-up"],
        "refill": ["refill", "medication", "prescription", "pharmacy"],
        "insurance": ["insurance", "coverage", "carrier", "plan", "copay", "accepted"],
        "billing": ["billing", "bill", "statement", "payment", "balance"],
    }
    COMPOUND_SPLIT_PATTERN = re.compile(
        r"\?+|,\s*(?=(?:i need|i want|can i|can you|please|help me|someone|staff|human|billing|refill|insurance|appointment))|\b(?:and|also|plus|then|after that|before that|but first)\b",
        re.IGNORECASE,
    )

    def choose_domain(
        self,
        session: SessionState,
        text: str,
        knowledge_agent: Optional[KnowledgeAgent] = None,
    ) -> SupervisorDecision:
        knowledge_agent = knowledge_agent or KnowledgeAgent()
        enabled_domains = set(session.runtimeConfig.voicePolicyV2.enabledDomains)
        lowered = _normalize(text)
        extracted = self._extract_detected_intents(session, text, knowledge_agent, enabled_domains)
        detected_intents: List[DetectedIntent] = extracted["detectedIntents"]
        knowledge_intents: List[DetectedIntent] = extracted["knowledgeIntents"]
        action_infos: List[Dict[str, Any]] = extracted["actionInfos"]
        handoff_keywords = (
            self._match_keywords(lowered, self.HANDOFF_PRIORITY_KEYWORDS) if "handoff" in enabled_domains else []
        )
        out_of_scope_keywords = knowledge_agent.contains_out_of_scope_keywords(session, text)
        knowledge_intent = knowledge_intents[0] if knowledge_intents else None
        action_intents = [item["intent"] for item in action_infos]

        if extracted["tooManyActions"]:
            return SupervisorDecision(
                mode="clarify",
                domain="knowledge",
                confidence=0.82,
                reason="multi-intent-priority-prompt",
                clarificationPrompt=(
                    "I heard more than three issues. Please tell me the top three things you want help with first."
                ),
                knowledgeTopic=knowledge_intent.knowledgeTopic if knowledge_intent else None,
                matchedKeywords=self._aggregate_detected_keywords(detected_intents),
                fragmentText=knowledge_intent.sourceText if knowledge_intent else None,
                detectedIntents=detected_intents,
                priorityRequired=True,
            )

        if len(knowledge_intents) > 1 and not action_intents:
            summaries = ", ".join(intent.summary for intent in knowledge_intents[:3])
            return SupervisorDecision(
                mode="knowledge",
                domain="knowledge",
                confidence=0.84,
                reason="multi-intent-priority-prompt",
                clarificationPrompt=f"I heard a few questions, including {summaries}. Which one should I answer first?",
                knowledgeTopic=knowledge_intent.knowledgeTopic if knowledge_intent else None,
                matchedKeywords=self._aggregate_detected_keywords(detected_intents),
                fragmentText=knowledge_intent.sourceText if knowledge_intent else text.strip(),
                detectedIntents=detected_intents,
                priorityRequired=True,
            )

        if len(action_intents) > 1:
            return SupervisorDecision(
                mode="knowledge" if knowledge_intent else "delegate",
                domain="knowledge" if knowledge_intent else action_intents[0].domain,
                confidence=0.95,
                reason="multi-intent-priority-prompt",
                knowledgeTopic=knowledge_intent.knowledgeTopic if knowledge_intent else None,
                matchedKeywords=self._aggregate_detected_keywords(detected_intents),
                fragmentText=knowledge_intent.sourceText if knowledge_intent else None,
                detectedIntents=detected_intents,
                priorityRequired=True,
            )

        if knowledge_intent and len(action_intents) == 1:
            follow_on = action_intents[0]
            decision_reason = (
                "compound-knowledge-plus-handoff" if follow_on.domain == "handoff" else "compound-knowledge-plus-action"
            )
            return SupervisorDecision(
                mode="knowledge",
                domain="knowledge",
                confidence=0.94,
                reason=decision_reason,
                knowledgeTopic=knowledge_intent.knowledgeTopic,
                matchedKeywords=self._aggregate_detected_keywords(detected_intents),
                followOnIntent=FollowOnIntent(
                    domain=follow_on.domain,
                    text=follow_on.sourceText,
                    knowledgeTopic=knowledge_intent.knowledgeTopic,
                    reason=action_infos[0]["reason"],
                ),
                fragmentText=knowledge_intent.sourceText,
                detectedIntents=detected_intents,
            )

        if len(action_intents) == 1:
            selected = action_intents[0]
            selected_info = action_infos[0]
            reason = selected_info["reason"]
            mode = "delegate" if session.activeDomain != selected.domain else "continue"
            continuation = session.activeDomain == selected.domain
            if (
                session.activeDomain == "handoff"
                and session.pendingConfirmation is None
                and (session.activeDomain in session.slotState or session.missingSlots)
                and self._looks_like_continuation(session, text)
            ):
                return SupervisorDecision(
                    mode="continue",
                    domain="handoff",
                    confidence=0.84,
                    reason="continue-active-intake",
                    continuation=True,
                    matchedKeywords=selected.matchedKeywords,
                    fragmentText=text.strip(),
                    detectedIntents=detected_intents,
                )
            if (
                session.activeDomain == selected.domain
                and session.pendingConfirmation is None
                and (session.activeDomain in session.slotState or session.missingSlots)
                and self._looks_like_continuation(session, text)
            ):
                reason = "continue-active-intake"
                mode = "continue"
                continuation = True
            if (
                session.activeDomain
                and session.pendingConfirmation is None
                and session.activeDomain in enabled_domains
                and session.activeDomain not in {"knowledge", "safety"}
                and (session.activeDomain in session.slotState or session.missingSlots)
                and selected.domain != session.activeDomain
            ):
                reason = "switch-active-intent"
            return SupervisorDecision(
                mode=mode,
                domain=selected.domain,
                confidence=min(0.96, 0.74 + (selected_info["score"] * 0.05)),
                reason=reason,
                continuation=continuation,
                matchedKeywords=selected.matchedKeywords,
                fragmentText=selected.sourceText or text.strip(),
                detectedIntents=detected_intents,
                selectedIntentId=selected.intentId,
            )

        if handoff_keywords:
            return SupervisorDecision(
                mode="delegate" if session.activeDomain != "handoff" else "continue",
                domain="handoff",
                confidence=0.94,
                reason="explicit-human-request",
                continuation=session.activeDomain == "handoff",
                matchedKeywords=handoff_keywords,
                fragmentText=text.strip(),
            )

        if out_of_scope_keywords:
            return SupervisorDecision(
                mode="knowledge",
                domain="knowledge",
                confidence=0.88,
                reason="out-of-scope-deflection",
                matchedKeywords=out_of_scope_keywords,
                fragmentText=text.strip(),
            )

        knowledge_match = knowledge_agent.match(session, text)
        action_candidates = self._score_action_domains(session, text, enabled_domains)
        best_domain, best_score, best_keywords, best_reason = self._best_action_candidate(action_candidates)

        if (
            session.activeDomain
            and session.pendingConfirmation is None
            and session.activeDomain in enabled_domains
            and session.activeDomain not in {"knowledge", "safety"}
            and (session.activeDomain in session.slotState or session.missingSlots)
        ):
            strong_other_domain = bool(best_domain and best_domain != session.activeDomain and best_score >= 3)
            looks_like_continuation = self._looks_like_continuation(session, text)
            if (
                (not knowledge_match or (looks_like_continuation and len(lowered.split()) <= 3))
                and not strong_other_domain
                and looks_like_continuation
            ):
                return SupervisorDecision(
                    mode="continue",
                    domain=session.activeDomain,
                    confidence=0.78,
                    reason="continue-active-intake",
                    continuation=True,
                    fragmentText=text.strip(),
                )

        if best_domain and (not knowledge_match or best_score >= 3):
            return SupervisorDecision(
                mode="delegate" if session.activeDomain != best_domain else "continue",
                domain=best_domain,
                confidence=min(0.96, 0.74 + (best_score * 0.05)),
                reason=best_reason,
                continuation=session.activeDomain == best_domain,
                matchedKeywords=best_keywords,
                fragmentText=text.strip(),
            )

        if knowledge_match:
            return SupervisorDecision(
                mode="knowledge",
                domain="knowledge",
                confidence=0.9,
                reason="custom-faq-match" if knowledge_match.topic == "custom_faq" else "knowledge-topic-match",
                knowledgeTopic=knowledge_match.topic,
                matchedKeywords=knowledge_match.matchedKeywords,
                fragmentText=text.strip(),
            )

        services = _enabled_service_labels(session)
        return SupervisorDecision(
            mode="clarify",
            domain="knowledge",
            confidence=0.4,
            reason="no-domain-match",
            clarificationPrompt=(
                f"I can help with {services}, or I can take a message for the staff. "
                "What would you like help with today?"
            ),
            fragmentText=text.strip(),
        )

    def _match_keywords(self, lowered: str, keywords: List[str]) -> List[str]:
        return [keyword for keyword in keywords if keyword and _phrase_in_text(lowered, keyword)]

    def _score_action_domains(
        self,
        session: SessionState,
        text: str,
        enabled_domains: set[str],
    ) -> Dict[DomainName, tuple[int, List[str], str]]:
        lowered = _normalize(text)
        request_signals = self._match_keywords(lowered, self.ACTION_REQUEST_SIGNALS)
        candidates: Dict[DomainName, tuple[int, List[str], str]] = {}

        for domain, keywords in self.DOMAIN_KEYWORDS.items():
            if domain not in enabled_domains:
                continue

            matched_keywords = self._match_keywords(lowered, keywords)
            score = len(matched_keywords)
            reason = "domain-keyword-match"

            if domain == "scheduling":
                if _extract_request_type(text):
                    score += 2
                if _extract_visit_type(text) or _extract_preferred_date(text) or _extract_preferred_time(text):
                    score += 1
            elif domain == "refill":
                if _extract_medication_name(text):
                    score += 2
                if "need a refill" in lowered or "i need a refill" in lowered:
                    score += 1
            elif domain == "billing":
                account_reference, _ = _extract_account_reference(text)
                if account_reference:
                    score += 2
                if _normalize_billing_topic(text) and (matched_keywords or account_reference):
                    score += 1
            elif domain == "insurance":
                carrier_name = _extract_insurance_carrier(text)
                if carrier_name:
                    matched_keywords.append(carrier_name.lower())
                    score += 2
                    reason = "insurance-carrier-match"

            if request_signals and score > 0:
                score += 2
                matched_keywords.extend(request_signals)

            if score <= 0:
                continue

            deduped_keywords = list(dict.fromkeys(matched_keywords))
            candidates[domain] = (score, deduped_keywords, reason)  # type: ignore[assignment]

        return candidates

    def _best_action_candidate(
        self,
        candidates: Dict[DomainName, tuple[int, List[str], str]],
    ) -> tuple[Optional[DomainName], int, List[str], str]:
        best_domain: Optional[DomainName] = None
        best_score = 0
        best_keywords: List[str] = []
        best_reason = "domain-keyword-match"
        for domain, (score, keywords, reason) in candidates.items():
            if score > best_score:
                best_domain = domain
                best_score = score
                best_keywords = keywords
                best_reason = reason
        return best_domain, best_score, best_keywords, best_reason

    def _looks_like_continuation(self, session: SessionState, text: str) -> bool:
        lowered = _normalize(text)
        if any(keyword in lowered for keyword in ["actually", "change", "wrong", "wait", "instead"]):
            return True

        if session.activeDomain == "scheduling":
            return bool(
                _extract_request_type(text)
                or _extract_visit_type(text)
                or _extract_preferred_date(text)
                or _extract_preferred_time(text)
                or len(lowered.split()) <= 6
            )
        if session.activeDomain == "refill":
            return bool(
                _extract_medication_name(text)
                or _extract_caller_dob(text)
                or _extract_pharmacy_name(text)
                or _extract_phone_number(text)
                or _extract_prescriber_name(text)
                or len(lowered.split()) <= 8
            )
        if session.activeDomain == "billing":
            account_reference, _ = _extract_account_reference(text)
            return bool(account_reference or _normalize_billing_topic(text) or len(lowered.split()) <= 8)
        if session.activeDomain == "insurance":
            return bool(_extract_insurance_carrier(text) or len(lowered.split()) <= 6)
        if session.activeDomain == "handoff":
            return bool(
                _extract_reason_summary(text)
                or _extract_phone_number(text)
                or _extract_callback_window(text)
                or len(lowered.split()) <= 12
            )
        return False

    def _split_compound_fragments(self, text: str) -> List[str]:
        return [
            _clean_phrase(fragment)
            for fragment in self.COMPOUND_SPLIT_PATTERN.split(text)
            if _clean_phrase(fragment)
        ]

    def _extract_detected_intents(
        self,
        session: SessionState,
        text: str,
        knowledge_agent: KnowledgeAgent,
        enabled_domains: set[str],
    ) -> Dict[str, Any]:
        fragments = self._split_compound_fragments(text)
        if not fragments:
            fragments = [_clean_phrase(text)]

        detected_intents: List[DetectedIntent] = []
        knowledge_intents: List[DetectedIntent] = []
        action_infos: List[Dict[str, Any]] = []
        seen_action_domains: set[str] = set()
        too_many_actions = False

        for detected_order, fragment in enumerate(fragments, start=1):
            lowered_fragment = _normalize(fragment)
            candidate_domain, candidate_score, candidate_keywords, candidate_reason = self._best_action_candidate(
                self._score_action_domains(session, fragment, enabled_domains)
            )
            handoff_keywords = (
                self._match_keywords(lowered_fragment, self.HANDOFF_PRIORITY_KEYWORDS)
                if "handoff" in enabled_domains
                else []
            )
            knowledge_match = knowledge_agent.match(session, fragment)
            question_like = (
                fragment.strip().endswith("?")
                or any(
                    marker in lowered_fragment
                    for marker in [
                        "what ",
                        "what's",
                        "what are",
                        "how ",
                        "when ",
                        "do you",
                        "are you",
                        "can you tell",
                        "can i ask",
                    ]
                )
            )
            explicit_request_like = any(signal in lowered_fragment for signal in self.ACTION_REQUEST_SIGNALS)

            if handoff_keywords and "handoff" not in seen_action_domains:
                if len(action_infos) >= 3:
                    too_many_actions = True
                else:
                    intent = self._build_detected_intent(
                        domain="handoff",
                        kind="handoff",
                        source_text=fragment,
                        summary="staff callback request",
                        detected_order=detected_order,
                        matched_keywords=handoff_keywords,
                    )
                    detected_intents.append(intent)
                    action_infos.append({"intent": intent, "score": 4, "reason": "explicit-human-request"})
                    seen_action_domains.add("handoff")
                continue

            if knowledge_match and question_like and not explicit_request_like:
                intent = self._build_detected_intent(
                    domain="knowledge",
                    kind="knowledge",
                    source_text=fragment,
                    summary=self._build_knowledge_summary(knowledge_match),
                    detected_order=detected_order,
                    knowledge_topic=knowledge_match.topic,
                    matched_keywords=knowledge_match.matchedKeywords,
                )
                detected_intents.append(intent)
                knowledge_intents.append(intent)
                continue

            if candidate_domain and candidate_score >= 2 and candidate_domain not in seen_action_domains:
                if len(action_infos) >= 3:
                    too_many_actions = True
                    continue
                intent = self._build_detected_intent(
                    domain=candidate_domain,
                    kind="action",
                    source_text=fragment,
                    summary=self._build_intent_summary(candidate_domain, fragment),
                    detected_order=detected_order,
                    matched_keywords=candidate_keywords,
                )
                detected_intents.append(intent)
                action_infos.append(
                    {
                        "intent": intent,
                        "score": candidate_score,
                        "reason": candidate_reason,
                    }
                )
                seen_action_domains.add(candidate_domain)
                continue

            if knowledge_match:
                intent = self._build_detected_intent(
                    domain="knowledge",
                    kind="knowledge",
                    source_text=fragment,
                    summary=self._build_knowledge_summary(knowledge_match),
                    detected_order=detected_order,
                    knowledge_topic=knowledge_match.topic,
                    matched_keywords=knowledge_match.matchedKeywords,
                )
                detected_intents.append(intent)
                knowledge_intents.append(intent)

        return {
            "detectedIntents": detected_intents,
            "knowledgeIntents": knowledge_intents,
            "actionInfos": action_infos,
            "tooManyActions": too_many_actions,
        }

    def _build_detected_intent(
        self,
        *,
        domain: DomainName,
        kind: str,
        source_text: str,
        summary: str,
        detected_order: int,
        knowledge_topic: Optional[KnowledgeTopic] = None,
        matched_keywords: Optional[List[str]] = None,
    ) -> DetectedIntent:
        return DetectedIntent(
            domain=domain,
            kind=kind,  # type: ignore[arg-type]
            sourceText=source_text,
            summary=summary,
            status="detected",
            detectedOrder=detected_order,
            knowledgeTopic=knowledge_topic,
            matchedKeywords=matched_keywords or [],
        )

    def _build_intent_summary(self, domain: DomainName, fragment: str) -> str:
        if domain == "scheduling":
            slots = SchedulingSlotState(
                requestType=_extract_request_type(fragment) or "schedule",
                visitType=_extract_visit_type(fragment),
                preferredDate=_extract_preferred_date(fragment),
                preferredTime=_extract_preferred_time(fragment),
            )
            return _build_scheduling_summary(slots)
        if domain == "refill":
            medication_name = _extract_medication_name(fragment)
            return f"refill request for {medication_name}" if medication_name else "refill request"
        if domain == "insurance":
            carrier_name = _extract_insurance_carrier(fragment)
            return f"insurance question about {carrier_name}" if carrier_name else "insurance question"
        if domain == "billing":
            account_reference, remaining = _extract_account_reference(fragment)
            topic = _normalize_billing_topic(remaining)
            if topic.lower() in {"billing help", "need billing help", "billing question", "billing issue"}:
                topic = ""
            if topic and account_reference:
                return f"billing request about {topic} for account {account_reference}"
            if topic:
                return f"billing request about {topic}"
            return "billing request"
        if domain == "handoff":
            return "staff callback request"
        return f"{domain} request"

    def _build_knowledge_summary(self, knowledge_match: KnowledgeMatch) -> str:
        topic_labels = {
            "office_hours": "office hours question",
            "services": "services question",
            "after_hours": "after-hours question",
            "appointment_policy": "appointment policy question",
            "refill_policy": "refill policy question",
            "insurance_policy": "insurance policy question",
            "billing_policy": "billing policy question",
            "recording_policy": "call recording question",
            "transcript_retention": "transcript retention question",
            "custom_faq": "practice FAQ question",
        }
        return topic_labels.get(knowledge_match.topic, "knowledge question")

    def _aggregate_detected_keywords(self, intents: List[DetectedIntent]) -> List[str]:
        keywords: List[str] = []
        for intent in intents:
            for keyword in intent.matchedKeywords:
                if keyword not in keywords:
                    keywords.append(keyword)
        return keywords
