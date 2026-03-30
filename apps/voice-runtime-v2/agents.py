"""
Internal supervisor and specialist agents for Voice Runtime V2.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Dict, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from models import (
    DialoguePolicy,
    OperatorSummary,
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


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _clean_phrase(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip(" .,:;-")).strip()


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
        r"refill(?: for| of)? (?P<value>[a-zA-Z0-9 \-]+)",
        r"medication(?: for)? (?P<value>[a-zA-Z0-9 \-]+)",
        r"(?:it'?s|it is) for (?P<value>[a-zA-Z0-9 \-]+)",
        r"for (?P<value>[a-zA-Z0-9 \-]+)",
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


def _format_hours(session: SessionState) -> str:
    operating_hours = session.runtimeConfig.settings.get("operatingHours") or []
    if not operating_hours:
        return "The practice has not published office hours yet, but I can still take a message for the staff."

    try:
        current_time = datetime.now(ZoneInfo(session.runtimeConfig.business.timeZone))
    except ZoneInfoNotFoundError:
        current_time = datetime.now(timezone.utc)

    day_of_week = int(current_time.strftime("%w"))
    today_label = current_time.strftime("%A")
    today_entry = next((entry for entry in operating_hours if entry.get("dayOfWeek") == day_of_week), None)
    if not today_entry or today_entry.get("isClosed"):
        return f"The office is closed today, {today_label}. I can still take a message for the staff."

    start_time = today_entry.get("startTime")
    end_time = today_entry.get("endTime")
    if not start_time or not end_time:
        return f"The office is open on {today_label}, but I do not have the exact posted hours right now."
    return f"The office is open today, {today_label}, from {start_time} to {end_time}."


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
    KNOWLEDGE_KEYWORDS = [
        "hours",
        "open",
        "close",
        "closing",
        "services",
        "what do you do",
        "what can you help with",
        "after hours",
        "closed",
        "voicemail",
        "call back",
    ]

    def handle(self, session: SessionState, text: str) -> Optional[SpecialistResult]:
        lowered = _normalize(text)
        if any(keyword in lowered for keyword in ["hours", "open", "close", "closing"]):
            answer = _format_hours(session)
            return SpecialistResult(
                domain="knowledge",
                status="answered",
                confidence=0.95,
                nextPrompt=answer,
                operatorSummary=OperatorSummary(
                    headline="Answered office-hours question",
                    nextStep="No staff follow-up is needed unless the caller asks for something else.",
                    specialist="knowledge",
                    callerRequest=text.strip() or "Office hours question",
                ),
                callerRequestSummary="Office-hours question answered from practice setup.",
                resolved=True,
            )

        if any(keyword in lowered for keyword in ["services", "what do you do", "what can you help with"]):
            summary = session.runtimeConfig.voicePolicyV2.knowledgeConfig.faqSummary
            answer = summary or f"I can help with {_enabled_service_labels(session)}."
            return SpecialistResult(
                domain="knowledge",
                status="answered",
                confidence=0.9,
                nextPrompt=answer,
                operatorSummary=OperatorSummary(
                    headline="Answered practice services question",
                    nextStep="No staff follow-up is needed unless the caller asks for something else.",
                    specialist="knowledge",
                    callerRequest=text.strip() or "Practice services question",
                ),
                callerRequestSummary="Practice services question answered from knowledge config.",
                resolved=True,
            )

        if any(keyword in lowered for keyword in ["after hours", "closed", "voicemail", "call back"]):
            policy = session.runtimeConfig.voicePolicyV2.afterHoursPolicy.greeting
            return SpecialistResult(
                domain="knowledge",
                status="answered",
                confidence=0.9,
                nextPrompt=policy,
                operatorSummary=OperatorSummary(
                    headline="Answered after-hours policy question",
                    nextStep="No staff follow-up is needed unless the caller asks for something else.",
                    specialist="knowledge",
                    callerRequest=text.strip() or "After-hours question",
                ),
                callerRequestSummary="After-hours policy question answered from practice setup.",
                resolved=True,
            )

        common_questions = session.runtimeConfig.voicePolicyV2.knowledgeConfig.commonQuestions
        if any(question.lower() in lowered for question in common_questions):
            return SpecialistResult(
                domain="knowledge",
                status="answered",
                confidence=0.78,
                nextPrompt=session.runtimeConfig.voicePolicyV2.knowledgeConfig.faqSummary
                or "I can help with practice questions and route anything else to the staff.",
                operatorSummary=OperatorSummary(
                    headline="Answered practice FAQ",
                    nextStep="No staff follow-up is needed unless the caller asks for something else.",
                    specialist="knowledge",
                    callerRequest=text.strip() or "FAQ",
                ),
                callerRequestSummary="Practice FAQ answered from configured knowledge.",
                resolved=True,
            )

        return None


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
        payload = dict(session.slotState.get("refill", {}))
        medication_name = payload.get("medicationName") or _extract_medication_name(text)
        if medication_name:
            payload["medicationName"] = medication_name
        session.slotState["refill"] = payload

        if not payload.get("medicationName"):
            return SpecialistResult(
                domain="refill",
                status="needs_information",
                confidence=0.84,
                nextPrompt=_slot_prompt(
                    session,
                    "refill",
                    "medicationName",
                    "Which medication would you like refilled?",
                ),
                missingFields=["medicationName"],
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting refill details",
                    nextStep="Continue intake until the medication name is captured.",
                    specialist="refill",
                    callerRequest=text.strip() or "Refill request",
                ),
            )

        summary = f"a refill request for {payload['medicationName']}"
        return SpecialistResult(
            domain="refill",
            status="ready_for_confirmation",
            confidence=0.92,
            nextPrompt=f"I have {summary}. Should I send that to the practice?",
            extractedFields=payload,
            confirmationSummary=summary,
            runtimeAction="refill-request",
            runtimePayload={
                "callerName": session.callerName or "Caller",
                "callerPhone": session.callerPhone,
                "medicationName": payload["medicationName"],
                "notes": text.strip(),
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
        payload = dict(session.slotState.get("insurance", {}))
        carrier_name = payload.get("carrierName") or _extract_insurance_carrier(text)
        if carrier_name:
            payload["carrierName"] = carrier_name
        session.slotState["insurance"] = payload

        if not payload.get("carrierName"):
            return SpecialistResult(
                domain="insurance",
                status="needs_information",
                confidence=0.8,
                nextPrompt=_slot_prompt(
                    session,
                    "insurance",
                    "carrierName",
                    "Which insurance carrier would you like me to check?",
                ),
                missingFields=["carrierName"],
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting insurance details",
                    nextStep="Continue intake until the carrier name is captured.",
                    specialist="insurance",
                    callerRequest=text.strip() or "Insurance question",
                ),
            )

        caller_request = f"check whether the practice works with {payload['carrierName']}"
        return SpecialistResult(
            domain="insurance",
            status="execute_now",
            confidence=0.9,
            nextPrompt=f"I'll check {payload['carrierName']} for you now.",
            extractedFields=payload,
            runtimeAction="insurance-check",
            runtimePayload={
                "callerName": session.callerName or None,
                "callerPhone": session.callerPhone or None,
                "carrierName": payload["carrierName"],
                "planName": payload.get("planName"),
                "inquiryType": "acceptance",
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.servicePolicies["insurance"].fallbackSummary,
            operatorSummary=OperatorSummary(
                headline="Insurance check ready",
                nextStep="Run the live insurance check now.",
                specialist="insurance",
                callerRequest=caller_request,
            ),
            callerRequestSummary=caller_request,
            resolved=True,
        )


class BillingAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        payload = dict(session.slotState.get("billing", {}))
        topic = payload.get("billingTopic") or text.strip()
        payload["billingTopic"] = topic
        session.slotState["billing"] = payload

        summary = f"a billing request about {topic}"
        return SpecialistResult(
            domain="billing",
            status="ready_for_confirmation",
            confidence=0.87,
            nextPrompt=f"I have {summary}. Should I send that to the practice?",
            extractedFields=payload,
            confirmationSummary=summary,
            runtimeAction="billing-request",
            runtimePayload={
                "callerName": session.callerName or "Caller",
                "callerPhone": session.callerPhone,
                "billingTopic": topic,
                "notes": text.strip(),
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

    def build_manual_follow_up(
        self,
        text: str,
        headline: str = "Manual follow-up requested",
        next_step: str = "Create a staff follow-up task.",
        priority: str = "HIGH",
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


class SupervisorAgent:
    HANDOFF_PRIORITY_KEYWORDS = ["callback", "call back", "staff", "human", "representative", "someone"]
    DOMAIN_KEYWORDS = [
        ("scheduling", ["appointment", "schedule", "reschedule", "cancel"]),
        ("refill", ["refill", "medication", "prescription", "pharmacy"]),
        ("insurance", ["insurance", "coverage", "carrier", "plan", "copay"]),
        ("billing", ["billing", "bill", "statement", "payment", "balance"]),
        ("handoff", ["human", "staff", "representative", "someone"]),
    ]

    KNOWLEDGE_KEYWORDS = [
        "hours",
        "open",
        "close",
        "closing",
        "services",
        "what do you do",
        "what can you help with",
        "after hours",
        "closed",
    ]

    def choose_domain(self, session: SessionState, text: str) -> SupervisorDecision:
        enabled_domains = set(session.runtimeConfig.voicePolicyV2.enabledDomains)
        lowered = _normalize(text)

        if (
            session.activeDomain
            and session.pendingConfirmation is None
            and session.activeDomain in enabled_domains
            and session.activeDomain not in {"knowledge", "safety", "handoff"}
            and (session.activeDomain in session.slotState or session.missingSlots)
        ):
            should_continue = False
            if session.activeDomain == "scheduling":
                should_continue = bool(
                    session.missingSlots
                    and (
                        _extract_request_type(text)
                        or _extract_visit_type(text)
                        or _extract_preferred_date(text)
                        or _extract_preferred_time(text)
                        or len(lowered.split()) <= 6
                    )
                )
            else:
                should_continue = bool(session.missingSlots and len(lowered.split()) <= 8)

            if should_continue:
                return SupervisorDecision(
                    mode="continue",
                    domain=session.activeDomain,
                    confidence=0.78,
                    reason="continue-structured-intake",
                    continuation=True,
                )

        if "handoff" in enabled_domains and any(keyword in lowered for keyword in self.HANDOFF_PRIORITY_KEYWORDS):
            return SupervisorDecision(
                mode="delegate" if session.activeDomain != "handoff" else "continue",
                domain="handoff",
                confidence=0.91,
                reason="handoff-keyword-match",
                continuation=session.activeDomain == "handoff",
            )

        for domain, keywords in self.DOMAIN_KEYWORDS:
            if domain in enabled_domains and any(keyword in lowered for keyword in keywords):
                return SupervisorDecision(
                    mode="delegate" if session.activeDomain != domain else "continue",
                    domain=domain,
                    confidence=0.9,
                    reason="keyword-match",
                    continuation=session.activeDomain == domain,
                )

        if "insurance" in enabled_domains and any(carrier in lowered for carrier in COMMON_INSURANCE_CARRIERS):
            return SupervisorDecision(
                mode="delegate" if session.activeDomain != "insurance" else "continue",
                domain="insurance",
                confidence=0.84,
                reason="insurance-carrier-match",
                continuation=session.activeDomain == "insurance",
            )

        if any(keyword in lowered for keyword in self.KNOWLEDGE_KEYWORDS):
            return SupervisorDecision(
                mode="knowledge",
                domain="knowledge",
                confidence=0.86,
                reason="knowledge-keyword-match",
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
        )
