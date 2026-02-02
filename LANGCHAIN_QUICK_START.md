# LangChain Integration - Quick Start Guide

## What We've Implemented

Your Voice Orchestrator now uses **LangChain** for enhanced AI agent capabilities while keeping your existing workflow engine, queue system, and safety guards intact.

## New Features

### 1. LangChain Agent with Tools ✨
- **5 pre-built tools**: Insurance check, appointment scheduling, prescription refills, department lookup, human transfer
- **Automatic tool selection**: AI decides which tool to use based on conversation
- **Structured outputs**: Tools return formatted responses

### 2. Conversation Memory 🧠
- **ConversationBufferMemory**: Retains full conversation history
- **Context retention**: AI remembers what was said 5 minutes ago
- **Automatic sync**: Memory synced between LangChain and Core API

### 3. Stateful Call Context 📝
- **CallContextService**: Maintains context throughout entire call
- **No recreation**: Same context instance across all workflow nodes
- **Persistent fields**: All extracted data preserved

## Installation

### Step 1: Install Dependencies

```bash
cd apps/voice-orchestrator-pipecat
pip install -r requirements.txt
```

New packages installed:
- `langchain>=0.1.0`
- `langchain-openai>=0.0.5`
- `langgraph>=0.0.20`

### Step 2: No Configuration Needed!

The LangChain integration uses your existing Azure OpenAI credentials. No new environment variables required.

### Step 3: Restart Voice Orchestrator

```bash
cd apps/voice-orchestrator-pipecat
python server.py
```

You should see:
```
🚀 Starting Pipecat Voice Orchestrator
🤖 Agent created with 5 tools
Memory initialized with 0 messages
```

### Step 4: Test It!

Call your Twilio number and try:

**Test Appointment Scheduling:**
```
You: "I need to schedule an appointment"
AI: "I'd be happy to help with that! Can I get your full name?"
You: "John Smith"
AI: "Thanks John. What's your date of birth?"
You: "January 15th, 1980"
AI: "And what's the reason for your visit?"
You: "Annual checkup"
AI: "What date would you prefer?"
You: "Next Tuesday at 2pm"
AI: "Perfect! I have an appointment request for John Smith on [date] at 2pm. 
     Our scheduling team will call you back within the hour to confirm."
```

✅ **What happened**: The AI used the `schedule_appointment` tool automatically!

**Test Insurance Check:**
```
You: "Do you accept Blue Cross?"
AI: "Yes, we accept Blue Cross insurance."
```

✅ **What happened**: The AI used the `check_insurance` tool!

**Test Context Memory:**
```
You: "I need an appointment"
AI: "Sure! What's your name?"
You: "John Smith"
AI: "Thanks John. What's your phone number?"
You: "Wait, what was my name again?"
AI: "Your name is John Smith"
```

✅ **What happened**: The AI remembered from ConversationMemory!

## What Changed

### Files Added

**Voice Orchestrator (Python)**:
- `apps/voice-orchestrator-pipecat/langchain_agent.py` - Agent setup with memory
- `apps/voice-orchestrator-pipecat/langchain_tools.py` - Tool definitions

**Core API (TypeScript)**:
- `apps/core-api/src/modules/calls/call-context.service.ts` - Stateful context management

### Files Modified

**Voice Orchestrator**:
- `requirements.txt` - Added LangChain dependencies
- `server.py` - Now uses LangChain agent for AI responses

**Core API**:
- `workflows.module.ts` - Added CallsModule import
- `workflow-execution.service.ts` - Uses CallContextService
- `calls.module.ts` - Exports CallContextService

## How It Works

### Before (Basic AI)

```python
# Old approach: Direct OpenAI API call
messages = [{"role": "system", "content": prompt}]
messages.extend(conversation_history)
response = await openai.chat.completions.create(messages=messages)
```

**Problems**:
- No tools/functions
- Manual conversation history management
- Limited to text responses
- No context persistence

### After (LangChain Agent)

```python
# New approach: LangChain agent with tools and memory
agent = VoiceAgent(context)
response = await agent.generate_response(user_input)
```

