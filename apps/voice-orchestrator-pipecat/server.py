"""
FastAPI Server for Pipecat Voice Orchestrator
Handles Twilio webhooks and manages voice bot instances
"""
import asyncio
import json
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream, Gather
from loguru import logger

from config import settings
from call_context import context_manager, CallContext, CallState
from core_api_client import api_client
from prompts import get_greeting_prompt, get_system_prompt

# Configure logging
logger.add(
    "logs/voice_orchestrator.log",
    rotation="1 day",
    retention="7 days",
    level="DEBUG"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 Starting Pipecat Voice Orchestrator")
    yield
    logger.info("🛑 Shutting down Voice Orchestrator")
    await api_client.close()


app = FastAPI(
    title="Wardline Voice Orchestrator",
    description="Pipecat-powered voice AI for medical call center",
    version="2.0.0",
    lifespan=lifespan,
)


# =============================================================================
# Health Checks
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "voice-orchestrator-pipecat",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/ready")
async def readiness_check():
    """Readiness check"""
    return {"ready": True}


# =============================================================================
# Twilio Webhooks
# =============================================================================

@app.post("/voice/incoming")
async def handle_incoming_call(request: Request):
    """
    Handle incoming Twilio call
    Returns TwiML to greet caller and connect to WebSocket stream
    """
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    from_number = form_data.get("From", "")
    to_number = form_data.get("To", "")
    
    logger.info(f"📞 Incoming call: {call_sid} from {from_number} to {to_number}")
    
    # Create call context
    context = context_manager.create_context(
        call_sid=call_sid,
        caller_phone=from_number,
        to_phone=to_number,
    )
    
    # Look up hospital by phone number
    try:
        hospital = await api_client.get_hospital_by_phone(to_number)
        if hospital:
            context.hospital_id = hospital.get("id", "")
            context.hospital_name = hospital.get("name", "Wardline Medical Center")
            logger.info(f"Found hospital: {context.hospital_name} ({context.hospital_id})")
            
            context.intents = await api_client.get_intents(context.hospital_id)
            context.departments = await api_client.get_departments(context.hospital_id)
            
            # Create call session in core-api
            call_data = await api_client.create_call_session({
                "twilioCallSid": call_sid,
                "direction": "inbound",
                "fromNumber": from_number,
                "toNumber": to_number,
            })
            if call_data:
                context.call_id = call_data.get("id")
                logger.info(f"Created call session: {context.call_id}")
        else:
            logger.warning(f"No hospital found for phone {to_number}, using defaults")
            context.hospital_name = "Wardline Medical Center"
    except Exception as e:
        logger.warning(f"Could not load hospital data: {e}")
        context.hospital_name = "Wardline Medical Center"
    
    # Generate TwiML response
    response = VoiceResponse()
    
    # Greeting inside gather so it starts listening immediately
    greeting = get_greeting_prompt(context.hospital_name)
    
    gather = Gather(
        input="speech",
        action="/voice/process",
        method="POST",
        speech_timeout="auto",
        speech_model="phone_call",
        enhanced=True,
        language="en-US",
    )
    gather.say(greeting, voice="Polly.Joanna")
    response.append(gather)
    
    # Fallback if no input - prompt again
    response.say(
        "I didn't catch that. How can I help you today?",
        voice="Polly.Joanna"
    )
    response.redirect("/voice/incoming")
    
    return Response(content=str(response), media_type="text/xml")


@app.post("/voice/process")
async def process_speech(request: Request):
    """
    Process speech input from Twilio and generate AI response
    """
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    speech_result = form_data.get("SpeechResult", "")
    confidence = form_data.get("Confidence", "0")
    
    logger.info(f"🎤 Speech from {call_sid}: \"{speech_result}\" (confidence: {confidence})")
    
    # Get call context
    context = context_manager.get_context(call_sid)
    if not context:
        logger.warning(f"No context found for call {call_sid}")
        response = VoiceResponse()
        response.say(
            "I'm sorry, I lost track of our conversation. How can I help you?",
            voice="Polly.Joanna"
        )
        gather = Gather(
            input="speech",
            action="/voice/process",
            method="POST",
            speech_timeout="auto",
        )
        response.append(gather)
        return Response(content=str(response), media_type="text/xml")
    
    # Add user message to context
    context.add_user_message(speech_result)
    
    # Check for emergency keywords
    emergency_keywords = [
        "chest pain", "can't breathe", "difficulty breathing",
        "stroke", "heart attack", "severe bleeding", "unconscious"
    ]
    is_emergency = any(kw in speech_result.lower() for kw in emergency_keywords)
    
    if is_emergency:
        context.is_emergency = True
        context.state = CallState.ESCALATING
        
        response = VoiceResponse()
        response.say(
            "This sounds like it could be a medical emergency. "
            "Please hang up and call 911 immediately, or go to your nearest emergency room. "
            "If you need immediate help, I'm transferring you now.",
            voice="Polly.Joanna"
        )
        # In production, could dial 911 or emergency line
        response.hangup()
        return Response(content=str(response), media_type="text/xml")
    
    # Generate AI response
    ai_response = await generate_ai_response(context, speech_result)
    
    # Add AI response to context
    context.add_assistant_message(ai_response)
    
    # Check if we should escalate based on sentiment/request
    if context.should_escalate():
        response = VoiceResponse()
        response.say(
            f"{ai_response} I'll connect you with a staff member now. Please hold.",
            voice="Polly.Joanna"
        )
        # In production, transfer to call center queue
        # For now, just say goodbye
        response.say(
            "Thank you for holding. A representative will be with you shortly.",
            voice="Polly.Joanna"
        )
        response.pause(length=30)
        response.hangup()
        return Response(content=str(response), media_type="text/xml")
    
    # Normal response - continue conversation
    response = VoiceResponse()
    
    # Continue gathering speech immediately after AI speaks
    # The AI response IS the prompt - no need to add another one
    gather = Gather(
        input="speech",
        action="/voice/process",
        method="POST",
        speech_timeout="auto",
        speech_model="phone_call",
        enhanced=True,
        language="en-US",
    )
    # Say AI response inside gather so it listens immediately after
    gather.say(ai_response, voice="Polly.Joanna")
    response.append(gather)
    
    # If no input after 10 seconds of silence, ask if they're still there
    response.say(
        "Are you still there?",
        voice="Polly.Joanna"
    )
    response.redirect("/voice/incoming")
    
    return Response(content=str(response), media_type="text/xml")


@app.post("/voice/status")
async def call_status(request: Request):
    """Handle call status callbacks"""
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    call_status = form_data.get("CallStatus", "")
    call_duration = form_data.get("CallDuration", "0")
    
    logger.info(f"📊 Call {call_sid}: {call_status} (duration: {call_duration}s)")
    
    if call_status in ["completed", "failed", "busy", "no-answer"]:
        context = context_manager.get_context(call_sid)
        if context:
            context.state = CallState.COMPLETED
            context.ended_at = datetime.now()
            
            # Update call session in core-api
            if context.call_id:
                await api_client.update_call_session(context.call_id, {
                    "status": call_status,
                    "duration": int(call_duration),
                    "detectedIntent": context.detected_intent.value if context.detected_intent else None,
                })
                logger.info(f"Updated call session {context.call_id}: {call_status}")
            
            # Clean up context
            context_manager.remove_context(call_sid)
            logger.info(f"🗑️ Cleaned up context for {call_sid}")
    
    return PlainTextResponse("OK")


# =============================================================================
# AI Response Generation
# =============================================================================

async def generate_ai_response(context: CallContext, user_message: str) -> str:
    """
    Generate AI response using Azure OpenAI
    """
    try:
        from openai import AsyncAzureOpenAI
        
        client = AsyncAzureOpenAI(
            api_key=settings.azure_openai_key,
            api_version=settings.azure_openai_api_version,
            azure_endpoint=settings.azure_openai_endpoint,
        )
        
        # Build system prompt
        system_prompt = get_system_prompt(
            hospital_name=context.hospital_name,
            intents=context.intents,
            departments=context.departments,
        )
        
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
        ]
        
        # Add conversation history
        for turn in context.conversation_history[-8:]:
            messages.append({
                "role": turn.role,
                "content": turn.content
            })
        
        # Generate response - keep it concise for phone conversations
        response = await client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=messages,
            max_completion_tokens=100,  # Keep responses brief for phone
        )
        
        ai_response = response.choices[0].message.content
        logger.info(f"🤖 AI Response: {ai_response}")
        
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating AI response: {e}")
        return "I'm sorry, I'm having trouble understanding. Could you please repeat that?"


# =============================================================================
# WebSocket for real-time streaming (future Pipecat integration)
# =============================================================================

@app.websocket("/media/{call_sid}")
async def websocket_media_stream(websocket: WebSocket, call_sid: str):
    """
    WebSocket endpoint for Twilio Media Streams
    This will be used for real-time Pipecat integration
    """
    await websocket.accept()
    logger.info(f"🔌 WebSocket connected for call {call_sid}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            event = message.get("event")
            
            if event == "connected":
                logger.info("✅ Twilio stream connected")
            
            elif event == "start":
                stream_sid = message.get("start", {}).get("streamSid")
                logger.info(f"🎙️ Stream started: {stream_sid}")
            
            elif event == "media":
                # Handle audio chunk
                # In full Pipecat integration, this would feed into the pipeline
                pass
            
            elif event == "stop":
                logger.info("⏹️ Stream stopped")
                break
                
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket disconnected for {call_sid}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        context_manager.remove_context(call_sid)


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info",
    )

