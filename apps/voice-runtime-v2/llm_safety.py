"""
LLM safety triage after regex-based SafetyAgent misses semantic risk (e.g. crisis language).
"""
from __future__ import annotations

import json
import logging
from typing import Optional, cast

from config import settings

from llm_client import chat_json_completion
from models import OperatorSummary, SafetyAssessment, SessionState, SpecialistResult

logger = logging.getLogger(__name__)

SYSTEM = """You classify caller utterances for a medical practice phone assistant. Output JSON only.

Levels:
- none: normal scheduling/billing/refill/insurance requests; no crisis or clinical interpretation.
- emergency: immediate danger to life (stroke, can't breathe, overdose, severe bleeding, suicide intent, violence in progress).
- urgent_handoff: caller seeks clinical advice, diagnosis, medication dosing decisions, or interpreting test results — assistant must not advise; staff must follow up.

Do NOT classify as emergency for past-tense medical history without current crisis.
JSON: {"level":"none|emergency|urgent_handoff","category":"medical_emergency|mental_health_emergency|violence_abuse_emergency|clinical_results_or_diagnosis|medication_safety|symptom_interpretation|none","confidence":0.0-1.0}
"""


def _category_alias(category: str) -> str:
    mapping = {
        "medical_emergency": "medical_emergency",
        "mental_health_emergency": "mental_health_emergency",
        "violence_abuse_emergency": "violence_abuse_emergency",
        "clinical_results_or_diagnosis": "clinical_results_or_diagnosis",
        "medication_safety": "medication_safety",
        "symptom_interpretation": "symptom_interpretation",
    }
    return mapping.get(category, "symptom_interpretation")


def _result_for_level(level: str, category: str, text: str) -> Optional[SpecialistResult]:
    if level == "none" or category == "none":
        return None

    cat = _category_alias(category)

    if level == "emergency":
        if category == "mental_health_emergency":
            reply = (
                "I'm concerned this may be an emergency. Please call 911 right now. "
                "If this is a suicide or mental health crisis in the United States, you can also call or text 988."
            )
            return SpecialistResult(
                domain="safety",
                status="handoff",
                confidence=0.95,
                nextPrompt=reply,
                operatorSummary=OperatorSummary(
                    headline="LLM: possible mental health emergency",
                    nextStep="Escalate immediately; confirm caller received 911 and 988 guidance.",
                    specialist="safety",
                    callerRequest=text.strip() or "Crisis concern",
                    followUpRequired=True,
                ),
                callerRequestSummary="Possible mental health emergency (LLM triage).",
                requestHumanFollowUp=True,
                resolved=True,
                safetyAssessment=SafetyAssessment(
                    category="mental_health_emergency",
                    severity="emergency",
                    matchedPatterns=["llm-triage"],
                    headline="LLM: possible mental health emergency",
                    callerReply=reply,
                    operatorNextStep="Escalate immediately; confirm caller received 911 and 988 guidance.",
                ),
            )
        if category == "violence_abuse_emergency":
            reply = (
                "I'm concerned you may be in danger. If you can do so safely, call 911 right now or get to a safe place immediately."
            )
            return SpecialistResult(
                domain="safety",
                status="handoff",
                confidence=0.95,
                nextPrompt=reply,
                operatorSummary=OperatorSummary(
                    headline="LLM: possible violence or abuse emergency",
                    nextStep="Escalate immediately; confirm caller received emergency safety guidance.",
                    specialist="safety",
                    callerRequest=text.strip() or "Safety concern",
                    followUpRequired=True,
                ),
                callerRequestSummary="Possible violence or abuse emergency (LLM triage).",
                requestHumanFollowUp=True,
                resolved=True,
                safetyAssessment=SafetyAssessment(
                    category="violence_abuse_emergency",
                    severity="emergency",
                    matchedPatterns=["llm-triage"],
                    headline="LLM: possible violence or abuse emergency",
                    callerReply=reply,
                    operatorNextStep="Escalate immediately; confirm caller received emergency safety guidance.",
                ),
            )
        reply = (
            "I'm hearing something that may be a medical emergency. Please call 911 right now or go to the nearest emergency room."
        )
        return SpecialistResult(
            domain="safety",
            status="handoff",
            confidence=0.95,
            nextPrompt=reply,
            operatorSummary=OperatorSummary(
                headline="LLM: possible medical emergency",
                nextStep="Escalate immediately; confirm the caller received 911 guidance.",
                specialist="safety",
                callerRequest=text.strip() or "Emergency concern",
                followUpRequired=True,
            ),
            callerRequestSummary="Possible medical emergency (LLM triage).",
            requestHumanFollowUp=True,
            resolved=True,
            safetyAssessment=SafetyAssessment(
                category="medical_emergency",
                severity="emergency",
                matchedPatterns=["llm-triage"],
                headline="LLM: possible medical emergency",
                callerReply=reply,
                operatorNextStep="Escalate immediately; confirm the caller received 911 guidance.",
            ),
        )

    if level == "urgent_handoff":
        reply = (
            "I can't interpret symptoms, test results, or medication questions, but I can connect you with the practice "
            "or take an urgent message for clinical follow-up."
        )
        return SpecialistResult(
            domain="safety",
            status="handoff",
            confidence=0.88,
            nextPrompt=reply,
            operatorSummary=OperatorSummary(
                headline="LLM: clinical question redirected",
                nextStep="Route to clinical staff for appropriate follow-up.",
                specialist="safety",
                callerRequest=text.strip() or "Clinical question",
                followUpRequired=True,
            ),
            callerRequestSummary="Caller asked clinically sensitive question; redirected (LLM triage).",
            requestHumanFollowUp=True,
            resolved=True,
            fallbackRecommendation="manual-follow-up",
            safetyAssessment=SafetyAssessment(
                category=cat,  # type: ignore[arg-type]
                severity="urgent_handoff",
                matchedPatterns=["llm-triage"],
                headline="LLM: clinical question redirected",
                callerReply=reply,
                operatorNextStep="Route to clinical staff for appropriate follow-up.",
            ),
        )

    return None


async def assess_safety_llm(session: SessionState, text: str) -> Optional[SpecialistResult]:
    if not settings.voice_llm_safety:
        return None
    if settings.active_llm_provider() == "none":
        return None
    clean = text.strip()
    if len(clean) < 8:
        return None

    payload = json.dumps(
        {
            "business": session.businessName,
            "caller_message": clean,
        },
        ensure_ascii=False,
    )

    data = await chat_json_completion(
        system_prompt=SYSTEM,
        user_prompt=payload,
        temperature=0.0,
        max_tokens=120,
    )
    if not data:
        return None

    try:
        level = str(data.get("level", "none")).strip().lower()
        category = str(data.get("category", "none")).strip().lower()
        conf = float(data.get("confidence", 0))
    except (TypeError, ValueError):
        return None

    if conf < 0.75:
        return None

    return _result_for_level(level, category, clean)
