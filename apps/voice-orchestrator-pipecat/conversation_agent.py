"""
AI voice receptionist agent for medical/dental clinics.

Handles one problem at a time, then asks if the caller needs anything else.
Safety check (emergency keywords) runs on every turn — cannot be bypassed.
"""
import json
from typing import Dict, List, Any, Optional
from loguru import logger

from openai import AsyncAzureOpenAI
from config import settings
from call_context import CallContext, CallState, IntentType


# ─── Emergency keywords — always-on, cannot be disabled ──────────────────────

EMERGENCY_KEYWORDS = [
    "chest pain", "heart attack", "cardiac arrest", "stroke",
    "can't breathe", "not breathing", "difficulty breathing",
    "unconscious", "unresponsive", "passed out",
    "seizure", "convulsion",
    "severe bleeding", "hemorrhage",
    "overdose", "poisoning",
    "allergic reaction", "anaphylaxis", "throat closing",
    "suicidal", "want to die", "kill myself", "harm myself",
    "suicide", "mental health crisis",
    "call 911", "send an ambulance",
]

# ─── Out-of-scope topics — trigger deflection, not engagement ─────────────────

OUT_OF_SCOPE_TOPICS = [
    "what do i have", "do i have", "is it serious", "should i be worried",
    "diagnosis", "diagnose", "test results", "lab results",
    "medication side effects", "drug interaction", "adverse reaction",
    "should i take", "is it safe to take", "how much should i take",
    "medical advice", "doctor advice", "clinical assessment",
    "malpractice", "sue", "lawsuit",
]

# ─── System prompt ────────────────────────────────────────────────────────────

RECEPTIONIST_SYSTEM_PROMPT = """You are an AI voice receptionist for a medical/dental clinic. 
Your job is to help callers with ONE problem at a time, then ask if they need anything else.

WHAT YOU CAN HELP WITH (route to the appropriate agent):
- Scheduling: Book, reschedule, or cancel appointments
- Billing: Balance inquiries, payment processing
- Insurance: Whether we accept their plan, basic coverage info, claim/auth status  
- FAQ: Office hours, location, services, providers, new patient info, prep instructions
- Prescription Refill: Log a refill request or check refill status

HARD RULES — NEVER BREAK THESE:
1. If the caller mentions any emergency (chest pain, can't breathe, suicidal, etc.): 
   Say "If this is a life-threatening emergency, please call 911 immediately or stay on the line." 
   Then escalate immediately. Do not ask follow-up questions.
2. If asked for clinical advice (symptoms, diagnoses, medication questions, what they should do medically):
   Say "I'm not able to help with that, but I can connect you with a staff member. Would you like me to transfer you?"
   Do not engage further on the clinical topic.
3. Never ask about the reason for an appointment beyond the service type (e.g., "cleaning" or "consultation").
4. After resolving each problem, ALWAYS ask: "Is there anything else I can help you with today?"
5. If a caller needs a human and no one is available, offer to record a voicemail message.
6. New prescriptions (never filled before) always go to a human — never try to process them.
7. Payment plan negotiations or billing disputes always go to a human.

CONVERSATION STYLE:
- Warm, efficient, professional
- Speak in short sentences (this is a phone call)
- Confirm key details back before taking action
- Never sound robotic — you are a receptionist, not an automated system

When you have collected the information needed for an action, call the appropriate tool function.
"""

CONTINUATION_PROMPT = "Is there anything else I can help you with today?"

# ─── Tool definitions ─────────────────────────────────────────────────────────

TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "detect_intent",
            "description": "Classify the caller's intent and route to the correct agent.",
            "parameters": {
                "type": "object",
                "properties": {
                    "intent": {
                        "type": "string",
                        "enum": ["scheduling", "billing", "insurance", "faq", "prescription_refill", "human_transfer", "unknown"],
                        "description": "The primary intent detected.",
                    },
                    "confidence": {"type": "number", "description": "Confidence score 0-1."},
                    "sub_intent": {"type": "string", "description": "More specific intent (e.g. 'reschedule', 'new_appointment')."},
                },
                "required": ["intent", "confidence"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_appointment",
            "description": "Book, reschedule, or cancel an appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "caller_name": {"type": "string"},
                    "caller_phone": {"type": "string"},
                    "caller_dob": {"type": "string", "description": "Date of birth (YYYY-MM-DD)"},
                    "service_type": {"type": "string", "description": "e.g. 'cleaning', 'consultation', 'follow-up'"},
                    "provider_preference": {"type": "string"},
                    "action": {"type": "string", "enum": ["book", "reschedule", "cancel"]},
                    "preferred_time": {"type": "string"},
                },
                "required": ["caller_name", "caller_phone", "service_type", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_balance",
            "description": "Look up a caller's account balance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "caller_name": {"type": "string"},
                    "caller_dob": {"type": "string"},
                    "account_last_four": {"type": "string"},
                },
                "required": ["caller_name", "caller_dob"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_insurance",
            "description": "Check if an insurance plan is accepted and get basic coverage info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "carrier_name": {"type": "string"},
                    "plan_name": {"type": "string"},
                    "member_id": {"type": "string"},
                    "inquiry_type": {
                        "type": "string",
                        "enum": ["acceptance", "coverage", "claim_status", "prior_auth_status"],
                    },
                },
                "required": ["carrier_name", "inquiry_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_faq",
            "description": "Look up an answer from the clinic's knowledge base.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The caller's question in plain English."},
                    "category": {
                        "type": "string",
                        "enum": ["hours", "location", "services", "providers", "new_patient", "forms", "prep_instructions", "parking", "general"],
                    },
                },
                "required": ["query", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_refill_request",
            "description": "Log a prescription refill request or check refill status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "caller_name": {"type": "string"},
                    "caller_dob": {"type": "string"},
                    "caller_phone": {"type": "string"},
                    "medication_name": {"type": "string"},
                    "prescriber_name": {"type": "string"},
                    "pharmacy_name": {"type": "string"},
                    "pharmacy_phone": {"type": "string"},
                    "action": {"type": "string", "enum": ["request", "status_check"]},
                },
                "required": ["caller_name", "caller_phone", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "transfer_to_human",
            "description": "Transfer the call to a human staff member or offer voicemail.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Why the caller needs a human."},
                    "context_summary": {"type": "string", "description": "Brief summary of what was discussed."},
                    "is_urgent": {"type": "boolean"},
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "end_call",
            "description": "End the call gracefully after the caller says they are done.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "enum": ["caller_done", "max_turns_reached", "error"]},
                },
                "required": ["reason"],
            },
        },
    },
]


