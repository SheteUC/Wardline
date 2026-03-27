"""
Internal supervisor and specialist agents for Voice Runtime V2.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Dict, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from models import OperatorSummary, SessionState, SpecialistResult, SupervisorDecision

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
                status="needs_information",
                confidence=0.84,
                nextPrompt="What kind of appointment do you need, such as a physical, consultation, or follow-up?",
                missingFields=["serviceType"],
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting appointment details",
                    nextStep="Continue intake until the visit type is captured.",
                    specialist="scheduling",
                    callerRequest=text.strip() or "Appointment request",
                ),
            )

        summary = f"you want the practice to request a {payload['serviceType']} appointment"
        if payload.get("preferredDate"):
            summary += f" on {payload['preferredDate']}"
        if payload.get("preferredTime"):
            summary += f" at {payload['preferredTime']}"

        return SpecialistResult(
            domain="scheduling",
            status="ready_for_confirmation",
            confidence=0.92,
            nextPrompt=f"Before I submit that, please confirm: {summary}.",
            extractedFields=payload,
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
        payload = dict(session.partialPayloads.get("refill", {}))
        medication_name = payload.get("medicationName") or _extract_medication_name(text)
        if medication_name:
            payload["medicationName"] = medication_name
        session.partialPayloads["refill"] = payload

        if not payload.get("medicationName"):
            return SpecialistResult(
                domain="refill",
                status="needs_information",
                confidence=0.84,
                nextPrompt="What medication would you like the practice to refill?",
                missingFields=["medicationName"],
                extractedFields=payload,
                operatorSummary=OperatorSummary(
                    headline="Collecting refill details",
                    nextStep="Continue intake until the medication name is captured.",
                    specialist="refill",
                    callerRequest=text.strip() or "Refill request",
                ),
            )

        summary = f"you want the practice to submit a refill request for {payload['medicationName']}"
        return SpecialistResult(
            domain="refill",
            status="ready_for_confirmation",
            confidence=0.92,
            nextPrompt=f"Before I submit that, please confirm: {summary}.",
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
        payload = dict(session.partialPayloads.get("insurance", {}))
        carrier_name = payload.get("carrierName") or _extract_insurance_carrier(text)
        if carrier_name:
            payload["carrierName"] = carrier_name
        session.partialPayloads["insurance"] = payload

        if not payload.get("carrierName"):
            return SpecialistResult(
                domain="insurance",
                status="needs_information",
                confidence=0.8,
                nextPrompt="Which insurance carrier would you like me to check?",
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
        payload = dict(session.partialPayloads.get("billing", {}))
        topic = payload.get("billingTopic") or text.strip()
        payload["billingTopic"] = topic
        session.partialPayloads["billing"] = payload

        summary = f"you want the practice to follow up about {topic}"
        return SpecialistResult(
            domain="billing",
            status="ready_for_confirmation",
            confidence=0.87,
            nextPrompt=f"Before I submit that, please confirm: {summary}.",
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
                f"Please leave a message and the team will review urgent callbacks within about {callback_window} minutes during staffed hours."
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
            nextPrompt=f"{policy.greeting} Please leave a message and the practice will follow up during business hours.",
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
            nextPrompt="I can have the staff follow up with you directly. I'll capture that request now.",
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

        if (
            session.activeDomain
            and session.pendingAction is None
            and session.activeDomain in enabled_domains
            and session.activeDomain not in {"knowledge", "safety", "handoff"}
            and session.activeDomain in session.partialPayloads
        ):
            return SupervisorDecision(
                mode="continue",
                domain=session.activeDomain,
                confidence=0.72,
                reason="continue-partial-intake",
                continuation=True,
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
