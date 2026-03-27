"""
Internal supervisor and specialist agents for Voice Runtime V2.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Dict, Optional

from models import SessionState, SpecialistResult

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


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _extract_after_keyword(text: str, keyword: str) -> str:
    lowered = text.lower()
    index = lowered.find(keyword)
    if index < 0:
        return ""
    fragment = text[index + len(keyword):].strip(" .,:;-")
    return fragment


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


def _extract_service_type(text: str) -> str:
    lowered = text.lower()
    for candidate in ["physical", "follow-up", "follow up", "consultation", "new patient", "annual visit"]:
        if candidate in lowered:
            return candidate.replace("follow up", "follow-up")
    if "reschedule" in lowered:
        return "reschedule"
    if "cancel" in lowered:
        return "cancel"
    if "appointment" in lowered or "schedule" in lowered:
        return "appointment"
    return ""


def _extract_insurance_carrier(text: str) -> str:
    lowered = text.lower()
    for carrier in COMMON_INSURANCE_CARRIERS:
        if carrier in lowered:
            return carrier.title()
    return ""


def _format_hours(session: SessionState) -> str:
    operating_hours = session.runtimeConfig.settings.get("operatingHours") or []
    if not operating_hours:
        return "The practice has not published office hours yet, but I can still capture your request for staff."

    try:
        current_time = datetime.now(ZoneInfo(session.runtimeConfig.business.timeZone))
    except ZoneInfoNotFoundError:
        current_time = datetime.now(timezone.utc)

    day_of_week = int(current_time.strftime("%w"))
    today_label = current_time.strftime("%A")
    today_entry = next((entry for entry in operating_hours if entry.get("dayOfWeek") == day_of_week), None)
    if not today_entry or today_entry.get("isClosed"):
        return f"The office is closed today, {today_label}. I can still capture a message or request for the staff."

    start_time = today_entry.get("startTime")
    end_time = today_entry.get("endTime")
    if not start_time or not end_time:
        return f"The office is open on {today_label}, but I do not have the exact posted hours right now."
    return f"The office is open today, {today_label}, from {start_time} to {end_time}."


class SafetyAgent:
    def evaluate(self, session: SessionState, text: str) -> Optional[SpecialistResult]:
        lowered = _normalize(text)
        emergency_keywords = EMERGENCY_KEYWORDS + session.runtimeConfig.voicePolicyV2.emergencyKeywords
        matched = [keyword for keyword in emergency_keywords if keyword and keyword in lowered]
        if matched:
            session.isEmergency = True
            return SpecialistResult(
                domain="safety",
                confidence=1.0,
                reply=(
                    "I'm hearing something that may be a medical emergency. "
                    "Please call 911 right away or go to the nearest emergency room."
                ),
                operatorSummary="Emergency language detected. Escalate immediately.",
                requestHumanFollowUp=True,
                resolved=True,
            )

        if any(phrase in lowered for phrase in CLINICAL_ADVICE_PHRASES):
            return SpecialistResult(
                domain="safety",
                confidence=0.9,
                reply=(
                    "I'm not able to provide medical advice, but I can connect you with a staff member or capture a message for clinical follow-up."
                ),
                fallbackRecommendation="manual-follow-up",
                operatorSummary="Clinical-advice boundary reached. Route to staff follow-up.",
                requestHumanFollowUp=True,
                resolved=True,
            )

        return None


class KnowledgeAgent:
    def handle(self, session: SessionState, text: str) -> Optional[SpecialistResult]:
        lowered = _normalize(text)
        if any(keyword in lowered for keyword in ["hours", "open", "close", "closing"]):
            return SpecialistResult(
                domain="knowledge",
                confidence=0.95,
                reply=_format_hours(session),
                operatorSummary="Answered office-hours question from practice setup.",
                resolved=True,
            )

        if any(keyword in lowered for keyword in ["services", "what do you do", "what can you help with"]):
            summary = session.runtimeConfig.voicePolicyV2.knowledgeConfig.faqSummary
            return SpecialistResult(
                domain="knowledge",
                confidence=0.9,
                reply=summary or "I can help with appointments, prescription refills, insurance questions, and billing support.",
                operatorSummary="Answered practice-services question from knowledge config.",
                resolved=True,
            )

        if any(keyword in lowered for keyword in ["after hours", "closed", "voicemail", "call back"]):
            policy = session.runtimeConfig.voicePolicyV2.afterHoursPolicy.greeting
            return SpecialistResult(
                domain="knowledge",
                confidence=0.9,
                reply=policy,
                operatorSummary="Answered after-hours policy question.",
                resolved=True,
            )

        return None


class SchedulingAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        payload = dict(session.partialPayloads.get("scheduling", {}))
        service_type = payload.get("serviceType") or _extract_service_type(text)
        preferred_date = payload.get("preferredDate") or _extract_after_keyword(text, "on")
        preferred_time = payload.get("preferredTime") or _extract_after_keyword(text, "at")
        if service_type:
            payload["serviceType"] = service_type
        if preferred_date:
            payload["preferredDate"] = preferred_date
        if preferred_time:
            payload["preferredTime"] = preferred_time

        session.partialPayloads["scheduling"] = payload
        if not payload.get("serviceType"):
            return SpecialistResult(
                domain="scheduling",
                confidence=0.82,
                reply="What kind of appointment do you need, such as a physical, consultation, or follow-up?",
                missingFields=["serviceType"],
                operatorSummary="Collecting appointment type before scheduling request.",
            )

        summary = f"you want the practice to request a {payload['serviceType']} appointment"
        if payload.get("preferredDate"):
            summary += f" on {payload['preferredDate']}"
        if payload.get("preferredTime"):
            summary += f" at {payload['preferredTime']}"

        return SpecialistResult(
            domain="scheduling",
            confidence=0.9,
            reply=f"Before I submit that, please confirm: {summary}.",
            confirmationSummary=summary,
            runtimeAction="appointment-request",
            runtimePayload={
                "callerName": session.callerName or "Caller",
                "callerPhone": session.callerPhone,
                "serviceType": payload["serviceType"],
                "preferredDate": payload.get("preferredDate"),
                "preferredTime": payload.get("preferredTime"),
                "notes": text.strip(),
                "confirmed": True,
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.servicePolicies["scheduling"].fallbackSummary,
            operatorSummary="Prepared appointment request for confirmation.",
        )


class RefillAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        payload = dict(session.partialPayloads.get("refill", {}))
        medication_name = payload.get("medicationName") or _extract_medication_name(text)
        if medication_name:
            payload["medicationName"] = medication_name
        session.partialPayloads["refill"] = payload

        if not payload.get("medicationName"):
            return SpecialistResult(
                domain="refill",
                confidence=0.84,
                reply="What medication would you like the practice to refill?",
                missingFields=["medicationName"],
                operatorSummary="Collecting medication name before refill request.",
            )

        summary = f"you want the practice to submit a refill request for {payload['medicationName']}"
        return SpecialistResult(
            domain="refill",
            confidence=0.92,
            reply=f"Before I submit that, please confirm: {summary}.",
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
            operatorSummary="Prepared refill request for confirmation.",
        )


class InsuranceAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        payload = dict(session.partialPayloads.get("insurance", {}))
        carrier_name = payload.get("carrierName") or _extract_insurance_carrier(text)
        if carrier_name:
            payload["carrierName"] = carrier_name
        session.partialPayloads["insurance"] = payload

        if not payload.get("carrierName"):
            return SpecialistResult(
                domain="insurance",
                confidence=0.8,
                reply="Which insurance carrier would you like me to check?",
                missingFields=["carrierName"],
                operatorSummary="Collecting insurance carrier before live check.",
            )

        return SpecialistResult(
            domain="insurance",
            confidence=0.9,
            reply=f"I'll check {payload['carrierName']} for you now.",
            runtimeAction="insurance-check",
            runtimePayload={
                "callerName": session.callerName or None,
                "callerPhone": session.callerPhone or None,
                "carrierName": payload["carrierName"],
                "planName": payload.get("planName"),
                "inquiryType": "acceptance",
            },
            fallbackRecommendation=session.runtimeConfig.voicePolicyV2.servicePolicies["insurance"].fallbackSummary,
            operatorSummary="Prepared insurance acceptance check.",
            resolved=True,
        )


class BillingAgent:
    def handle(self, session: SessionState, text: str) -> SpecialistResult:
        payload = dict(session.partialPayloads.get("billing", {}))
        topic = payload.get("billingTopic") or text.strip()
        payload["billingTopic"] = topic
        session.partialPayloads["billing"] = payload

        summary = f"you want the practice to follow up about {topic}"
        return SpecialistResult(
            domain="billing",
            confidence=0.86,
            reply=f"Before I submit that, please confirm: {summary}.",
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
            operatorSummary="Prepared billing request for confirmation.",
        )


class HandoffAgent:
    def build_after_hours_urgent_reply(self, session: SessionState) -> SpecialistResult:
        callback_window = session.runtimeConfig.voicePolicyV2.escalationConfig.urgentCallbackWindowMinutes
        return SpecialistResult(
            domain="handoff",
            confidence=0.98,
            reply=(
                f"{session.runtimeConfig.voicePolicyV2.afterHoursPolicy.greeting} "
                f"Please leave a message and the team will review urgent callbacks within about {callback_window} minutes during staffed hours."
            ),
            operatorSummary="After-hours urgent flow triggered. Awaiting voicemail capture.",
            requestHumanFollowUp=True,
            resolved=True,
        )

    def build_manual_follow_up(self, text: str) -> SpecialistResult:
        return SpecialistResult(
            domain="handoff",
            confidence=0.8,
            reply="I can have the staff follow up with you directly. I'll capture that request now.",
            runtimeAction="manual-follow-up",
            runtimePayload={
                "title": "Manual staff follow-up requested",
                "summary": text.strip(),
                "priority": "HIGH",
            },
            fallbackRecommendation="manual-follow-up",
            operatorSummary="Manual follow-up requested by caller.",
            requestHumanFollowUp=True,
            resolved=True,
        )


class SupervisorAgent:
    DOMAIN_KEYWORDS = [
        ("scheduling", ["appointment", "schedule", "reschedule", "cancel"]),
        ("refill", ["refill", "medication", "prescription", "pharmacy"]),
        ("insurance", ["insurance", "coverage", "carrier", "plan", "copay"]),
        ("billing", ["billing", "bill", "statement", "payment", "balance"]),
        ("handoff", ["human", "staff", "representative", "someone"]),
    ]

    def choose_domain(self, session: SessionState, text: str) -> str:
        enabled_domains = set(session.runtimeConfig.voicePolicyV2.enabledDomains)
        lowered = _normalize(text)
        for domain, keywords in self.DOMAIN_KEYWORDS:
            if domain in enabled_domains and any(keyword in lowered for keyword in keywords):
                return domain

        if (
            session.activeDomain
            and session.pendingAction is None
            and session.activeDomain in enabled_domains
            and session.activeDomain not in {"knowledge", "safety"}
        ):
            return session.activeDomain
        return "knowledge"