**Benefits**:
- ✅ Automatic tool selection and execution
- ✅ Built-in conversation memory
- ✅ Structured outputs
- ✅ Context persists across systems

## Available Tools

### 1. check_insurance

**What it does**: Verifies if an insurance plan is accepted

**Example conversation**:
```
User: "Do you take Aetna?"
AI: [uses check_insurance tool]
AI: "Yes, we accept Aetna insurance."
```

### 2. schedule_appointment

**What it does**: Collects information and submits appointment request

**Example conversation**:
```
User: "I need an appointment"
AI: "I'd be happy to help! What's your name?"
User: "Jane Doe"
AI: "Thanks Jane. What's your date of birth?"
User: "March 5, 1990"
AI: [continues collecting info]
AI: [uses schedule_appointment tool]
AI: "Perfect! Your appointment request is submitted."
```

### 3. request_prescription_refill

**What it does**: Submits prescription refill request

**Example conversation**:
```
User: "I need a refill for Lisinopril"
AI: "I can help with that. What's your name?"
User: "Bob Johnson"
AI: [collects required info]
AI: [uses request_prescription_refill tool]
AI: "Your refill request has been submitted."
```

### 4. find_department

**What it does**: Locates the appropriate department

**Example conversation**:
```
User: "Where is radiology?"
AI: [uses find_department tool]
AI: "That would be our Radiology department, you can reach them at..."
```

### 5. transfer_to_human

**What it does**: Escalates call to human agent

**Example conversation**:
```
User: "I want to talk to a person"
AI: [uses transfer_to_human tool]
AI: "Of course, let me connect you with a staff member. One moment please."
```

## Adding New Tools

Want to add a new capability? Just add a tool!

### Example: Add "Check Lab Results" Tool

**Step 1**: Define the tool in `langchain_tools.py`

```python
class CheckLabResultsInput(BaseModel):
    patient_name: str = Field(description="Patient's full name")
    patient_dob: str = Field(description="Patient's date of birth")
    test_type: str = Field(description="Type of lab test")

async def check_lab_results_tool(
    patient_name: str,
    patient_dob: str,
    test_type: str,
    context: CallContext
) -> str:
    """Check status of lab results"""
    logger.info(f"Checking lab results for {patient_name}")
    
    # Call your lab system API
    # results = await api_client.get_lab_results(...)
    
    return "Your lab results are ready. Let me transfer you to a nurse who can discuss them."

# Register the tool
def create_agent_tools(context):
    tools = [
        # ... existing tools ...
        
        StructuredTool.from_function(
            coroutine=lambda patient_name, patient_dob, test_type: 
                check_lab_results_tool(patient_name, patient_dob, test_type, context),
            name="check_lab_results",
            description="Check the status of lab test results. Use when patient asks about lab results or test results.",
            args_schema=CheckLabResultsInput,
        ),
    ]
    return tools
```

**Step 2**: Restart Voice Orchestrator

```bash
python server.py
```

**Step 3**: Test it!

```
User: "Are my lab results ready?"
AI: [uses check_lab_results tool]
AI: "Your lab results are ready. Let me transfer you to a nurse who can discuss them."
```

That's it! The AI automatically knows when to use your new tool.

## Context Flow

### How Context Moves Through the System

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Call Starts                                              │
│    Twilio → Voice Orchestrator                              │
│    Creates: CallContext + LangChain Memory                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. AI Conversation                                          │
│    User: "I need an appointment"                            │
│    LangChain: Stored in ConversationMemory                  │
│    Tool: schedule_appointment(...)                          │
│    Memory: Updated with tool result                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Context Sync                                             │
│    agent.update_context()                                   │
│    → Syncs from LangChain Memory to CallContext            │
│    → Sends to Core API                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Workflow Execution (if needed)                          │
│    Core API: executeNode(...)                               │
│    CallContextService.getOrCreate(callId)                   │
│    → Returns SAME context (not recreated!)                  │
│    → Execute safety check, route to queue, etc.            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Human Agent Handoff (if escalated)                      │
│    Summary: agent.get_conversation_summary()                │
│    Collected Fields: context.collected_fields               │
│    WebSocket: Notify agent with full context               │
│    Agent Dashboard: Shows conversation history              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Call Ends                                                │
│    Cleanup: agent_manager.remove_agent(call_sid)            │
│    Cleanup: context_manager.remove_context(call_sid)        │
│    Database: All data persisted for audit                   │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring

