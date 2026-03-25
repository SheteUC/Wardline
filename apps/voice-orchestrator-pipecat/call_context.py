"""
Call context management for the voice orchestrator.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class CallState(Enum):
    INITIALIZING = "initializing"
    GREETING = "greeting"
    LISTENING = "listening"
    INTENT_DETECTION = "intent_detection"
    AGENT_HANDLING = "agent_handling"
    CONTINUATION_CHECK = "continuation_check"
    ESCALATING = "escalating"
    TRANSFERRING = "transferring"
    VOICEMAIL = "voicemail"
    ENDING = "ending"
    COMPLETED = "completed"


class IntentType(Enum):
    APPOINTMENT = "appointment"
    SCHEDULING = "scheduling"
    BILLING = "billing"
    INSURANCE = "insurance"
    FAQ = "faq"
    PRESCRIPTION_REFILL = "prescription_refill"
    DEPARTMENT_ROUTING = "department_routing"
    HUMAN_TRANSFER = "human_transfer"
    TRANSFER_TO_HUMAN = "human_transfer"
    EMERGENCY = "emergency"
    UNKNOWN = "unknown"


@dataclass
class CallTurn:
    turn_number: int
    agent_id: str
    intent_key: str
    collected_fields: Dict[str, Any] = field(default_factory=dict)
    outcome: str = "resolved"
    started_at: str = ""
    resolved_at: Optional[str] = None


@dataclass
class ConversationMessage:
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None


@dataclass
class CollectedField:
    value: Any
    confirmed: bool = False
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def __bool__(self):
        return bool(self.value)

    def __eq__(self, other: object) -> bool:
        other_value = getattr(other, "value", other)
        return self.value == other_value

    def __lt__(self, other: object) -> bool:
        other_value = getattr(other, "value", other)
        return self.value < other_value

    def __le__(self, other: object) -> bool:
        other_value = getattr(other, "value", other)
        return self.value <= other_value

    def __gt__(self, other: object) -> bool:
        other_value = getattr(other, "value", other)
        return self.value > other_value

    def __ge__(self, other: object) -> bool:
        other_value = getattr(other, "value", other)
        return self.value >= other_value

    def __str__(self) -> str:
        return str(self.value)


@dataclass
class SentimentState:
    overall_score: float = 0.0
    frustration_level: float = 0.0
    urgency_level: float = 0.0
    escalation_needed: bool = False

    @property
    def frustration(self) -> float:
        return self.frustration_level

    @frustration.setter
    def frustration(self, value: float):
        self.frustration_level = value


@dataclass
class CallContext:
    call_sid: str
    call_id: str = ""
    business_id: str = ""
    business_name: str = "Wardline Medical Center"
    phone_number_id: str = ""
    caller_phone: str = ""
    caller_name: Optional[str] = None
    to_phone: str = ""
    time_zone: str = "America/New_York"

    state: CallState = CallState.INITIALIZING
    current_turn: int = 0
    max_turns: int = 5
    paused: bool = False
    active_persona: Optional[str] = None
    active_agent_id: Optional[str] = None
    detected_intent: Optional[IntentType] = None
    completed_turns: List[CallTurn] = field(default_factory=list)
    collected_fields: Dict[str, Any] = field(default_factory=dict)
    workflow: Dict[str, Any] = field(default_factory=dict)
    intents: List[Dict[str, Any]] = field(default_factory=list)
    departments: List[Dict[str, Any]] = field(default_factory=list)
    runtime_config: Dict[str, Any] = field(default_factory=dict)
    transcript: List[str] = field(default_factory=list)
    messages: List[ConversationMessage] = field(default_factory=list)
    sentiment: SentimentState = field(default_factory=SentimentState)
    is_emergency: bool = False
    is_after_hours: bool = False
    needs_continuation_check: bool = False
    escalation_reason: Optional[str] = None
    transfer_target: Optional[str] = None
    matched_urgency_keywords: List[str] = field(default_factory=list)
    pending_confirmation_required: bool = False
    pending_action_name: Optional[str] = None
    pending_action_summary: Optional[str] = None
    pending_action_payload: Dict[str, Any] = field(default_factory=dict)
    last_action_outcome: Dict[str, Any] = field(default_factory=dict)
    started_at: datetime = field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None

    @property
    def twilio_call_sid(self) -> str:
        return self.call_sid

    @property
    def conversation_history(self) -> List[ConversationMessage]:
        return self.messages

    def add_message(self, role: str, content: str, **kwargs):
        message = ConversationMessage(role=role, content=content, **kwargs)
        self.messages.append(message)

        if role == "user":
            self.transcript.append(f"CALLER: {content}")
        elif role == "assistant":
            self.transcript.append(f"AGENT: {content}")
        elif role == "tool":
            self.transcript.append(f"TOOL: {content}")

    def add_user_message(self, content: str):
        self.add_message("user", content)

    def add_assistant_message(self, content: str):
        self.add_message("assistant", content)

    def get_conversation_text(self, last_n: Optional[int] = None) -> str:
        history = self.transcript[-last_n:] if last_n else self.transcript
        return "\n".join(history)

    def collect_field(self, key: str, value: Any, confirmed: bool = False):
        self.collected_fields[key] = CollectedField(value=value, confirmed=confirmed)

    def should_escalate(self) -> bool:
        return (
            self.is_emergency
            or self.sentiment.escalation_needed
            or self.detected_intent == IntentType.TRANSFER_TO_HUMAN
        )

    def can_handle_more_turns(self) -> bool:
        return self.current_turn < self.max_turns

    def resolve_current_turn(self, outcome: str = "resolved"):
        if self.active_agent_id or self.detected_intent:
            plain_fields = {
                key: getattr(value, "value", value)
                for key, value in self.collected_fields.items()
            }
            self.completed_turns.append(
                CallTurn(
                    turn_number=self.current_turn,
                    agent_id=self.active_agent_id or "assistant",
                    intent_key=(self.detected_intent.value if isinstance(self.detected_intent, Enum) else str(self.detected_intent or "unknown")),
                    collected_fields=plain_fields,
                    outcome=outcome,
                    started_at=self.started_at.isoformat(),
                    resolved_at=datetime.utcnow().isoformat(),
                ),
            )

        self.current_turn += 1
        self.active_agent_id = None
        self.detected_intent = None
        self.collected_fields = {}
        self.needs_continuation_check = True
        self.state = CallState.CONTINUATION_CHECK

    def set_pending_action(self, action_name: str, summary: str, payload: Optional[Dict[str, Any]] = None):
        self.pending_confirmation_required = True
        self.pending_action_name = action_name
        self.pending_action_summary = summary
        self.pending_action_payload = payload or {}

    def clear_pending_action(self):
        self.pending_confirmation_required = False
        self.pending_action_name = None
        self.pending_action_summary = None
        self.pending_action_payload = {}

    def mark_action_outcome(self, outcome: Dict[str, Any]):
        self.last_action_outcome = outcome
        self.clear_pending_action()


class ContextManager:
    def __init__(self):
        self._contexts: Dict[str, CallContext] = {}
        self._call_id_to_sid: Dict[str, str] = {}

    def create_context(
        self,
        call_sid: str,
        caller_phone: str = "",
        to_phone: str = "",
        business_id: str = "",
        business_name: str = "Wardline Medical Center",
        phone_number_id: str = "",
        call_id: str = "",
    ) -> CallContext:
        context = CallContext(
            call_sid=call_sid,
            call_id=call_id,
            business_id=business_id,
            business_name=business_name,
            phone_number_id=phone_number_id,
            caller_phone=caller_phone,
            to_phone=to_phone,
        )
        self._contexts[call_sid] = context
        if call_id:
            self._call_id_to_sid[call_id] = call_sid
        return context

    def get_context(self, call_sid: str) -> Optional[CallContext]:
        return self._contexts.get(call_sid)

    def register_call_id(self, call_sid: str, call_id: str):
        context = self._contexts.get(call_sid)
        if context:
            context.call_id = call_id
        self._call_id_to_sid[call_id] = call_sid

    def get_context_by_call_id(self, call_id: str) -> Optional[CallContext]:
        call_sid = self._call_id_to_sid.get(call_id)
        if not call_sid:
            return None
        return self._contexts.get(call_sid)

    def remove_context(self, call_sid: str):
        context = self._contexts.pop(call_sid, None)
        if context and context.call_id:
            self._call_id_to_sid.pop(context.call_id, None)


context_manager = ContextManager()
