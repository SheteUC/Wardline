# AI Agent Issues - Diagnosis and Resolution (v2)

**Date:** February 1, 2026  
**Issues:** Empty agent responses, poor handling of short inputs, model selection

## Issues Identified

### Issue 1: Wrong Model for Conversational AI ❌ (CRITICAL)
**Symptom:**
- Agent returns empty responses for short inputs
- Works for long sentences but fails for "Broken ankle." or "Next week, Tuesday"

**Root Cause:**
Using **o4-mini** (a reasoning model) instead of **gpt-4o-mini** (a conversational model).

The o4-mini/o1 series models are:
- Designed for complex reasoning tasks, NOT quick conversations
- Slow and expensive for simple chat
- Don't work well with tool calling
- Struggle with short, terse inputs

### Issue 2: LangChain Tools Agent Not Suited for Voice ❌
**Symptom:**
```
> Entering new AgentExecutor chain...
> Finished chain.
WARNING | langchain_agent:generate_response:146 - Empty response from agent, providing fallback
```

**Root Cause:**
The LangChain tools agent was:
1. Getting confused about whether to use tools or respond
2. Deciding it couldn't call a tool (missing params) but also not responding
3. Not understanding short inputs in context

### Issue 3: No Context for Short Inputs ❌
**Symptom:**
When asked "what date?", caller says "Next week, Tuesday afternoon" → Agent returns empty

**Root Cause:**
Short answers aren't understood in context. The agent doesn't know this is answering the "preferred date" question.

### Issue 4: Duplicate Call Session Error ❌
**Symptom:**
```
"Unique constraint failed on the fields: (`twilio_call_sid`)"
```

**Root Cause:**
Twilio sends duplicate webhooks; no handling for existing sessions.

## Solutions Implemented ✅

### Fix 1: New Conversational Agent (MAJOR CHANGE)

Created a completely new agent architecture that doesn't rely on LangChain's tool-calling:

#### `conversation_agent.py` - Robust Conversational Agent
- **Direct LLM calls** instead of LangChain AgentExecutor
- **State tracking** for what information has been collected
- **Context enrichment** - short inputs are prefixed with conversation context
- **Smart fallbacks** - contextual responses when LLM returns empty
- **Information extraction** - automatically extracts names, dates, reasons from responses

Key features:
```python
class ConversationAgent:
    # Tracks workflow state
    state: WorkflowState  # GREETING, COLLECTING_INFO, CONFIRMING, etc.
    
    # Tracks collected information
    collected_info: CollectedInfo  # name, dob, reason, date, etc.
    
    # Remembers what we asked
    last_question_topic: str  # "name", "date_of_birth", "reason", etc.
    
    # Context enrichment for short inputs
    def _build_context_prefix(self, user_input: str) -> str:
        # Turns "Broken ankle" into:
        # "[Already collected: name=Joe, dob=10/28/2003]
        #  [Last asked about: reason]
        #  Caller says: "Broken ankle""
```

### Fix 2: Model Configuration

Changed default from **o4-mini** to **gpt-4o-mini**:

```python
# config.py
azure_openai_deployment: str = Field(default="gpt-4o-mini", env="AZURE_OPENAI_DEPLOYMENT")
```

Added environment variable to switch agent types:
```bash
# .env
VOICE_AGENT_TYPE="conversational"  # or "langchain_tools" for legacy
```

### Fix 3: Conversational System Prompt

New prompt optimized for voice calls with short inputs:

```python
def get_conversational_system_prompt(...):
    """
    ## CRITICAL RULES FOR PHONE CALLS
    1. ALWAYS respond with something - NEVER return empty responses
    2. Keep responses to 1-2 SHORT sentences maximum
    3. If caller's response seems unclear, ACKNOWLEDGE what you heard and ask to clarify
    
    ## Handling Short/Unclear Responses
    - If they give a short answer (1-3 words), it's probably answering your last question
    - For garbled speech: "I'm sorry, I had trouble hearing that"
    - NEVER just skip a turn - always say SOMETHING
    """
```

