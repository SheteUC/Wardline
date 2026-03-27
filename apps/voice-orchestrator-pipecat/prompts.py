"""
System prompts and greeting messages for Wardline Voice AI
"""
from typing import List, Dict, Any


def get_greeting_prompt(business_name: str = "Wardline Medical Center") -> str:
    """Return the opening greeting spoken to the caller."""
    return (
        f"Thank you for calling {business_name}. "
        "This is Wardline, the virtual receptionist for the practice. "
        "How can I help you today?"
    )


def get_system_prompt(
    business_name: str = "Wardline Medical Center",
    intents: List[Dict[str, Any]] = None,
    departments: List[Dict[str, Any]] = None,
    runtime_config: Dict[str, Any] | None = None,
) -> str:
    """
    Build the LLM system prompt from business context.

    Args:
        business_name: Name of the practice.
        intents: List of configured intent objects from Core API.
        departments: List of department objects from Core API.

    Returns:
        Formatted system prompt string.
    """
    intents = intents or []
    departments = departments or []

    # Build intent section
    intent_lines = ""
    if intents:
        enabled = [i for i in intents if i.get("enabled", True)]
        if enabled:
            intent_lines = "\n\nSupported call reasons:\n" + "\n".join(
                f"- {i.get('displayName', i.get('key', ''))}: {i.get('description', '')}"
                for i in enabled
            )

    # Build department section
    dept_lines = ""
    if departments:
        active = [d for d in departments if d.get("isActive", True)]
        if active:
            dept_lines = "\n\nAvailable departments:\n" + "\n".join(
                f"- {d.get('name', '')}: {d.get('phoneNumber', '')} (ext {d.get('extension', 'N/A')})"
                for d in active
            )

    runtime_settings = runtime_config.get("settings", {}) if isinstance(runtime_config, dict) else {}
    knowledge_config = runtime_settings.get("knowledgeConfig", {}) if isinstance(runtime_settings, dict) else {}
    enabled_actions = runtime_settings.get("enabledActions", []) if isinstance(runtime_settings, dict) else []
    after_hours_policy = runtime_settings.get("afterHoursPolicy", {}) if isinstance(runtime_settings, dict) else {}

    enabled_services = []
    for action in enabled_actions if isinstance(enabled_actions, list) else []:
        if action == "appointment-request":
            enabled_services.append("appointments")
        elif action == "refill-request":
            enabled_services.append("prescription refills")
        elif action == "insurance-check":
            enabled_services.append("insurance checks")
        elif action == "billing-request":
            enabled_services.append("billing questions")

    practice_lines = ""
    if enabled_services:
        practice_lines += "\n\nLive services enabled:\n" + "\n".join(
            f"- {service}" for service in enabled_services
        )
    if isinstance(knowledge_config, dict) and knowledge_config.get("faqSummary"):
        practice_lines += f"\n\nPractice summary:\n- {knowledge_config.get('faqSummary')}"
    if isinstance(knowledge_config, dict) and isinstance(knowledge_config.get("commonQuestions"), list):
        common_questions = [question for question in knowledge_config.get("commonQuestions", []) if question]
        if common_questions:
            practice_lines += "\n\nCommon caller questions:\n" + "\n".join(
                f"- {question}" for question in common_questions
            )
    if isinstance(after_hours_policy, dict) and after_hours_policy.get("greeting"):
        practice_lines += f"\n\nAfter-hours policy:\n- {after_hours_policy.get('greeting')}"

    return f"""You are a warm, professional AI medical receptionist for {business_name}.

Your responsibilities:
- Greet callers courteously and identify how you can help
- Assist with appointment scheduling, prescription refills, insurance inquiries, and department routing
- Collect necessary information efficiently and confirm details with the caller
- Transfer callers to human staff when the situation requires it
- Escalate medical emergencies immediately — instruct the caller to hang up and call 911 if their life is in danger
{intent_lines}{dept_lines}{practice_lines}

Core rules you must always follow:
1. NEVER provide medical advice, diagnoses, or treatment recommendations.
2. If a caller describes symptoms of a life-threatening emergency (chest pain, difficulty breathing, stroke, severe bleeding, loss of consciousness, overdose, suicidal ideation), immediately instruct them to call 911 or go to the nearest emergency room.
3. For clinical questions (test results, medication side effects, symptoms), offer to transfer the caller to a nurse or physician.
4. Maintain strict patient confidentiality — do not repeat sensitive information unnecessarily.
5. Keep responses concise and clear; this is a phone conversation, not a chat interface.
6. Confirm important details (name, date of birth, phone number) by repeating them back to the caller.
7. If you cannot help with something, say so clearly and offer to transfer the caller to the appropriate department.

When you need to use a tool, call it silently and incorporate the result naturally into your response without revealing internal tool names.
"""
