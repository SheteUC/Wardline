# Azure AI Foundry Agent Setup

**Date:** February 1, 2026  
**Status:** ✅ Ready for testing

## What is Azure AI Foundry?

Azure AI Foundry (formerly Azure AI Studio) provides **managed agents** with:
- ✅ Pre-configured AI models (GPT-4.1-mini, etc.)
- ✅ Built-in tools and function calling
- ✅ Better management and monitoring
- ✅ Evaluation and testing tools
- ✅ Easier multi-agent orchestration

## Architecture Comparison

### Old: Direct Azure OpenAI API
```
Voice Input → LangChain Agent → Azure OpenAI API → Response
```

### New: Azure AI Foundry Managed Agent
```
Voice Input → Azure AI Foundry Agent → Response
              ↓
         Built-in tools, memory, monitoring
```

## Configuration

Your `.env` is already configured:

```bash
# Azure AI Foundry
AZURE_EXISTING_AGENT_ID="wardline-agent:1"
AZURE_EXISTING_AIPROJECT_ENDPOINT="https://perplxserper-resource.services.ai.azure.com/api/projects/perplxserper"

# Agent type
VOICE_AGENT_TYPE="azure_ai_foundry"
```

## Setup Steps

### 1. Install Dependencies

```bash
cd apps/voice-orchestrator-pipecat
pip install --pre azure-ai-projects>=2.0.0b1
pip install azure-identity>=1.15.0
```

Or install all requirements:
```bash
pip install -r requirements.txt
```

### 2. Authenticate with Azure

The code uses `DefaultAzureCredential` which tries authentication methods in order:
1. **Environment variables** (if set)
2. **Azure CLI** (if logged in)
3. **Managed Identity** (in production)

**For local development, use Azure CLI:**
```bash
az login
az account set --subscription "ea0fa670-be7b-4f09-9c73-934540bd1b20"
```

### 3. Configure Your Agent in Azure AI Foundry