### Fix 4: Duplicate Call Handling (from v1)
Same as before - graceful handling of Twilio duplicate webhooks.

## Files Modified

### Python (Voice Orchestrator)
- ✅ **NEW** `apps/voice-orchestrator-pipecat/conversation_agent.py` - Robust conversational agent
- ✅ `apps/voice-orchestrator-pipecat/prompts.py` - Added conversational prompt
- ✅ `apps/voice-orchestrator-pipecat/server.py` - Uses new agent, configurable
- ✅ `apps/voice-orchestrator-pipecat/config.py` - Model & agent type settings
- ✅ `apps/voice-orchestrator-pipecat/core_api_client.py` - Query by Twilio SID

### TypeScript (Core API)
- ✅ `apps/core-api/src/modules/calls/calls.controller.ts` - Added GET /api/calls endpoint
- ✅ `apps/core-api/src/modules/calls/calls.service.ts` - Added findByTwilioSid method

### Config
- ✅ `.env.example` - Updated with new settings

## 🚨 CRITICAL: Environment Variable Change

**You MUST update your Azure OpenAI deployment in .env:**

```bash
# CHANGE THIS:
AZURE_OPENAI_DEPLOYMENT="o4-mini"

# TO THIS:
AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"
```

**Why?** The o4-mini is a reasoning model (like o1-mini) designed for complex multi-step reasoning. It's:
- ❌ Slow for conversational AI
- ❌ Doesn't work well with short inputs
- ❌ Expensive for simple chat
- ❌ Returns empty responses frequently

The gpt-4o-mini is designed for:
- ✅ Fast conversational responses
- ✅ Handles short inputs well
- ✅ Cheap and efficient
- ✅ Great for voice AI

## Testing Instructions

### Quick Test
1. **Update .env:**
   ```bash
   AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"
   VOICE_AGENT_TYPE="conversational"
   ```

2. **Restart voice orchestrator:**
   ```bash
   cd apps/voice-orchestrator-pipecat
   python server.py
   ```

3. **Call and test:**
   - "I need to schedule an appointment" → Should ask for name
   - "Joe" → Should acknowledge and ask for DOB
   - "October 28, 2003" → Should ask for reason
   - "Broken ankle" → Should ask for date preference
   - "Next Tuesday" → Should confirm the appointment

### Expected Logs (Success)
```
✅ Creating new conversation agent for call CA...
✅ 🎤 User: I need to schedule an appointment
✅ 🎯 Detected intent: schedule_appointment
✅ 🤖 Agent: Sure, I can help with that. What's your full name?
✅ 🎤 User: Joe
✅ 📝 Extracted name: Joe
✅ 🤖 Agent: Thanks Joe. What's your date of birth?
```

### What Should NOT Happen
```
❌ Empty response from agent, providing fallback
❌ > Entering new AgentExecutor chain... > Finished chain. (with no output)
❌ Using reasoning model 'o4-mini' for conversational AI
```

## Architecture Comparison

### Before (LangChain Tools Agent)
```
User Input → LangChain AgentExecutor → Tool Decision → Response
              ↓
         Confused on short inputs
              ↓
         Empty response
```

### After (Conversational Agent)
```
User Input → Context Enrichment → Direct LLM Call → Extract Info → Response
              ↓                      ↓
         Adds what we asked     Always responds
         Adds what we have      Never empty
```

## Rollback Plan

If issues persist, you can switch back to the LangChain agent:

```bash
# In .env:
VOICE_AGENT_TYPE="langchain_tools"
```

Or revert files:
```bash
git checkout HEAD -- apps/voice-orchestrator-pipecat/
```

---
**Status:** ✅ Ready for testing  
**Confidence:** Very High - addresses all root causes  
**Key Change:** Switch from o4-mini to gpt-4o-mini AND use conversational agent