### Check Agent Status

```bash
# View active agents
curl http://localhost:3002/health
```

Response should show:
```json
{
    "status": "healthy",
    "service": "voice-orchestrator-pipecat",
    "active_agents": 2
}
```

### View Logs

**Voice Orchestrator**:
```bash
tail -f apps/voice-orchestrator-pipecat/logs/voice_orchestrator.log
```

Look for:
- `🤖 Agent created with 5 tools`
- `🎤 User: [message]`
- `Tool executed: schedule_appointment`
- `Memory initialized with X messages`

**Core API**:
```bash
# View context management
tail -f apps/core-api/logs/application.log | grep "CallContextService"
```

Look for:
- `Created new context for call [call_sid]`
- `Updated context for call [call_sid]`
- `Retrieved existing context for call [call_sid]`

## Safety Features

### Emergency Detection

LangChain agent checks for emergencies BEFORE processing:

```python
# In langchain_agent.py
def _is_emergency(self, text: str) -> bool:
    emergency_keywords = [
        "chest pain", "can't breathe", "stroke",
        "heart attack", "unconscious", "suicidal"
    ]
    return any(keyword in text.lower() for keyword in emergency_keywords)
```

**Test it**:
```
User: "I'm having chest pain"
AI: "This sounds like it could be a medical emergency. Please hang up and call 911 immediately."
```

✅ No tool execution - immediate response for safety!

### Medical Keyword Detection

Medical Triage Guard continues to monitor in background:

```
User: "I need help with my diabetes medication"
[Medical Triage Guard detects "diabetes"]
[Workflow forces escalation to clinical queue]
AI: "Let me connect you with a clinical staff member who can help with that."
```

## Troubleshooting

### Issue: Tools not executing

**Check**: Are tool descriptions clear?

```python
# Bad
description="Schedule appointments"

# Good
description="Schedule a medical appointment. Use when caller asks to book, schedule, or make an appointment."
```

### Issue: Agent forgetting conversation

**Check**: Is memory being synced?

```python
# After generating response
agent.update_context()  # <- Make sure this is called
```

### Issue: Import errors

**Fix**: Reinstall dependencies

```bash
cd apps/voice-orchestrator-pipecat
pip install -r requirements.txt --upgrade
```

## Next Steps

### 1. Add More Tools

Create tools for:
- Billing inquiries
- Medical records requests
- Provider lookup
- FAQs and general information

### 2. Enhance Memory

Consider using:
- `ConversationSummaryMemory` for long conversations
- `ConversationSummaryBufferMemory` for hybrid approach
- Custom memory with semantic search

### 3. Multi-Agent Workflows (Advanced)

Use LangGraph for agent collaboration:
```python
# Billing agent consults scheduling agent
from langgraph import StateGraph

graph = StateGraph(AgentState)
graph.add_node("billing", billing_agent)
graph.add_node("scheduling", scheduling_agent)
```

### 4. Observability (Future)

Integrate LangSmith:
```python
import langsmith

# Track all agent interactions
# Debug conversation quality
# Optimize prompts
```

## Summary

✅ **Installed**: LangChain with 5 pre-built tools
✅ **Added**: Conversation memory for context retention
✅ **Improved**: Stateful context management in Core API
✅ **Kept**: All existing safety, workflow, and queue systems

Your voice AI is now **significantly more capable** while maintaining healthcare compliance! 🎉

## Questions?

Check the full architecture documentation in `LANGCHAIN_HYBRID_ARCHITECTURE.md` for detailed information about:
- System architecture
- Call flows
- Safety integration
- Tool development
- Best practices
