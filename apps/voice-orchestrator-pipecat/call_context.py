"""
Call context management for tracking conversation state
"""
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum


class CallState(Enum):
    """States in the call flow"""
    INITIALIZING = "initializing"
    GREETING = "greeting"
    LISTENING = "listening"
    PROCESSING = "processing"
    RESPONDING = "responding"
    COLLECTING_INFO = "collecting_info"
    ESCALATING = "escalating"
    TRANSFERRING = "transferring"
    ENDING = "ending"
    COMPLETED = "completed"


class IntentType(Enum):
    """Types of caller intents"""
    SCHEDULING = "scheduling"
    BILLING = "billing"
    PRESCRIPTION_REFILL = "refill"
    INSURANCE = "insurance"
    MEDICAL_RECORDS = "records"
    CLINICAL_TRIAGE = "clinical-triage"
    DEPARTMENT_ROUTING = "department"
    GENERAL_INQUIRY = "general"
    EMERGENCY = "emergency"
    TRANSFER_TO_HUMAN = "transfer"
    UNKNOWN = "unknown"


@dataclass
class SentimentData:
    """Sentiment analysis results"""
    overall_score: float = 0.5  # 0-1, 0.5 = neutral
    frustration_level: float = 0.0
    urgency_level: float = 0.0
    escalation_needed: bool = False
    reason: str = ""


@dataclass
class CollectedField:
    """A field collected from the caller"""
    key: str
    value: Any
    confirmed: bool = False


@dataclass
class ConversationTurn:
    """A single turn in the conversation"""
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    intent: Optional[str] = None
    sentiment: Optional[float] = None


@dataclass
class CallContext:
    """Complete context for a phone call"""
    # Call identification
    call_sid: str
    stream_sid: Optional[str] = None
    call_id: Optional[str] = None  # Core API call record ID
    
    # Caller info
    caller_phone: str = ""
    caller_name: Optional[str] = None
    
    # Hospital info
    hospital_id: str = ""
    hospital_name: str = "Wardline Medical Center"
    to_phone: str = ""
    
    # State
    state: CallState = CallState.INITIALIZING
    detected_intent: Optional[IntentType] = None
    is_emergency: bool = False
    
    # Conversation
    conversation_history: List[ConversationTurn] = field(default_factory=list)
    collected_fields: Dict[str, CollectedField] = field(default_factory=dict)
    
    # Sentiment tracking
    sentiment: SentimentData = field(default_factory=SentimentData)
    
    # Configuration loaded from DB
    intents: List[Dict[str, Any]] = field(default_factory=list)
    departments: List[Dict[str, Any]] = field(default_factory=list)
    workflow: Optional[Dict[str, Any]] = None
    
    # Timestamps
    started_at: datetime = field(default_factory=datetime.now)
    ended_at: Optional[datetime] = None
    
    # Escalation
    escalation_reason: Optional[str] = None
    transfer_target: Optional[str] = None
    
    def add_user_message(self, content: str, intent: Optional[str] = None):
        """Add a user message to history"""
        self.conversation_history.append(ConversationTurn(
            role="user",
            content=content,
            intent=intent
        ))
    
    def add_assistant_message(self, content: str):
        """Add an assistant message to history"""
        self.conversation_history.append(ConversationTurn(
            role="assistant",
            content=content
        ))
    
    def get_conversation_text(self, last_n: int = 10) -> str:
        """Get conversation as text for analysis"""
        turns = self.conversation_history[-last_n:] if last_n else self.conversation_history
        return "\n".join([
            f"{turn.role.capitalize()}: {turn.content}"
            for turn in turns
        ])
    
    def get_messages_for_llm(self, last_n: int = 10) -> List[Dict[str, str]]:
        """Get conversation history formatted for LLM"""
        turns = self.conversation_history[-last_n:] if last_n else self.conversation_history
        return [
            {"role": turn.role, "content": turn.content}
            for turn in turns
        ]
    
    def collect_field(self, key: str, value: Any, confirmed: bool = False):
        """Collect a field from the conversation"""
        self.collected_fields[key] = CollectedField(
            key=key,
            value=value,
            confirmed=confirmed
        )
    
    def has_required_fields(self, required: List[str]) -> bool:
        """Check if all required fields are collected"""
        return all(
            key in self.collected_fields and self.collected_fields[key].confirmed
            for key in required
        )
    
    def should_escalate(self) -> bool:
        """Determine if call should be escalated to human"""
        if self.is_emergency:
            return True
        if self.sentiment.escalation_needed:
            return True
        if self.sentiment.frustration_level > 0.7:
            return True
        if self.detected_intent == IntentType.TRANSFER_TO_HUMAN:
            return True
        return False


class CallContextManager:
    """Manager for all active call contexts"""
    
    def __init__(self):
        self._contexts: Dict[str, CallContext] = {}
    
    def create_context(self, call_sid: str, **kwargs) -> CallContext:
        """Create a new call context"""
        context = CallContext(call_sid=call_sid, **kwargs)
        self._contexts[call_sid] = context
        return context
    
    def get_context(self, call_sid: str) -> Optional[CallContext]:
        """Get context by call SID"""
        return self._contexts.get(call_sid)
    
    def remove_context(self, call_sid: str):
        """Remove a call context"""
        if call_sid in self._contexts:
            del self._contexts[call_sid]
    
    def get_all_active(self) -> List[CallContext]:
        """Get all active call contexts"""
        return list(self._contexts.values())


# Global context manager
context_manager = CallContextManager()

