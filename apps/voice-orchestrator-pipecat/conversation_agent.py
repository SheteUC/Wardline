"""
Robust Conversational Agent for Voice AI
Uses direct LLM calls with state tracking instead of LangChain tools agent
Designed for reliability on phone calls with short/unclear inputs
"""
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum
from langchain_openai import AzureChatOpenAI
from langchain.schema import SystemMessage, HumanMessage, AIMessage
from loguru import logger
import json
import re

from config import settings
from call_context import CallContext
from prompts import get_conversational_system_prompt


class WorkflowState(Enum):
    """Current state in the conversation workflow"""
    GREETING = "greeting"
    IDENTIFYING_INTENT = "identifying_intent"
    COLLECTING_INFO = "collecting_info"
    CONFIRMING = "confirming"
    COMPLETING = "completing"
    TRANSFERRING = "transferring"


class IntentType(Enum):
    """Detected caller intent"""
    SCHEDULE_APPOINTMENT = "schedule_appointment"
    PRESCRIPTION_REFILL = "prescription_refill"
    INSURANCE_QUESTION = "insurance_question"
    BILLING = "billing"
    TRANSFER_HUMAN = "transfer_human"
    GENERAL_QUESTION = "general_question"
    UNKNOWN = "unknown"


@dataclass
class CollectedInfo:
    """Information collected during conversation"""
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    patient_phone: Optional[str] = None
    reason_for_visit: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    medication_name: Optional[str] = None
    pharmacy_name: Optional[str] = None
    insurance_carrier: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v is not None}
    
    def missing_for_appointment(self) -> List[str]:
        """What's still needed for appointment scheduling"""
        missing = []
        if not self.patient_name:
            missing.append("patient name")
        if not self.patient_dob:
            missing.append("date of birth")
        if not self.reason_for_visit:
            missing.append("reason for visit")
        if not self.preferred_date:
            missing.append("preferred date")
        return missing
    
    def missing_for_prescription(self) -> List[str]:
        """What's still needed for prescription refill"""
        missing = []
        if not self.patient_name:
            missing.append("patient name")
        if not self.patient_dob:
            missing.append("date of birth")
        if not self.medication_name:
            missing.append("medication name")
        if not self.pharmacy_name:
            missing.append("pharmacy name")
        return missing


