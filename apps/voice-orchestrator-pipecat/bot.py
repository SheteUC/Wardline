"""
Pipecat Voice Bot for Wardline Medical Center
Real-time voice AI with low latency
"""
import asyncio
import json
from typing import Optional
from loguru import logger

from pipecat.frames.frames import (
    Frame,
    TextFrame,
    TranscriptionFrame,
    LLMMessagesFrame,
    EndFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.processors.aggregators.llm_response import LLMResponseAggregator
from pipecat.processors.aggregators.sentence import SentenceAggregator
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.azure import AzureLLMService, AzureTTSService
from pipecat.services.openai import OpenAILLMService
from pipecat.transports.network.websocket_server import WebSocketServerTransport
from pipecat.transports.services.daily import DailyTransport

from config import settings
from call_context import CallContext, CallState, IntentType, context_manager
from core_api_client import api_client
from prompts import get_system_prompt, get_greeting_prompt


class ConversationProcessor(FrameProcessor):
    """
    Custom processor to handle conversation logic:
    - Track conversation history
    - Detect intents and emergencies
    - Handle escalation
    - Analyze sentiment
    """
    
    def __init__(self, context: CallContext):
        super().__init__()
        self.context = context
        self._emergency_keywords = [
            "chest pain", "can't breathe", "difficulty breathing",
            "stroke", "heart attack", "bleeding", "unconscious",
            "not breathing", "overdose", "suicide", "kill myself",
            "severe pain", "allergic reaction", "anaphylaxis"
        ]
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process frames in the pipeline"""
        await super().process_frame(frame, direction)
        
        # Handle transcription from user
        if isinstance(frame, TranscriptionFrame):
            text = frame.text.strip()
            if text:
                logger.info(f"🎤 User said: {text}")
                self.context.add_user_message(text)
                
                # Check for emergency
                if self._check_emergency(text):
                    self.context.is_emergency = True
                    self.context.state = CallState.ESCALATING
                    logger.warning(f"🚨 Emergency detected: {text}")
        
        # Handle assistant response
        if isinstance(frame, TextFrame):
            text = frame.text.strip()
            if text and len(text) > 10:  # Filter out partial responses
                logger.info(f"🤖 Assistant: {text[:100]}...")
                self.context.add_assistant_message(text)
        
        await self.push_frame(frame, direction)
    
    def _check_emergency(self, text: str) -> bool:
        """Check if text contains emergency keywords"""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self._emergency_keywords)


class SentimentAnalyzer(FrameProcessor):
    """
    Analyze conversation sentiment periodically
    """
    
    def __init__(self, context: CallContext, llm_service):
        super().__init__()
        self.context = context
        self.llm = llm_service
        self._turn_count = 0
        self._analyze_every_n_turns = 3
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        
        # Count conversation turns
        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            self._turn_count += 1
            
            # Analyze sentiment every N turns
            if self._turn_count % self._analyze_every_n_turns == 0:
                asyncio.create_task(self._analyze_sentiment())
        
        await self.push_frame(frame, direction)
    
    async def _analyze_sentiment(self):
        """Run sentiment analysis in background"""
        try:
            conversation = self.context.get_conversation_text(last_n=6)
            if not conversation:
                return
            
            # Simple heuristic-based sentiment for now
            # In production, use LLM for more accurate analysis
            text_lower = conversation.lower()
            
            # Frustration indicators
            frustration_words = ["frustrated", "angry", "upset", "ridiculous", 
                               "unacceptable", "terrible", "worst", "hate", "stupid"]
            frustration = sum(1 for word in frustration_words if word in text_lower) / 10
            self.context.sentiment.frustration_level = min(frustration, 1.0)
            
            # Urgency indicators
            urgency_words = ["urgent", "emergency", "immediately", "asap", 
                          "right now", "can't wait", "hurry"]
            urgency = sum(1 for word in urgency_words if word in text_lower) / 5
            self.context.sentiment.urgency_level = min(urgency, 1.0)
            
            # Check if escalation needed
            self.context.sentiment.escalation_needed = (
                self.context.sentiment.frustration_level > 0.6 or
                self.context.sentiment.urgency_level > 0.8 or
                "speak to a human" in text_lower or
                "talk to someone" in text_lower or
                "real person" in text_lower
            )
            
            logger.debug(f"Sentiment: frustration={self.context.sentiment.frustration_level:.2f}, "
                        f"urgency={self.context.sentiment.urgency_level:.2f}, "
                        f"escalate={self.context.sentiment.escalation_needed}")
            
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")


async def create_bot_pipeline(
    context: CallContext,
    transport,
) -> Pipeline:
    """
    Create the Pipecat pipeline for voice conversation
    """
    
    # Load hospital data
    if context.hospital_id:
        hospital = await api_client.get_hospital(context.hospital_id)
        if hospital:
            context.hospital_name = hospital.get("name", context.hospital_name)
        
        context.intents = await api_client.get_intents(context.hospital_id)
        context.departments = await api_client.get_departments(context.hospital_id)
    
    # Generate system prompt
    system_prompt = get_system_prompt(
        hospital_name=context.hospital_name,
        intents=context.intents,
        departments=context.departments
    )
    
    # Initial greeting
    greeting = get_greeting_prompt(context.hospital_name)
    
    # Initialize Azure OpenAI LLM
    llm = OpenAILLMService(
        api_key=settings.azure_openai_key,
        base_url=f"{settings.azure_openai_endpoint}/openai/deployments/{settings.azure_openai_deployment}",
        model=settings.azure_openai_deployment,
        params={
            "extra_headers": {"api-key": settings.azure_openai_key},
            "extra_query": {"api-version": settings.azure_openai_api_version}
        }
    )
    
    # Initialize Azure TTS
    tts = AzureTTSService(
        api_key=settings.azure_speech_key,
        region=settings.azure_speech_region,
        voice=settings.tts_voice,
    )
    
    # Create processors
    conversation_processor = ConversationProcessor(context)
    sentiment_analyzer = SentimentAnalyzer(context, llm)
    sentence_aggregator = SentenceAggregator()
    llm_response_aggregator = LLMResponseAggregator()
    
    # Initial messages for LLM
    initial_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "assistant", "content": greeting},
    ]
    
    # Build pipeline
    pipeline = Pipeline([
        transport.input(),           # Audio from caller
        conversation_processor,       # Track conversation
        sentiment_analyzer,           # Analyze sentiment
        llm,                          # Generate response
        sentence_aggregator,          # Aggregate sentences
        tts,                          # Convert to speech
        transport.output(),           # Audio to caller
    ])
    
    return pipeline, initial_messages


async def run_bot(
    call_sid: str,
    caller_phone: str,
    to_phone: str,
    hospital_id: str = "",
    websocket=None,
):
    """
    Run the voice bot for a call
    """
    logger.info(f"🤖 Starting bot for call {call_sid}")
    
    # Create call context
    context = context_manager.create_context(
        call_sid=call_sid,
        caller_phone=caller_phone,
        to_phone=to_phone,
        hospital_id=hospital_id,
    )
    context.state = CallState.GREETING
    
    try:
        # For now, we'll use a simple WebSocket transport
        # In production, use Twilio's Media Streams or Daily.co
        transport = WebSocketServerTransport(
            host=settings.host,
            port=settings.port + 1,  # Separate port for WebSocket
        )
        
        pipeline, initial_messages = await create_bot_pipeline(context, transport)
        
        # Create and run pipeline task
        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,  # Allow barge-in
                enable_metrics=True,
            )
        )
        
        runner = PipelineRunner()
        
        # Queue initial greeting
        await task.queue_frames([
            LLMMessagesFrame(initial_messages)
        ])
        
        # Run the pipeline
        await runner.run(task)
        
    except Exception as e:
        logger.error(f"Bot error: {e}")
        raise
    finally:
        context.state = CallState.COMPLETED
        context.ended_at = datetime.now()
        logger.info(f"🏁 Call {call_sid} completed")


# For testing without Twilio
async def test_bot():
    """Test the bot with console input/output"""
    from datetime import datetime
    
    context = CallContext(
        call_sid="test-call-123",
        caller_phone="+15551234567",
        hospital_name="Wardline Medical Center",
    )
    
    # Simple test loop
    print(f"\n🏥 {context.hospital_name} AI Receptionist")
    print("=" * 50)
    print(get_greeting_prompt(context.hospital_name))
    print()
    
    while True:
        try:
            user_input = input("You: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["quit", "exit", "bye"]:
                print("\nAssistant: Thank you for calling. Goodbye!")
                break
            
            context.add_user_message(user_input)
            
            # Simple echo for testing
            print(f"\nAssistant: I heard you say: '{user_input}'. How else can I help?")
            print()
            
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    asyncio.run(test_bot())