1. Go to [Azure AI Foundry](https://ai.azure.com/)
2. Select your project: `perplxserper`
3. Go to **Agents** → Your agent: `wardline-agent`
4. Configure:
   - **Model**: GPT-4.1-mini (or gpt-4o-mini)
   - **System Prompt**: Copy from below
   - **Tools**: Enable any tools you need (function calling, web search, etc.)

#### Recommended System Prompt for Voice Agent

```
You are a friendly, professional phone receptionist for Wardline Medical Center.

## YOUR ROLE
Handle incoming phone calls and help callers with:
- Scheduling appointments
- Prescription refills
- Insurance questions
- Billing inquiries
- General questions

## CRITICAL RULES FOR PHONE CALLS
1. Keep responses to 1-2 SHORT sentences maximum
2. NEVER return empty responses - always say something
3. Ask ONE question at a time
4. If you don't understand, politely ask for clarification
5. Be warm and empathetic

## HANDLING SHORT INPUTS
- Short answers (1-3 words) are usually answering your last question
- For garbled speech: "I'm sorry, I had trouble hearing that. Could you repeat that?"
- For spelled names: Accept letter-by-letter as a name
- NEVER stay silent

## EMERGENCY PROTOCOL
If caller mentions:
- Chest pain, difficulty breathing, severe bleeding
- Stroke symptoms, loss of consciousness
- Suicidal thoughts, overdose

Respond: "This sounds like a medical emergency. Please hang up and call 911 immediately."

## CONVERSATION FLOW
1. Greet caller warmly
2. Ask what they need help with
3. Collect information one piece at a time
4. Confirm details
5. Provide next steps or transfer as needed

Remember: You're on a PHONE CALL. Be brief, natural, and helpful.
```

### 4. Start the Voice Orchestrator

```bash
cd apps/voice-orchestrator-pipecat
python server.py
```

### 5. Test

Make a call to your Twilio number and watch the logs:

```
✅ 🔧 Initializing Azure AI Foundry agent: wardline-agent:1
✅ ✅ Retrieved agent: wardline-agent
✅ 🎤 User: I need to schedule an appointment
✅ 🤖 Agent: Sure, I can help with that. What's your full name?
```

## Files Created/Modified

| File | Purpose |
|------|---------|
| `azure_ai_foundry_agent.py` | New Azure AI Foundry agent implementation |
| `server.py` | Updated to support azure_ai_foundry agent type |
| `config.py` | Added Azure AI Foundry configuration |
| `requirements.txt` | Added azure-ai-projects and azure-identity |
| `.env` | Already configured by user |

## Agent Types Available

| Type | Description | When to Use |
|------|-------------|-------------|
| **azure_ai_foundry** ✅ | Managed agent in Azure AI Foundry | Production, best features |
| **conversational** | Direct LLM with state tracking | Fallback, custom logic |
| **langchain_tools** | LangChain tools agent | Legacy, not recommended |

Switch between them in `.env`:
```bash
VOICE_AGENT_TYPE="azure_ai_foundry"  # or "conversational" or "langchain_tools"
```

## Advantages of Azure AI Foundry

### 1. Better Management
- **Dashboard**: Monitor agent performance in Azure portal
- **Evaluation**: Test agent responses before deployment
- **Versioning**: Roll back to previous agent versions

### 2. Built-in Capabilities
- **Function Calling**: Agent can call your tools automatically
- **Web Search**: Agent can search the web for information
- **File Processing**: Handle documents and files

### 3. Multi-Agent Support
- **Agent Orchestration**: Coordinate multiple specialized agents
- **Handoffs**: Transfer between agents seamlessly
- **Shared Context**: Agents share conversation memory

### 4. Monitoring & Insights
- **Telemetry**: Automatic logging of all interactions
- **Analytics**: Conversation quality metrics
- **Debugging**: Trace execution flow

## Troubleshooting

### Issue: Authentication Failed

**Solution:**
```bash
# Login with Azure CLI
az login

# Set correct subscription
az account set --subscription "ea0fa670-be7b-4f09-9c73-934540bd1b20"
```

### Issue: Agent Not Found

**Error:** `Agent 'wardline-agent:1' not found`

**Solution:**
1. Check agent name in Azure AI Foundry portal
2. Update `.env` with correct agent ID:
   ```bash
   AZURE_EXISTING_AGENT_ID="your-agent-name"
   ```

### Issue: Empty Responses

**Solution:**
1. Check agent's system prompt in Azure AI Foundry
2. Make sure prompt includes "NEVER return empty responses"
3. Test agent in Azure AI Foundry playground first

### Issue: Slow Responses

**Solution:**
1. Check if model is GPT-4.1-mini (not o4-mini)
2. Monitor in Azure portal for rate limits
3. Consider using gpt-4o-mini for faster responses

## Next Steps

### 1. Test the Agent
- Make test calls
- Try different scenarios (appointments, refills, etc.)
- Verify short inputs work well

### 2. Configure Tools (Optional)
In Azure AI Foundry, add tools for:
- **Scheduling**: TimeTap integration
- **Insurance**: Check plan acceptance
- **Prescriptions**: Submit refill requests

### 3. Set Up Multi-Agent (Later)
Create specialized agents:
- **Triage Agent**: Detects intent, routes calls
- **Scheduling Agent**: Handles appointments
- **Prescription Agent**: Manages refills
- **Billing Agent**: Answers billing questions

## Cost Comparison

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Best For |
|-------|----------------------|------------------------|----------|
| **gpt-4.1-mini** | $0.40 | $1.60 | Multi-turn dialog |
| **gpt-4o-mini** | $0.15 | $0.60 | Simple Q&A |
| **o4-mini** ❌ | $3.00 | $12.00 | Complex reasoning (NOT voice) |

For voice AI with 100 calls/day averaging 10 turns each:
- **gpt-4.1-mini**: ~$2-3/day
- **gpt-4o-mini**: ~$1/day

The reliability and quality improvement of gpt-4.1-mini usually justifies the extra cost.

## Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-studio/)
- [Azure AI Projects SDK](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-projects-readme)
- [Your Azure AI Foundry Portal](https://ai.azure.com/)

---
**Status:** ✅ Configured and ready for testing
