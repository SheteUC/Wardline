"""
LangChain tools agent for Wardline Voice AI (legacy / optional).

Uses LangGraph ReAct agent with the 5 pre-built tools.
Kept for compatibility; prefer ConversationAgent or AzureAIFoundryAgent.
"""
import asyncio
from typing import Dict, List, Any, Optional
from loguru import logger

from call_context import CallContext, CallState, IntentType
from config import settings


class LangChainToolsAgent:
    """
    LangChain/LangGraph ReAct agent with tool bindings.
    Uses Azure OpenAI as the LLM backbone.
    """

    def __init__(self, context: CallContext):
        self.context = context
        self._agent = None
        self._initialized = False

    def _build_tools(self) -> List[Any]:
        """Build LangChain tool wrappers around the 5 core tools."""
        from langchain_core.tools import tool as lc_tool

        context = self.context  # capture for closures

        @lc_tool
        async def check_insurance(carrier_name: str, plan_name: str = "") -> str:
            """Check whether an insurance carrier/plan is accepted by the practice."""
            from tools import check_insurance as _fn
            result = await _fn(context, carrier_name=carrier_name, plan_name=plan_name)
            return str(result)

        @lc_tool
        async def schedule_appointment(
            patient_name: str,
            patient_phone: str,
            service_type: str,
            preferred_date: str = "",
        ) -> str:
            """Schedule a new appointment for a patient."""
            from tools import schedule_appointment as _fn
            result = await _fn(
                context,
                patient_name=patient_name,
                patient_phone=patient_phone,
                service_type=service_type,
                preferred_date=preferred_date,
            )
            return str(result)

        @lc_tool
        async def request_prescription_refill(
            patient_name: str,
            patient_phone: str,
            medication_name: str,
            pharmacy_name: str = "",
            pharmacy_phone: str = "",
        ) -> str:
            """Submit a prescription refill request."""
            from tools import request_prescription_refill as _fn
            result = await _fn(
                context,
                patient_name=patient_name,
                patient_phone=patient_phone,
                medication_name=medication_name,
                pharmacy_name=pharmacy_name,
                pharmacy_phone=pharmacy_phone,
            )
            return str(result)

        @lc_tool
        async def lookup_department(service_type: str) -> str:
            """Find a practice department by service type."""
            from tools import lookup_department as _fn
            result = await _fn(context, service_type=service_type)
            return str(result)

        @lc_tool
        async def transfer_to_human(reason: str, specialization: str = "general") -> str:
            """Transfer the caller to a human agent."""
            from tools import transfer_to_human as _fn
            result = await _fn(context, reason=reason, specialization=specialization)
            context.state = CallState.TRANSFERRING
            context.detected_intent = IntentType.TRANSFER_TO_HUMAN
            return str(result)

        return [
            check_insurance,
            schedule_appointment,
            request_prescription_refill,
            lookup_department,
            transfer_to_human,
        ]

    async def _ensure_initialized(self):
        if self._initialized:
            return

        try:
            from langchain_openai import AzureChatOpenAI
            from langgraph.prebuilt import create_react_agent
            from prompts import get_system_prompt

            llm = AzureChatOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                azure_deployment=settings.azure_openai_deployment,
                api_key=settings.azure_openai_key,
                api_version=settings.azure_openai_api_version,
                temperature=0.7,
                max_tokens=300,
            )

            tools = self._build_tools()
            system_prompt = get_system_prompt(
                business_name=self.context.business_name,
                intents=self.context.intents,
                departments=self.context.departments,
            )

            self._agent = create_react_agent(llm, tools, state_modifier=system_prompt)
            self._initialized = True
            logger.info(f"LangChainToolsAgent initialized for call {self.context.call_sid}")

        except Exception as e:
            logger.error(f"LangChainToolsAgent init failed: {e}")
            raise

    async def generate_response(self, user_message: str) -> str:
        """Generate a response using the LangGraph ReAct agent."""
        try:
            await self._ensure_initialized()

            result = await self._agent.ainvoke(
                {"messages": [{"role": "user", "content": user_message}]}
            )
            messages = result.get("messages", [])
            for msg in reversed(messages):
                if hasattr(msg, "content") and msg.content:
                    role = getattr(msg, "type", "") or getattr(msg, "role", "")
                    if role in ("ai", "assistant"):
                        return msg.content

            return "I'm sorry, I didn't get a response. Could you repeat that?"

        except Exception as e:
            logger.error(f"LangChainToolsAgent error: {e}")
            # Graceful fallback
            from conversation_agent import ConversationAgent
            from prompts import get_system_prompt
            fallback = ConversationAgent(
                self.context,
                get_system_prompt(
                    business_name=self.context.business_name,
                    intents=self.context.intents,
                    departments=self.context.departments,
                ),
            )
            return await fallback.generate_response(user_message)

    def update_context(self):
        """No-op — context is updated via tool calls."""
        pass


class AgentManager:
    """Manages one LangChainToolsAgent per active call."""

    def __init__(self):
        self._agents: Dict[str, LangChainToolsAgent] = {}

    def get_or_create_agent(self, context: CallContext) -> LangChainToolsAgent:
        if context.call_sid not in self._agents:
            self._agents[context.call_sid] = LangChainToolsAgent(context)
            logger.info(f"Created LangChainToolsAgent for call {context.call_sid}")
        return self._agents[context.call_sid]

    def remove_agent(self, call_sid: str):
        if call_sid in self._agents:
            del self._agents[call_sid]
            logger.info(f"Removed LangChainToolsAgent for call {call_sid}")

    def update_config(self, call_sid: str, new_config: dict):
        """Update agent config mid-call (re-initializes on next turn)."""
        agent = self._agents.get(call_sid)
        if agent and "systemPrompt" in new_config:
            # Store updated prompt; agent will rebuild on next _ensure_initialized
            agent._initialized = False
            agent.context.active_persona = new_config.get("persona")
            logger.info(f"Scheduled LangChainToolsAgent reconfigure for {call_sid}")


# Module-level singleton
agent_manager = AgentManager()
