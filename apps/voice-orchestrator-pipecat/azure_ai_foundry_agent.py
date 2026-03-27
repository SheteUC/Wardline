"""
Azure AI Foundry managed agent for Wardline Voice AI.

Uses the azure-ai-projects SDK to interact with a pre-configured Azure AI
Foundry agent that has built-in tool bindings and memory management.
Falls back gracefully to the ConversationAgent if Foundry is not configured.
"""
import asyncio
from typing import Dict, Optional
from loguru import logger

from call_context import CallContext, CallState, IntentType
from config import settings


class AzureAIFoundryAgent:
    """
    Wrapper around an Azure AI Foundry managed agent thread.
    Each call gets its own thread for isolated conversation history.
    """

    def __init__(self, context: CallContext):
        self.context = context
        self._thread_id: Optional[str] = None
        self._agent_id: Optional[str] = None
        self._client = None
        self._initialized = False

    async def _ensure_initialized(self):
        """Lazy initialization — create the AI Foundry client and thread."""
        if self._initialized:
            return

        try:
            from azure.ai.projects import AIProjectClient
            from azure.identity import DefaultAzureCredential

            if not settings.azure_ai_project_endpoint:
                raise ValueError("AZURE_EXISTING_AIPROJECT_ENDPOINT not set")

            self._client = AIProjectClient(
                endpoint=settings.azure_ai_project_endpoint,
                credential=DefaultAzureCredential(),
            )

            agents_client = self._client.agents

            # Resolve agent — look up by name if an ID is not a bare UUID
            self._agent_id = settings.azure_ai_agent_name
            logger.info(f"Using Azure AI Foundry agent: {self._agent_id}")

            # Create a new thread for this call
            thread = agents_client.create_thread()
            self._thread_id = thread.id
            logger.info(f"Created Foundry thread {self._thread_id} for call {self.context.call_sid}")

            self._initialized = True

        except Exception as e:
            logger.error(f"Azure AI Foundry init failed: {e}")
            raise

    async def generate_response(self, user_message: str) -> str:
        """
        Send a message to the Foundry agent thread and return its response.
        Falls back to ConversationAgent on failure.
        """
        try:
            await self._ensure_initialized()

            agents_client = self._client.agents

            # Add user message to thread
            agents_client.create_message(
                thread_id=self._thread_id,
                role="user",
                content=user_message,
            )

            # Run the agent
            run = agents_client.create_and_process_run(
                thread_id=self._thread_id,
                agent_id=self._agent_id,
            )

            # Retrieve the latest assistant message
            messages = agents_client.list_messages(thread_id=self._thread_id)
            for msg in messages:
                if msg.role == "assistant":
                    content = msg.content
                    if isinstance(content, list):
                        text_parts = [
                            c.text.value for c in content
                            if hasattr(c, "text") and hasattr(c.text, "value")
                        ]
                        return " ".join(text_parts)
                    return str(content)

            return "I'm sorry, I didn't get a response. Could you please repeat that?"

        except Exception as e:
            logger.error(f"AzureAIFoundryAgent error, falling back: {e}")
            # Graceful fallback to conversational agent
            from conversation_agent import ConversationAgent
            from prompts import get_system_prompt
            fallback = ConversationAgent(self.context)
            return await fallback.generate_response(user_message)


class AzureAIFoundryAgentManager:
    """Manages one AzureAIFoundryAgent per active call."""

    def __init__(self):
        self._agents: Dict[str, AzureAIFoundryAgent] = {}

    def get_or_create_agent(self, context: CallContext) -> AzureAIFoundryAgent:
        if context.call_sid not in self._agents:
            self._agents[context.call_sid] = AzureAIFoundryAgent(context)
            logger.info(f"Created AzureAIFoundryAgent for call {context.call_sid}")
        return self._agents[context.call_sid]

    def remove_agent(self, call_sid: str):
        if call_sid in self._agents:
            del self._agents[call_sid]
            logger.info(f"Removed AzureAIFoundryAgent for call {call_sid}")

    def update_config(self, call_sid: str, new_config: dict):
        """Update agent config mid-call (stored in context for next run)."""
        agent = self._agents.get(call_sid)
        if agent:
            # AI Foundry does not support mid-thread prompt injection;
            # store the persona so subsequent messages carry updated context.
            if "persona" in new_config:
                agent.context.active_persona = new_config["persona"]
            logger.info(f"Updated AzureAIFoundryAgent config for {call_sid}")


# Module-level singleton
azure_ai_foundry_agent_manager = AzureAIFoundryAgentManager()