class ConversationAgent:
    """
    Robust conversational agent that uses direct LLM calls with state tracking.
    More reliable than tool-calling agent for phone conversations.
    """
    
    def __init__(self, context: CallContext):
        self.context = context
        self.llm = self._create_llm()
        self.state = WorkflowState.GREETING
        self.intent: Optional[IntentType] = None
        self.collected_info = CollectedInfo()
        self.conversation_history: List[Dict[str, str]] = []
        self.last_question_topic: Optional[str] = None
        
    def _create_llm(self) -> AzureChatOpenAI:
        """Create LLM instance - gpt-4.1-mini recommended for voice conversations"""
        deployment = settings.azure_openai_deployment
        
        # Log which model is being used
        if "o4" in deployment.lower() or "o1" in deployment.lower():
            logger.warning(
                f"⚠️ Using reasoning model '{deployment}' for conversational AI. "
                "Consider switching to 'gpt-4.1-mini' for better multi-turn dialog."
            )
        elif "4.1" in deployment or "4o" in deployment.lower():
            logger.info(f"✅ Using conversational model: {deployment}")
        
        # Reasoning models (o1/o4) don't support temperature
        is_reasoning_model = "o4" in deployment.lower() or "o1" in deployment.lower()
        
        return AzureChatOpenAI(
            api_key=settings.azure_openai_key,
            api_version=settings.azure_openai_api_version,
            azure_endpoint=settings.azure_openai_endpoint,
            deployment_name=deployment,
            temperature=0.7 if not is_reasoning_model else None,
            max_tokens=150,  # Keep responses brief for phone
        )
    
    def _build_context_prefix(self, user_input: str) -> str:
        """
        Build a context-enriched version of the user input.
        This helps the LLM understand short/unclear inputs.
        """
        context_parts = []
        
        # Add collected information context
        if self.collected_info.to_dict():
            context_parts.append(f"[Already collected: {json.dumps(self.collected_info.to_dict())}]")
        
        # Add what we were asking about
        if self.last_question_topic:
            context_parts.append(f"[Last asked about: {self.last_question_topic}]")
        
        # Add intent context
        if self.intent and self.intent != IntentType.UNKNOWN:
            context_parts.append(f"[Caller intent: {self.intent.value}]")
        
        # Add the actual input
        if context_parts:
            return f"{' '.join(context_parts)}\nCaller says: \"{user_input}\""
        return user_input
    
    def _extract_info_from_response(self, user_input: str, ai_response: str):
        """
        Extract and store information from the conversation.
        Uses pattern matching and context to understand short answers.
        """
        input_lower = user_input.lower().strip()
        
        # If we asked for name and got a short response, it's probably a name
        if self.last_question_topic == "name":
            # Clean up spelled names: "J O E" -> "Joe"
            if re.match(r'^[a-z](\s+[a-z])+$', input_lower, re.IGNORECASE):
                name = ''.join(input_lower.split()).title()
                self.collected_info.patient_name = name
                logger.info(f"📝 Extracted name (from spelling): {name}")
            elif len(input_lower.split()) <= 4 and not any(w in input_lower for w in ["my", "is", "it's", "i'm"]):
                # Short response that's likely just a name
                name = user_input.strip().title()
                self.collected_info.patient_name = name
                logger.info(f"📝 Extracted name: {name}")
            elif "my name is" in input_lower or "i'm" in input_lower or "i am" in input_lower:
                # Extract name from "My name is X" pattern
                patterns = [r"my name is (.+)", r"i'm (.+)", r"i am (.+)", r"it's (.+)"]
                for pattern in patterns:
                    match = re.search(pattern, input_lower)
                    if match:
                        name = match.group(1).strip().title()
                        # Remove trailing punctuation
                        name = re.sub(r'[.,!?]+$', '', name)
                        self.collected_info.patient_name = name
                        logger.info(f"📝 Extracted name: {name}")
                        break
        
        # If we asked for DOB
        elif self.last_question_topic == "date_of_birth":
            # Look for date patterns
            date_patterns = [
                r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})',  # MM/DD/YYYY
                r'(\w+)\s+(\d{1,2}),?\s*(\d{4})',  # Month DD, YYYY
                r'(\d{1,2})\s+(\w+)\s+(\d{4})',  # DD Month YYYY
            ]
            for pattern in date_patterns:
                match = re.search(pattern, user_input, re.IGNORECASE)
                if match:
                    self.collected_info.patient_dob = user_input.strip()
                    logger.info(f"📝 Extracted DOB: {user_input.strip()}")
                    break
        
        # If we asked for reason for visit
        elif self.last_question_topic == "reason":
            # Most inputs here are the reason
            reason = user_input.strip()
            # Clean up common prefixes
            for prefix in ["the reason is", "i have", "i need", "for", "because"]:
                if reason.lower().startswith(prefix):
                    reason = reason[len(prefix):].strip()
            if reason:
                self.collected_info.reason_for_visit = reason
                logger.info(f"📝 Extracted reason: {reason}")
        
        # If we asked for preferred date
        elif self.last_question_topic == "preferred_date":
            # Store the date preference as stated
            self.collected_info.preferred_date = user_input.strip()
            logger.info(f"📝 Extracted preferred date: {user_input.strip()}")
        
        # Update last question topic based on AI response
        response_lower = ai_response.lower()
        if "name" in response_lower and ("what" in response_lower or "your" in response_lower):
            self.last_question_topic = "name"
        elif "date of birth" in response_lower or "dob" in response_lower or "birthday" in response_lower:
            self.last_question_topic = "date_of_birth"
        elif "reason" in response_lower and ("visit" in response_lower or "coming in" in response_lower):
            self.last_question_topic = "reason"
        elif "when" in response_lower or "date" in response_lower or "time" in response_lower:
            if "birth" not in response_lower:
                self.last_question_topic = "preferred_date"
        elif "phone" in response_lower or "contact" in response_lower:
            self.last_question_topic = "phone"
        elif "medication" in response_lower or "prescription" in response_lower:
            self.last_question_topic = "medication"
        elif "pharmacy" in response_lower:
            self.last_question_topic = "pharmacy"
        elif "insurance" in response_lower:
            self.last_question_topic = "insurance"
    
    def _detect_intent(self, user_input: str) -> IntentType:
        """Detect caller intent from their message"""
        input_lower = user_input.lower()
        
        if any(w in input_lower for w in ["schedule", "appointment", "book", "see doctor", "come in"]):
            return IntentType.SCHEDULE_APPOINTMENT
        elif any(w in input_lower for w in ["prescription", "refill", "medication", "medicine", "rx"]):
            return IntentType.PRESCRIPTION_REFILL
        elif any(w in input_lower for w in ["insurance", "coverage", "accept", "in network"]):
            return IntentType.INSURANCE_QUESTION
        elif any(w in input_lower for w in ["bill", "billing", "payment", "charge", "cost"]):
            return IntentType.BILLING
        elif any(w in input_lower for w in ["speak to", "talk to", "human", "person", "representative", "transfer"]):
            return IntentType.TRANSFER_HUMAN
        
        return IntentType.UNKNOWN
    
    async def generate_response(self, user_input: str) -> str:
        """
        Generate AI response using direct LLM call with context enrichment.
        Much more reliable than tool-calling agent for conversational AI.
        """
        try:
            logger.info(f"🎤 User: {user_input}")
            
            # Check for emergency
            if self._is_emergency(user_input):
                return (
                    "This sounds like it could be a medical emergency. "
                    "Please hang up and call 911 immediately, or go to your nearest emergency room."
                )
            
            # Handle very short input
            if len(user_input.strip()) < 2:
                return "I didn't catch that. Could you please repeat that?"
            
            # Detect intent if not yet known
            if self.intent is None or self.intent == IntentType.UNKNOWN:
                detected = self._detect_intent(user_input)
                if detected != IntentType.UNKNOWN:
                    self.intent = detected
                    self.state = WorkflowState.COLLECTING_INFO
                    logger.info(f"🎯 Detected intent: {self.intent.value}")
            
            # Build context-enriched input
            enriched_input = self._build_context_prefix(user_input)
            
            # Build messages for LLM
            messages = self._build_messages(enriched_input, user_input)
            
            # Call LLM
            response = await self.llm.ainvoke(messages)
            ai_response = response.content.strip()
            
            # Handle empty response
            if not ai_response:
                ai_response = self._get_contextual_fallback()
            
            # Extract information from the exchange
            self._extract_info_from_response(user_input, ai_response)
            
            # Store in history
            self.conversation_history.append({"role": "user", "content": user_input})
            self.conversation_history.append({"role": "assistant", "content": ai_response})
            
            # Ensure response is brief
            if len(ai_response) > 300:
                sentences = ai_response.split('. ')
                ai_response = '. '.join(sentences[:2])
                if not ai_response.endswith('.'):
                    ai_response += '.'
            
            logger.info(f"🤖 Agent: {ai_response}")
            return ai_response
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I'm sorry, I'm having a little trouble. Could you repeat that?"
    
    def _build_messages(self, enriched_input: str, original_input: str) -> List:
        """Build the message list for LLM call"""
        # Get system prompt
        system_prompt = get_conversational_system_prompt(
            hospital_name=self.context.hospital_name,
            intent=self.intent.value if self.intent else None,
            collected_info=self.collected_info.to_dict(),
            last_question=self.last_question_topic,
        )
        
        messages = [SystemMessage(content=system_prompt)]
        
        # Add conversation history (last 10 messages for context)
        for msg in self.conversation_history[-10:]:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
        
        # Add current input with context hints
        messages.append(HumanMessage(content=enriched_input))
        
        return messages
    
    def _get_contextual_fallback(self) -> str:
        """Get a contextual fallback response based on conversation state"""
        if self.last_question_topic == "name":
            return "I'm sorry, I had trouble with that. Could you say your name again slowly?"
        elif self.last_question_topic == "date_of_birth":
            return "I didn't catch that. What's your date of birth? Month, day, and year please."
        elif self.last_question_topic == "reason":
            return "Could you tell me more about why you need to come in?"
        elif self.last_question_topic == "preferred_date":
            return "What date works best for you?"
        else:
            return "I'm sorry, could you repeat that?"
    
    def _is_emergency(self, text: str) -> bool:
        """Check for emergency keywords"""
        emergency_keywords = [
            "chest pain", "can't breathe", "difficulty breathing",
            "stroke", "heart attack", "severe bleeding", "unconscious",
            "not breathing", "overdose", "suicide", "kill myself",
            "severe pain", "allergic reaction", "anaphylaxis"
        ]
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in emergency_keywords)


class ConversationAgentManager:
    """Manages ConversationAgent instances for multiple calls"""
    
    def __init__(self):
        self._agents: Dict[str, ConversationAgent] = {}
    
    def get_or_create_agent(self, context: CallContext) -> ConversationAgent:
        """Get existing agent or create new one"""
        if context.call_sid not in self._agents:
            logger.info(f"Creating new conversation agent for call {context.call_sid}")
            self._agents[context.call_sid] = ConversationAgent(context)
        return self._agents[context.call_sid]
    
    def remove_agent(self, call_sid: str):
        """Remove agent when call ends"""
        if call_sid in self._agents:
            logger.info(f"Removing conversation agent for {call_sid}")
            del self._agents[call_sid]
    
    def get_active_count(self) -> int:
        """Get number of active agents"""
        return len(self._agents)


# Singleton instance
conversation_agent_manager = ConversationAgentManager()
