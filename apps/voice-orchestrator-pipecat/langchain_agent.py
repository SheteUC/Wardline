"""
LangChain Agent Setup for Voice AI
Manages LLM agent with memory and tools
"""
from typing import Optional, Dict, Any
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.memory import ConversationBufferMemory
from langchain_openai import AzureChatOpenAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema import SystemMessage, HumanMessage, AIMessage
from loguru import logger

from config import settings
from call_context import CallContext
from langchain_tools import create_agent_tools
from prompts import get_system_prompt


class VoiceAgent:
    """
    LangChain-powered voice agent with memory and tools
    """
    
    def __init__(self, context: CallContext):
        self.context = context
        self.memory = self._create_memory()
        self.llm = self._create_llm()
        self.tools = create_agent_tools(context)
        self.agent_executor = self._create_agent()
    
    def _create_memory(self) -> ConversationBufferMemory:
        """
        Create conversation memory for context retention
        """
        memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            output_key="output",
            input_key="input",
        )
        
        # Initialize with existing conversation history from context
        if self.context.conversation_history:
            for turn in self.context.conversation_history:
                if turn.role == "user":
                    memory.chat_memory.add_user_message(turn.content)
                elif turn.role == "assistant":
                    memory.chat_memory.add_ai_message(turn.content)
        
        logger.debug(f"Memory initialized with {len(self.context.conversation_history)} messages")
        return memory
    
    def _create_llm(self) -> AzureChatOpenAI:
        """
        Create Azure OpenAI LLM instance
        """
        return AzureChatOpenAI(
            api_key=settings.azure_openai_key,
            api_version=settings.azure_openai_api_version,
            azure_endpoint=settings.azure_openai_endpoint,
            deployment_name=settings.azure_openai_deployment,
            # Note: o4-mini doesn't support custom temperature, uses default (1)
            model_kwargs={
                "max_completion_tokens": 250  # Allow slightly longer for clarification questions
            }
        )
    
    def _create_agent(self) -> AgentExecutor:
        """
        Create the LangChain agent with tools
        """
        # Build system prompt
        system_prompt = get_system_prompt(
            hospital_name=self.context.hospital_name,
            intents=self.context.intents,
            departments=self.context.departments,
        )
        
        # Create prompt template with memory placeholder
        # CRITICAL: The agent_scratchpad must come BEFORE the final instruction
        # to ensure the model generates a response even when no tools are needed
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
            ("system", "Remember to always respond to the caller. If you don't need to use any tools, just respond directly in a friendly, conversational way."),
        ])
        
        # Create agent
        agent = create_openai_tools_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt,
        )
        
        # Create agent executor with early stopping to ensure we get a response
        agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=self.memory,
            verbose=True,  # Enable logging
            max_iterations=3,  # Limit iterations to prevent long waits on phone
            max_execution_time=10,  # 10 seconds max for phone responsiveness
            return_intermediate_steps=False,
            handle_parsing_errors=True,
            early_stopping_method="generate",  # Force final answer generation
        )
        
        logger.info(f"Agent created with {len(self.tools)} tools")
        return agent_executor
    
    async def generate_response(self, user_input: str) -> str:
        """
        Generate AI response using LangChain agent
        
        Args:
            user_input: The user's message
            
        Returns:
            The agent's response
        """
        try:
            logger.info(f"🎤 User: {user_input}")
            
            # Check for emergency first (bypass agent for safety)
            if self._is_emergency(user_input):
                emergency_response = (
                    "This sounds like it could be a medical emergency. "
                    "Please hang up and call 911 immediately, or go to your nearest emergency room."
                )
                self.context.is_emergency = True
                logger.warning("🚨 Emergency detected - bypassing agent")
                return emergency_response
            
            # Handle very short or unclear input
            if len(user_input.strip()) < 3:
                logger.warning(f"Input too short: '{user_input}'")
                return "I didn't catch that. Could you please repeat that?"
            
            # Run agent with tools
            result = await self.agent_executor.ainvoke({
                "input": user_input
            })
            
            response = result.get("output", "")
            
            # Handle empty response - this happens when LLM is confused
            if not response or not response.strip():
                logger.warning("Empty response from agent, providing fallback")
                # Check if we were asking for a name
                last_messages = self.memory.chat_memory.messages[-2:]
                context_hint = " ".join([m.content for m in last_messages if hasattr(m, 'content')])
                
                if "name" in context_hint.lower():
                    return "I'm sorry, I had trouble understanding that. Could you spell your name for me, one letter at a time?"
                elif "date" in context_hint.lower() or "when" in context_hint.lower():
                    return "I didn't catch that date. What month, day, and year would work for you?"
                elif "medication" in context_hint.lower() or "prescription" in context_hint.lower():
                    return "Could you spell the medication name for me please?"
                else:
                    return "I'm sorry, I didn't quite catch that. Could you please repeat what you said?"
            
            # Ensure response is brief for phone calls
            if len(response) > 300:
                # Truncate at sentence boundary
                sentences = response.split('. ')
                response = '. '.join(sentences[:2])
                if not response.endswith('.'):
                    response += '.'
            
            logger.info(f"🤖 Agent: {response}")
            return response
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I'm sorry, I'm having a little trouble right now. Could you please repeat that?"
    
    def _is_emergency(self, text: str) -> bool:
        """
        Check for emergency keywords
        """
        emergency_keywords = [
            "chest pain", "can't breathe", "difficulty breathing",
            "stroke", "heart attack", "severe bleeding", "unconscious",
            "not breathing", "overdose", "suicide", "kill myself",
            "severe pain", "allergic reaction", "anaphylaxis"
        ]
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in emergency_keywords)
    
    def update_context(self):
        """
        Sync LangChain memory back to CallContext
        """
        # Extract conversation from memory
        messages = self.memory.chat_memory.messages
        
        # Update context with any new messages
        for msg in messages[len(self.context.conversation_history):]:
            if isinstance(msg, HumanMessage):
                self.context.add_user_message(msg.content)
            elif isinstance(msg, AIMessage):
                self.context.add_assistant_message(msg.content)
    
    def get_conversation_summary(self) -> str:
        """
        Get a summary of the conversation for handoff to human agent
        """
        try:
            # Get recent conversation
            recent_messages = self.memory.chat_memory.messages[-10:]
            conversation_text = "\n".join([
                f"{'User' if isinstance(m, HumanMessage) else 'AI'}: {m.content}"
                for m in recent_messages
            ])
            
            # Generate summary
            summary_prompt = f"""Summarize this call conversation in 2-3 bullet points for handoff to a human agent:

{conversation_text}

Summary:"""
            
            summary_response = self.llm.invoke([
                HumanMessage(content=summary_prompt)
            ])
            
            return summary_response.content
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return "Call summary unavailable"


class AgentManager:
    """
    Manages VoiceAgent instances for multiple calls
    """
    
    def __init__(self):
        self._agents: Dict[str, VoiceAgent] = {}
    
    def get_or_create_agent(self, context: CallContext) -> VoiceAgent:
        """
        Get existing agent or create new one for a call
        """
        if context.call_sid not in self._agents:
            logger.info(f"Creating new agent for call {context.call_sid}")
            self._agents[context.call_sid] = VoiceAgent(context)
        
        return self._agents[context.call_sid]
    
    def remove_agent(self, call_sid: str):
        """
        Remove agent when call ends
        """
        if call_sid in self._agents:
            logger.info(f"Removing agent for call {call_sid}")
            del self._agents[call_sid]
    
    def get_active_count(self) -> int:
        """
        Get number of active agents
        """
        return len(self._agents)


# Singleton instance
agent_manager = AgentManager()
