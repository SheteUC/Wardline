"""
Azure AI Foundry Agent for Voice AI
Uses managed agents from Azure AI Foundry (formerly Azure AI Studio)
"""
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from loguru import logger
import json

from config import settings
from call_context import CallContext


@dataclass
class ConversationTurn:
    """A turn in the conversation"""
    role: str  # "user" or "assistant"
    content: str


class AzureAIFoundryAgent:
    """
    Agent using Azure AI Foundry managed agents.
    More robust and feature-rich than direct OpenAI calls.
    """
    
    def __init__(self, context: CallContext):
        self.context = context
        self.conversation_history: List[ConversationTurn] = []
        self.project_client: Optional[AIProjectClient] = None
        self.agent = None
        self.openai_client = None
        self._initialize_client()
        
    def _initialize_client(self):
        """Initialize Azure AI Foundry client and get agent"""
        try:
            # Parse agent name (might include version like "wardline-agent:2")
            agent_name = settings.azure_ai_agent_name
            logger.info(f"🔧 Initializing Azure AI Foundry agent: {agent_name}")
            logger.info(f"🔧 Using endpoint: {settings.azure_ai_project_endpoint}")
            
            # Create project client with DefaultAzureCredential
            # This works with `az login` for local dev
            self.project_client = AIProjectClient(
                endpoint=settings.azure_ai_project_endpoint,
                credential=DefaultAzureCredential(),
            )
            
            # Get the existing agent by name
            self.agent = self.project_client.agents.get(
                agent_name=agent_name
            )
            logger.info(f"✅ Retrieved agent: {self.agent.name}")
            
            # Get OpenAI client for making requests to the agent
            self.openai_client = self.project_client.get_openai_client()
            logger.info("✅ OpenAI client initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize Azure AI Foundry agent: {e}")
            logger.error(f"Make sure you have run 'az login' and set the correct subscription")
            raise
    
    async def generate_response(self, user_input: str) -> str:
        """
        Generate AI response using Azure AI Foundry agent.
        
        Args:
            user_input: The user's message
            
        Returns:
            The agent's response
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
            
            # Build conversation context
            messages = self._build_messages(user_input)
            
            # Call Azure AI Foundry agent
            response = self.openai_client.responses.create(
                input=messages,
                extra_body={
                    "agent": {
                        "name": self.agent.name,
                        "type": "agent_reference"
                    }
                },
            )
            
            # Extract response text
            ai_response = response.output_text if hasattr(response, 'output_text') else str(response)
            
            # Handle empty response
            if not ai_response or not ai_response.strip():
                ai_response = "I'm sorry, could you repeat that?"
                logger.warning("Empty response from Azure AI Foundry agent")
            
            # Store in history
            self.conversation_history.append(ConversationTurn(role="user", content=user_input))
            self.conversation_history.append(ConversationTurn(role="assistant", content=ai_response))
            
            # Update context
            self.context.add_user_message(user_input)
            self.context.add_assistant_message(ai_response)
            
            # Ensure response is brief for phone calls
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
    
    def _build_messages(self, user_input: str) -> List[Dict[str, str]]:
        """Build message list for API call"""
        messages = []
        
        # Add conversation history (last 10 turns for context)
        for turn in self.conversation_history[-10:]:
            messages.append({
                "role": turn.role,
                "content": turn.content
            })
        
        # Add current input
        messages.append({
            "role": "user",
            "content": user_input
        })
        
        return messages
    
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
    
    def get_conversation_summary(self) -> str:
        """Get a summary of the conversation"""
        try:
            if not self.conversation_history:
                return "No conversation yet"
            
            # Format conversation
            summary_lines = []
            for turn in self.conversation_history:
                prefix = "Caller" if turn.role == "user" else "AI"
                summary_lines.append(f"{prefix}: {turn.content}")
            
            return "\n".join(summary_lines[-10:])  # Last 10 turns
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return "Call summary unavailable"


class AzureAIFoundryAgentManager:
    """Manages Azure AI Foundry agents for multiple calls"""
    
    def __init__(self):
        self._agents: Dict[str, AzureAIFoundryAgent] = {}
    
    def get_or_create_agent(self, context: CallContext) -> AzureAIFoundryAgent:
        """Get existing agent or create new one"""
        if context.call_sid not in self._agents:
            logger.info(f"Creating new Azure AI Foundry agent for call {context.call_sid}")
            self._agents[context.call_sid] = AzureAIFoundryAgent(context)
        return self._agents[context.call_sid]
    
    def remove_agent(self, call_sid: str):
        """Remove agent when call ends"""
        if call_sid in self._agents:
            logger.info(f"Removing Azure AI Foundry agent for {call_sid}")
            del self._agents[call_sid]
    
    def get_active_count(self) -> int:
        """Get number of active agents"""
        return len(self._agents)


# Singleton instance
azure_ai_foundry_agent_manager = AzureAIFoundryAgentManager()
