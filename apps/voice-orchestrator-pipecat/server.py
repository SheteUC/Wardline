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
from twilio_transport import TwilioMediaStreamAdapter

# Configure logging
# Use enqueue=True to avoid file locking issues on Windows
logger.add(
    "logs/voice_orchestrator.log",
    rotation="1 day",
    retention="7 days",
    level="DEBUG",
    enqueue=True,  # Use background thread to avoid file locking
    catch=True,    # Catch errors in logging itself
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
            
            # Create call session in core-api (or get existing if duplicate webhook)
            call_data = await api_client.create_call_session({
                "hospitalId": context.hospital_id,  # Required field
                "twilioCallSid": call_sid,
                "direction": "INBOUND",  # Must be uppercase enum value
                "fromNumber": from_number,
                "toNumber": to_number,
            })
            
            # If creation failed (possibly due to duplicate), try to get existing
            if not call_data:
                logger.warning(f"Call creation failed, checking for existing session with SID {call_sid}")
                call_data = await api_client.get_call_by_twilio_sid(call_sid)
                if call_data:
                    logger.info(f"Found existing call session: {call_data.get('id')}")
            
            if call_data:
                context.call_id = call_data.get("id")
                # Register reverse mapping so Core API endpoints can look up context
                if context.call_id:
                    context_manager.register_call_id(call_sid, context.call_id)
                logger.info(f"Using call session: {context.call_id}")
            else:
                logger.warning(f"Could not create or retrieve call session for {call_sid}")
        else:
            logger.warning(f"No hospital found for phone {to_number}, using defaults")
            context.hospital_name = "Wardline Medical Center"
    except Exception as e:
        logger.warning(f"Could not load hospital data: {e}")
        context.hospital_name = "Wardline Medical Center"
    
    # Generate TwiML response
    response = VoiceResponse()
    
    # ---------------------------------------------------------------------------
    # Choose call mode:
    #   - Streaming mode (Pipecat real-time): uses <Connect><Stream> to pipe
    #     audio to the /media/{call_sid} WebSocket endpoint.
    #   - Gather mode (fallback): classic request/response with Twilio Gather.
    # ---------------------------------------------------------------------------
    use_streaming = getattr(settings, "use_streaming", False)
    base_url = settings.webhook_base_url.rstrip("/")

    if use_streaming and base_url:
        logger.info(f"Using Pipecat streaming mode for {call_sid}")

        # Greet the caller first, then connect the media stream
        greeting = get_greeting_prompt(context.hospital_name)
        response.say(greeting, voice="Polly.Joanna")

        # Open a bidirectional media stream to our WebSocket endpoint
        connect = Connect()
        stream = Stream(url=f"{base_url.replace('https://', 'wss://').replace('http://', 'ws://')}/media/{call_sid}")
        connect.append(stream)
        response.append(connect)
    else:
        logger.info(f"Using Gather (request/response) mode for {call_sid}")

        # Greeting inside gather so it starts listening immediately
        greeting = get_greeting_prompt(context.hospital_name)
        
        # Speech hints help Twilio recognise medical/appointment terms better
        speech_hints = (
            "appointment, schedule, scheduling, reschedule, cancel, "
            "prescription, refill, medication, pharmacy, "
            "insurance, billing, bill, payment, "
            "radiology, cardiology, primary care, pharmacy, medical records, "
            "doctor, nurse, physician, "
            "yes, no, correct, that's right, "
            "January, February, March, April, May, June, "
            "July, August, September, October, November, December"
        )
        
        gather = Gather(
            input="speech",
            action="/voice/process",
            method="POST",
            speech_timeout="3",
            timeout=10,
            speech_model="phone_call",
            enhanced=True,
            language="en-US",
            hints=speech_hints,
        )
        gather.say(greeting, voice="Polly.Joanna")
        response.append(gather)
        
        # Fallback if no input
        response.say("I didn't catch that. How can I help you today?", voice="Polly.Joanna")
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
    
    # Speech hints help Twilio recognize medical/appointment terms better
    speech_hints = (
        "appointment, schedule, scheduling, reschedule, cancel, "
        "prescription, refill, medication, pharmacy, "
        "insurance, billing, bill, payment, "
        "radiology, cardiology, primary care, pharmacy, medical records, "
        "doctor, nurse, physician, "
        "yes, no, correct, that's right, "
        "January, February, March, April, May, June, "
        "July, August, September, October, November, December"
    )
    
    # Continue gathering speech immediately after AI speaks
    # The AI response IS the prompt - no need to add another one
    gather = Gather(
        input="speech",
        action="/voice/process",
        method="POST",
        speech_timeout="3",  # Wait 3 seconds of silence before processing
        timeout=15,  # Max 15 seconds to wait for speech to start
        speech_model="phone_call",
        enhanced=True,
        language="en-US",
        hints=speech_hints,  # Help recognize common medical terms
    )
    # Say AI response inside gather so it listens immediately after
    gather.say(ai_response, voice="Polly.Joanna")
    response.append(gather)
    
    # If no input after timeout, ask if they're still there
    response.say(
        "Are you still there? How else can I help you?",
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
            
            # Map Twilio status to Core API enum
            status_map = {
                "completed": "COMPLETED",
                "failed": "FAILED",
                "busy": "FAILED",
                "no-answer": "ABANDONED",
            }
            api_status = status_map.get(call_status, "COMPLETED")
            
            # Update call session in core-api
            if context.call_id:
                await api_client.update_call_session(context.call_id, {
                    "status": api_status,
                    "duration": int(call_duration),
                    "detectedIntent": context.detected_intent.value if context.detected_intent else None,
                })
                logger.info(f"Updated call session {context.call_id}: {api_status}")
            
            # Clean up agents (all types)
            agent_type = _get_agent_type()
            if agent_type == "azure_ai_foundry":
                from azure_ai_foundry_agent import azure_ai_foundry_agent_manager
                azure_ai_foundry_agent_manager.remove_agent(call_sid)
            elif agent_type == "langchain_tools":
                from langchain_agent import agent_manager
                agent_manager.remove_agent(call_sid)
            else:
                from conversation_agent import conversation_agent_manager
                conversation_agent_manager.remove_agent(call_sid)
            
            # Clean up context
            context_manager.remove_context(call_sid)
            logger.info(f"🗑️ Cleaned up context and agent for {call_sid}")
    
    return PlainTextResponse("OK")


# =============================================================================
# AI Response Generation (Conversational Agent - Robust for Voice)
# =============================================================================

def _get_agent_type() -> str:
    """Get configured agent type"""
    return settings.agent_type.lower()

async def generate_ai_response(context: CallContext, user_message: str) -> str:
    """
    Generate AI response using configured agent.
    - azure_ai_foundry: Azure AI Foundry managed agent (RECOMMENDED)
    - conversational: Direct LLM with state tracking (reliable)
    - langchain_tools: LangChain tools agent (legacy, less reliable)
    """
    try:
        agent_type = _get_agent_type()
        
        if agent_type == "azure_ai_foundry":
            # Azure AI Foundry: Managed agent with built-in capabilities
            from azure_ai_foundry_agent import azure_ai_foundry_agent_manager
            agent = azure_ai_foundry_agent_manager.get_or_create_agent(context)
            ai_response = await agent.generate_response(user_message)
            
        elif agent_type == "langchain_tools":
            # Legacy: LangChain tools agent (less reliable for short inputs)
            from langchain_agent import agent_manager
            agent = agent_manager.get_or_create_agent(context)
            ai_response = await agent.generate_response(user_message)
            agent.update_context()
            
        else:  # conversational (default)
            # Robust conversational agent (recommended if not using AI Foundry)
            from conversation_agent import conversation_agent_manager
            agent = conversation_agent_manager.get_or_create_agent(context)
            ai_response = await agent.generate_response(user_message)
        
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating AI response: {e}")
        # Fallback to basic response
        return "I'm sorry, I'm having trouble right now. Could you repeat that?"


# =============================================================================
# WebSocket for real-time streaming (future Pipecat integration)
# =============================================================================

@app.websocket("/media/{call_sid}")
async def websocket_media_stream(websocket: WebSocket, call_sid: str):
    """
    WebSocket endpoint for Twilio Media Streams.
    Bridges Twilio audio to the Pipecat real-time pipeline.
    """
    await websocket.accept()
    logger.info(f"🔌 WebSocket connected for call {call_sid}")
    
    # Retrieve (or create) call context
    context = context_manager.get_context(call_sid)
    if not context:
        logger.warning(f"No context for call {call_sid} — creating minimal context")
        context = context_manager.create_context(call_sid=call_sid)

    try:
        from flow_manager import WardlineFlowManager
        flow_manager = WardlineFlowManager(context)

        adapter = TwilioMediaStreamAdapter(websocket, call_sid)
        await adapter.run(context=context, flow_manager=flow_manager)

    except Exception as e:
        logger.error(f"WebSocket media stream error for {call_sid}: {e}", exc_info=True)
    finally:
        # Clean up agents
        agent_type = _get_agent_type()
        if agent_type == "azure_ai_foundry":
            from azure_ai_foundry_agent import azure_ai_foundry_agent_manager
            azure_ai_foundry_agent_manager.remove_agent(call_sid)
        elif agent_type == "langchain_tools":
            from langchain_agent import agent_manager
            agent_manager.remove_agent(call_sid)
        else:
            from conversation_agent import conversation_agent_manager
            conversation_agent_manager.remove_agent(call_sid)
        context_manager.remove_context(call_sid)
        logger.info(f"🗑️ Cleaned up resources for {call_sid}")


# =============================================================================
# Core API → Voice Orchestrator control endpoints
# These are called by the NestJS VoiceOrchestratorClient during workflow
# execution to control active calls mid-stream.
# =============================================================================

def _get_agent_manager_for_call(call_sid: str):
    """Return the active agent manager instance for a call."""
    agent_type = _get_agent_type()
    if agent_type == "azure_ai_foundry":
        from azure_ai_foundry_agent import azure_ai_foundry_agent_manager
        return azure_ai_foundry_agent_manager
    elif agent_type == "langchain_tools":
        from langchain_agent import agent_manager
        return agent_manager
    else:
        from conversation_agent import conversation_agent_manager
        return conversation_agent_manager


def _resolve_context(call_id: str):
    """Look up context by Core API call_id; return (context, call_sid) or (None, None)."""
    ctx = context_manager.get_context_by_call_id(call_id)
    if ctx:
        return ctx, ctx.call_sid
    return None, None


@app.post("/calls/{call_id}/ai-config")
async def update_ai_config(call_id: str, request: Request):
    """
    Update the AI agent's persona and system prompt mid-call.
    Called by WorkflowExecutionService when executing an ai-agent node.
    """
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    body = await request.json()
    persona = body.get("persona", "")
    system_prompt = body.get("systemPrompt", "")

    context.active_persona = persona
    manager = _get_agent_manager_for_call(call_sid)
    manager.update_config(call_sid, body)

    logger.info(f"AI config updated for call {call_id}: persona={persona!r}")
    return {"success": True, "callId": call_id, "persona": persona}


@app.post("/calls/{call_id}/hold")
async def hold_call(call_id: str, request: Request):
    """
    Pause the AI pipeline and play a hold message.
    The ConversationProcessor respects context.paused to skip LLM calls.
    """
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    body = await request.json()
    hold_message = body.get("message", "Please hold while we connect you with a team member.")

    context.paused = True
    context.state = CallState.TRANSFERRING
    context.add_assistant_message(hold_message)

    logger.info(f"Call {call_id} placed on hold")
    return {"success": True, "callId": call_id, "message": hold_message}


@app.post("/calls/{call_id}/resume")
async def resume_call(call_id: str, request: Request):
    """Resume a previously held call."""
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    context.paused = False
    context.state = CallState.LISTENING
    logger.info(f"Call {call_id} resumed")
    return {"success": True, "callId": call_id}


@app.post("/calls/{call_id}/transfer")
async def transfer_call(call_id: str, request: Request):
    """
    Mark the call for transfer to a human agent and notify the pipeline.
    The pipeline will complete the current utterance then hand off.
    """
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    body = await request.json()
    reason = body.get("reason", "Customer requested transfer")
    target = body.get("target", "general")

    context.escalation_reason = reason
    context.transfer_target = target
    context.state = CallState.TRANSFERRING
    from call_context import IntentType
    context.detected_intent = IntentType.TRANSFER_TO_HUMAN

    logger.info(f"Call {call_id} flagged for transfer to {target!r}: {reason}")
    return {"success": True, "callId": call_id, "target": target}


@app.post("/calls/{call_id}/context")
async def update_call_context(call_id: str, request: Request):
    """Update arbitrary call context fields (extracted fields, intent, etc.)."""
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    body = await request.json()
    if "detectedIntent" in body and body["detectedIntent"]:
        try:
            from call_context import IntentType
            context.detected_intent = IntentType(body["detectedIntent"])
        except ValueError:
            pass
    if "isEmergency" in body:
        context.is_emergency = bool(body["isEmergency"])
    if "extractedFields" in body and isinstance(body["extractedFields"], dict):
        for k, v in body["extractedFields"].items():
            context.collect_field(k, v)

    logger.info(f"Context updated for call {call_id}")
    return {"success": True, "callId": call_id}


@app.post("/calls/{call_id}/end")
async def end_call(call_id: str, request: Request):
    """
    Gracefully end a call: mark context as completed.
    The pipeline finishes naturally; context cleanup happens in the finally block.
    """
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    body = await request.json()
    closing_message = body.get("closingMessage", "Thank you for calling. Have a great day!")
    context.state = CallState.ENDING
    context.add_assistant_message(closing_message)

    logger.info(f"Call {call_id} flagged for graceful end")
    return {"success": True, "callId": call_id}


@app.post("/calls/{call_id}/message")
async def send_message(call_id: str, request: Request):
    """
    Inject an AI-spoken message into the conversation without waiting for caller input.
    Stored in history; delivered by the pipeline on the next audio frame cycle.
    """
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    body = await request.json()
    text = body.get("text", "")
    if text:
        context.add_assistant_message(text)
        logger.info(f"Injected message into call {call_id}: {text[:60]!r}")
    return {"success": True, "callId": call_id}


@app.get("/calls/{call_id}/state")
async def get_call_state(call_id: str):
    """Return the current state of a call as JSON (for the Core API to inspect)."""
    context, _ = _resolve_context(call_id)
    if not context:
        return {"found": False, "callId": call_id}

    return {
        "found": True,
        "callId": call_id,
        "callSid": context.call_sid,
        "state": context.state.value,
        "isEmergency": context.is_emergency,
        "paused": context.paused,
        "detectedIntent": context.detected_intent.value if context.detected_intent else None,
        "sentimentScore": context.sentiment.overall_score,
        "frustrationLevel": context.sentiment.frustration_level,
        "escalationNeeded": context.sentiment.escalation_needed,
        "turnCount": len(context.conversation_history),
        "activePersona": context.active_persona,
    }


@app.post("/calls/{call_id}/escalate")
async def escalate_call(call_id: str, request: Request):
    """
    Trigger escalation flow: mark context and notify via Core API.
    The voice pipeline will initiate human transfer on the next turn.
    """
    context, call_sid = _resolve_context(call_id)
    if not context:
        return {"success": False, "error": "Call not found or already ended"}

    body = await request.json()
    reason = body.get("reason", "Escalation triggered by workflow")
    specialization = body.get("specialization", "general")

    context.is_emergency = body.get("isEmergency", context.is_emergency)
    context.escalation_reason = reason
    context.transfer_target = specialization
    context.state = CallState.ESCALATING
    from call_context import IntentType
    context.detected_intent = IntentType.TRANSFER_TO_HUMAN
    context.sentiment.escalation_needed = True

    logger.warning(f"Escalation triggered for call {call_id}: {reason}")
    return {"success": True, "callId": call_id, "specialization": specialization}


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

