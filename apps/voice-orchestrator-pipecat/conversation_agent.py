"""
Conversational AI agent using Azure OpenAI directly.

This is the default / fallback agent when Azure AI Foundry is not configured.
It maintains per-call conversation history and supports function calling for
the 5 pre-built tools (insurance, scheduling, prescriptions, departments, transfer).
"""
import asyncio
import json
from typing import Dict, List, Any, Optional
from loguru import logger

from openai import AsyncAzureOpenAI
from config import settings
from call_context import CallContext, CallState, IntentType


class ConversationAgent:
    """
    Single-call conversational agent backed by Azure OpenAI.
    Maintains message history and supports tool calling.
    """

    # Tool definitions for Azure OpenAI function calling
    TOOLS: List[Dict[str, Any]] = [
        {
            "type": "function",
            "function": {
                "name": "check_insurance",
                "description": "Check whether a given insurance carrier/plan is accepted by the hospital.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "carrier_name": {
                            "type": "string",
                            "description": "Name of the insurance carrier (e.g. 'Blue Cross', 'Aetna')",
                        },
                        "plan_name": {
                            "type": "string",
                            "description": "Name of the specific plan (optional)",
                        },
                    },
                    "required": ["carrier_name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "schedule_appointment",
                "description": "Schedule a new appointment for a patient.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_name": {"type": "string"},
                        "patient_phone": {"type": "string"},
                        "service_type": {
                            "type": "string",
                            "description": "Type of appointment (e.g. 'Consultation', 'Follow-up', 'Annual Exam')",
                        },
                        "preferred_date": {
                            "type": "string",
                            "description": "Preferred date/time in plain language (e.g. 'next Tuesday morning')",
                        },
                    },
                    "required": ["patient_name", "patient_phone", "service_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "request_prescription_refill",
                "description": "Submit a prescription refill request on behalf of the patient.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_name": {"type": "string"},
                        "patient_phone": {"type": "string"},
                        "medication_name": {"type": "string"},
                        "pharmacy_name": {"type": "string"},
                        "pharmacy_phone": {"type": "string"},
                    },
                    "required": ["patient_name", "patient_phone", "medication_name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "lookup_department",
                "description": "Find the contact information for a hospital department by service type.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "service_type": {
                            "type": "string",
                            "description": "The type of service or department name (e.g. 'Radiology', 'Cardiology')",
                        },
                    },
                    "required": ["service_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "transfer_to_human",
                "description": "Escalate or transfer the caller to a human agent or clinical staff.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "Reason for transfer (e.g. 'clinical question', 'patient request', 'complex billing')",
                        },
                        "specialization": {
                            "type": "string",
                            "description": "Required specialization queue (e.g. 'clinical', 'billing', 'scheduling', 'general')",
                        },
                    },
                    "required": ["reason"],
                },
            },
        },
    ]

    def __init__(self, context: CallContext, system_prompt: str):
        self.context = context
        self.system_prompt = system_prompt
        self.messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt}
        ]
        self._client = AsyncAzureOpenAI(
            api_key=settings.azure_openai_key,
            azure_endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
        )

    async def generate_response(self, user_message: str) -> str:
        """
        Generate an AI response for the user's message.
        Handles tool calls transparently.
        """
        self.messages.append({"role": "user", "content": user_message})

        try:
            response = await self._client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=self.messages,
                tools=self.TOOLS,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=300,
            )

            message = response.choices[0].message

            # Handle tool calls
            if message.tool_calls:
                self.messages.append(message.model_dump(exclude_unset=True))
                for tool_call in message.tool_calls:
                    tool_result = await self._execute_tool(
                        tool_call.function.name,
                        json.loads(tool_call.function.arguments),
                    )
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(tool_result),
                    })

                # Get follow-up response after tool results
                follow_up = await self._client.chat.completions.create(
                    model=settings.azure_openai_deployment,
                    messages=self.messages,
                    temperature=0.7,
                    max_tokens=300,
                )
                reply = follow_up.choices[0].message.content or ""
            else:
                reply = message.content or ""

            self.messages.append({"role": "assistant", "content": reply})
            return reply

        except Exception as e:
            logger.error(f"ConversationAgent error: {e}")
            return "I'm sorry, I'm having a brief technical issue. Could you please repeat that?"

    async def _execute_tool(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatch tool call to the tools module."""
        try:
            from tools import (
                check_insurance,
                schedule_appointment,
                request_prescription_refill,
                lookup_department,
                transfer_to_human,
            )

            if name == "check_insurance":
                return await check_insurance(self.context, **args)
            elif name == "schedule_appointment":
                return await schedule_appointment(self.context, **args)
            elif name == "request_prescription_refill":
                return await request_prescription_refill(self.context, **args)
            elif name == "lookup_department":
                return await lookup_department(self.context, **args)
            elif name == "transfer_to_human":
                result = await transfer_to_human(self.context, **args)
                # Update call state so the voice flow knows to hand off
                self.context.state = CallState.TRANSFERRING
                self.context.detected_intent = IntentType.TRANSFER_TO_HUMAN
                return result
            else:
                return {"error": f"Unknown tool: {name}"}
        except Exception as e:
            logger.error(f"Tool '{name}' failed: {e}")
            return {"error": str(e)}


class ConversationAgentManager:
    """Manages one ConversationAgent per active call."""

    def __init__(self):
        self._agents: Dict[str, ConversationAgent] = {}

    def get_or_create_agent(self, context: CallContext) -> ConversationAgent:
        if context.call_sid not in self._agents:
            from prompts import get_system_prompt
            system_prompt = get_system_prompt(
                hospital_name=context.hospital_name,
                intents=context.intents,
                departments=context.departments,
            )
            self._agents[context.call_sid] = ConversationAgent(context, system_prompt)
            logger.info(f"Created ConversationAgent for call {context.call_sid}")
        return self._agents[context.call_sid]

    def remove_agent(self, call_sid: str):
        if call_sid in self._agents:
            del self._agents[call_sid]
            logger.info(f"Removed ConversationAgent for call {call_sid}")


# Module-level singleton
conversation_agent_manager = ConversationAgentManager()
