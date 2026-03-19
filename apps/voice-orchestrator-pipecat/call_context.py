"""
Call context management — tracks conversation state for the one-problem-at-a-time model.
"""
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum


class CallState(Enum):
    """States in the call flow"""
    INITIALIZING = "initializing"
    GREETING = "greeting"
    INTENT_DETECTION = "intent_detection"
    AGENT_HANDLING = "agent_handling"
    CONTINUATION_CHECK = "continuation_check"
    ESCALATING = "escalating"
    VOICEMAIL = "voicemail"
    ENDING = "ending"
    COMPLETED = "completed"


class IntentType(Enum):
    """Caller intents — mapped to the 5 starter agents"""
    SCHEDULING = "scheduling"
    BILLING = "billing"
    INSURANCE = "insurance"
    FAQ = "faq"
    PRESCRIPTION_REFILL = "prescription_refill"
    HUMAN_TRANSFER = "human_transfer"
    EMERGENCY = "emergency"
    UNKNOWN = "unknown"


@dataclass
class CallTurn:
    """A single resolved problem turn within the call"""
    turn_number: int
    agent_id: str             # catalogId of the agent that handled it
    intent_key: str
    collected_fields: Dict[str, Any] = field(default_factory=dict)
    outcome: str = "resolved"  # resolved | escalated | voicemail | emergency
    started_at: str = ""
    resolved_at: Optional[str] = None


@dataclass
class ConversationMessage:
    """One message in the LLM conversation history"""
    role: str   # "system" | "user" | "assistant" | "tool"
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None


@dataclass
class CallContext:
    """Full state for one inbound call"""
    # Identity
    call_id: str
    business_id: str
    phone_number_id: str
    twilio_call_sid: str
    caller_phone: str
    caller_name: Optional[str] = None

    # State machine
    state: CallState = CallState.INITIALIZING
    current_turn: int = 0
    max_turns: int = 5

    # Completed problem turns
    completed_turns: List[CallTurn] = field(default_factory=list)

    # Current turn state
    active_agent_id: Optional[str] = None   # catalogId
    detected_intent: Optional[str] = None
    collected_fields: Dict[str, Any] = field(default_factory=dict)

    # Conversation history (for LLM)
    messages: List[ConversationMessage] = field(default_factory=list)
    transcript: List[str] = field(default_factory=list)

    # Safety
    is_emergency: bool = False
    needs_continuation_check: bool = False

    # Timestamps
    started_at: datetime = field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None

    def resolve_current_turn(self, outcome: str = "resolved") -> None:
        """Mark the current agent turn as resolved and prepare for continuation check."""
        if self.active_agent_id and self.detected_intent:
            turn = CallTurn(
                turn_number=self.current_turn,
                agent_id=self.active_agent_id,
                intent_key=self.detected_intent,
                collected_fields=dict(self.collected_fields),
                outcome=outcome,
                started_at=self.started_at.isoformat(),
                resolved_at=datetime.utcnow().isoformat(),
            )
            self.completed_turns.append(turn)

        self.current_turn += 1
        self.active_agent_id = None
        self.detected_intent = None
        self.collected_fields = {}
        self.needs_continuation_check = True
        self.state = CallState.CONTINUATION_CHECK

    def can_handle_more_turns(self) -> bool:
        return self.current_turn < self.max_turns

    def add_message(self, role: str, content: str, **kwargs) -> None:
        self.messages.append(ConversationMessage(role=role, content=content, **kwargs))
        if role == "user":
            self.transcript.append(f"CALLER: {content}")
        elif role == "assistant":
            self.transcript.append(f"AGENT: {content}")