class ConversationAgent:
    """
    Voice receptionist for a medical/dental clinic.
    Implements the one-problem-at-a-time loop with safety check on every turn.
    """

    def __init__(self, context: Optional[CallContext] = None):
        self.context = context
        self.client = AsyncAzureOpenAI(
            api_key=settings.azure_openai_key,
            azure_endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
        )
        self.model = settings.azure_openai_deployment

    def _quick_emergency_check(self, text: str) -> Optional[str]:
        """
        Synchronous emergency keyword scan — runs before every LLM call.
        Returns the triggering keyword if found, else None.
        """
        lower = text.lower()
        for kw in EMERGENCY_KEYWORDS:
            if kw in lower:
                return kw
        return None

    def _is_out_of_scope(self, text: str) -> bool:
        lower = text.lower()
        return any(topic in lower for topic in OUT_OF_SCOPE_TOPICS)

    def _build_system_message(self, ctx: CallContext) -> str:
        """Build a contextual system message including completed turns."""
        prompt = RECEPTIONIST_SYSTEM_PROMPT
        if ctx.completed_turns:
            prompt += f"\n\nCALL HISTORY SO FAR (turn {ctx.current_turn} of {ctx.max_turns}):\n"
            for t in ctx.completed_turns:
                prompt += f"  - Handled: {t.intent_key} (outcome: {t.outcome})\n"
        if ctx.caller_name:
            prompt += f"\nCALLER NAME: {ctx.caller_name}"
        return prompt

    async def get_greeting(self, ctx: CallContext, business_name: str = "our clinic") -> str:
        """Generate the initial greeting for a new call."""
        ctx.state = CallState.GREETING
        greeting = (
            f"Thank you for calling {business_name}. "
            "I'm your virtual receptionist and I can help you with appointments, billing, "
            "insurance questions, and more. How can I help you today?"
        )
        ctx.add_message("assistant", greeting)
        ctx.state = CallState.INTENT_DETECTION
        return greeting

    async def process_utterance(self, utterance: str, ctx: CallContext) -> Dict[str, Any]:
        """
        Process a caller utterance. Returns a response dict with:
          - speak: text to say back
          - state: updated call state
          - action: tool action taken (if any)
          - is_emergency: bool
        """
        ctx.add_message("user", utterance)

        # 1. Emergency check — highest priority, always runs
        triggered_kw = self._quick_emergency_check(utterance)
        if triggered_kw:
            logger.warning(f"Emergency keyword '{triggered_kw}' in call {ctx.call_id}")
            ctx.is_emergency = True
            ctx.state = CallState.ESCALATING
            speak = (
                "I'm hearing something that may be a medical emergency. "
                "If this is life-threatening, please hang up and call 9-1-1 immediately. "
                "Would you like me to stay on the line with you?"
            )
            ctx.add_message("assistant", speak)
            return {"speak": speak, "state": ctx.state.value, "is_emergency": True, "triggered_keyword": triggered_kw}

        # 2. Out-of-scope check
        if self._is_out_of_scope(utterance):
            logger.info(f"Out-of-scope topic detected in call {ctx.call_id}")
            speak = (
                "I'm not able to help with that, but I can connect you with a staff member who can. "
                "Would you like me to transfer you?"
            )
            ctx.add_message("assistant", speak)
            return {"speak": speak, "state": ctx.state.value, "is_emergency": False, "out_of_scope": True}

        # 3. Continuation check — ask "anything else?" after a resolved turn
        if ctx.state == CallState.CONTINUATION_CHECK:
            lower = utterance.lower()
            if any(w in lower for w in ["no", "that's all", "i'm good", "all good", "nothing", "bye", "goodbye", "thank you"]):
                ctx.state = CallState.ENDING
                speak = "Thank you for calling. Have a wonderful day!"
                ctx.add_message("assistant", speak)
                return {"speak": speak, "state": ctx.state.value, "action": "end_call", "is_emergency": False}
            else:
                # Caller has another question — reset for next turn
                ctx.state = CallState.AGENT_HANDLING

        # 4. Pass to LLM with tool calling
        return await self._llm_turn(ctx)

    async def generate_response(self, user_message: str) -> str:
        """Compatibility wrapper used by the active voice runtime."""
        if not self.context:
            raise ValueError("ConversationAgent requires a bound CallContext for generate_response().")

        result = await self.process_utterance(user_message, self.context)
        speak = result.get("speak")
        if speak:
            return speak

        action = result.get("action")
        if action == "intent_detected":
            intent = str(result.get("intent") or "that request").replace("_", " ")
            return f"I can help with {intent}. Tell me a little more so I can get that started."

        return "How can I help you with that today?"

    async def _llm_turn(self, ctx: CallContext) -> Dict[str, Any]:
        """Run a single LLM completion with tool calling."""
        messages = [{"role": "system", "content": self._build_system_message(ctx)}]
        for msg in ctx.messages:
            entry: Dict[str, Any] = {"role": msg.role, "content": msg.content}
            if msg.tool_call_id:
                entry["tool_call_id"] = msg.tool_call_id
                entry["name"] = msg.tool_name
            messages.append(entry)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.4,
                max_tokens=512,
            )
        except Exception as e:
            logger.error(f"LLM error in call {ctx.call_id}: {e}")
            speak = "I'm sorry, I'm having trouble right now. Let me transfer you to a staff member."
            return {"speak": speak, "state": ctx.state.value, "action": "human_transfer", "is_emergency": False}

        choice = response.choices[0]
        msg = choice.message

        # Handle tool calls
        if msg.tool_calls:
            tool_call = msg.tool_calls[0]
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments)
            except Exception:
                fn_args = {}

            logger.info(f"Tool call: {fn_name}({fn_args}) in call {ctx.call_id}")

            # Execute and return appropriate response
            result = await self._execute_tool(fn_name, fn_args, ctx)
            return result

        # Plain text response
        speak = msg.content or "I'm sorry, could you say that again?"
        ctx.add_message("assistant", speak)
        return {"speak": speak, "state": ctx.state.value, "is_emergency": False}

    async def _execute_tool(self, fn_name: str, args: Dict[str, Any], ctx: CallContext) -> Dict[str, Any]:
        """Execute a tool call and return a response dict."""

        if fn_name == "detect_intent":
            intent = args.get("intent", "unknown")
            ctx.detected_intent = intent
            ctx.active_agent_id = intent
            ctx.state = CallState.AGENT_HANDLING
            return {"speak": None, "state": ctx.state.value, "action": "intent_detected", "intent": intent, "is_emergency": False}

        if fn_name == "schedule_appointment":
            ctx.collected_fields.update(args)
            speak = (
                f"I've noted your appointment request for {args.get('service_type', 'a visit')}. "
                "Let me check availability. One moment please."
            )
            ctx.add_message("assistant", speak)
            ctx.resolve_current_turn(outcome="resolved")
            return {
                "speak": f"{speak} {CONTINUATION_PROMPT}",
                "state": ctx.state.value,
                "action": "schedule_appointment",
                "data": args,
                "is_emergency": False,
            }

        if fn_name == "check_balance":
            speak = "Let me look that up for you. One moment."
            ctx.add_message("assistant", speak)
            ctx.resolve_current_turn(outcome="resolved")
            return {
                "speak": f"{speak} {CONTINUATION_PROMPT}",
                "state": ctx.state.value,
                "action": "check_balance",
                "data": args,
                "is_emergency": False,
            }

        if fn_name == "check_insurance":
            speak = "Let me check our insurance records for you."
            ctx.add_message("assistant", speak)
            ctx.resolve_current_turn(outcome="resolved")
            return {
                "speak": f"{speak} {CONTINUATION_PROMPT}",
                "state": ctx.state.value,
                "action": "check_insurance",
                "data": args,
                "is_emergency": False,
            }

        if fn_name == "lookup_faq":
            ctx.resolve_current_turn(outcome="resolved")
            speak = "Let me find that information for you."
            ctx.add_message("assistant", speak)
            return {
                "speak": f"{speak} {CONTINUATION_PROMPT}",
                "state": ctx.state.value,
                "action": "lookup_faq",
                "data": args,
                "is_emergency": False,
            }

        if fn_name == "submit_refill_request":
            ctx.collected_fields.update(args)
            ctx.resolve_current_turn(outcome="resolved")
            speak = (
                f"I've logged your refill request for {args.get('medication_name', 'your medication')}. "
                "The provider will review it and contact your pharmacy within one to two business days."
            )
            ctx.add_message("assistant", speak)
            return {
                "speak": f"{speak} {CONTINUATION_PROMPT}",
                "state": ctx.state.value,
                "action": "submit_refill_request",
                "data": args,
                "is_emergency": False,
            }

        if fn_name == "transfer_to_human":
            ctx.state = CallState.ESCALATING
            ctx.resolve_current_turn(outcome="escalated")
            speak = "I'll connect you with a staff member now. Please hold one moment."
            ctx.add_message("assistant", speak)
            return {
                "speak": speak,
                "state": ctx.state.value,
                "action": "human_transfer",
                "data": args,
                "is_emergency": False,
            }

        if fn_name == "end_call":
            ctx.state = CallState.ENDING
            speak = "Thank you for calling. Have a wonderful day!"
            ctx.add_message("assistant", speak)
            return {
                "speak": speak,
                "state": ctx.state.value,
                "action": "end_call",
                "is_emergency": False,
            }

        # Unknown tool
        logger.warning(f"Unknown tool call: {fn_name}")
        speak = "I'm sorry, something went wrong. Let me transfer you to a staff member."
        return {"speak": speak, "state": ctx.state.value, "action": "human_transfer", "is_emergency": False}

    async def get_voicemail_prompt(self, ctx: CallContext) -> str:
        """Generate the voicemail recording prompt when no human is available."""
        speak = (
            "I'm sorry, no one is available to take your call right now. "
            "Please leave your name, phone number, and a brief message after the tone "
            "and we'll return your call as soon as possible."
        )
        ctx.state = CallState.VOICEMAIL
        ctx.add_message("assistant", speak)
        return speak


class ConversationAgentManager:
    """Manages one ConversationAgent per active call."""

    def __init__(self):
        self._agents: Dict[str, ConversationAgent] = {}

    def get_or_create_agent(self, context: CallContext) -> ConversationAgent:
        agent = self._agents.get(context.call_sid)
        if agent is None:
            agent = ConversationAgent(context)
            self._agents[context.call_sid] = agent
            logger.info(f"Created ConversationAgent for call {context.call_sid}")
        else:
            agent.context = context
        return agent

    def remove_agent(self, call_sid: str):
        if call_sid in self._agents:
            del self._agents[call_sid]
            logger.info(f"Removed ConversationAgent for call {call_sid}")

    def update_config(self, call_sid: str, new_config: dict):
        agent = self._agents.get(call_sid)
        if agent and "persona" in new_config:
            agent.context.active_persona = new_config.get("persona")
            logger.info(f"Updated ConversationAgent persona for {call_sid}")


conversation_agent_manager = ConversationAgentManager()
