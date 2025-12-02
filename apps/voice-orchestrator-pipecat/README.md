# Wardline Voice Orchestrator (Pipecat)

Production-ready voice AI for the Wardline Medical Call Center, built with Pipecat for ultra-low latency conversations.

## Features

- 🎙️ **Real-time Speech Recognition** - Azure Speech Services
- 🤖 **AI Conversation** - Azure OpenAI (GPT-4/o4-mini)
- 🔊 **Natural Voice Synthesis** - Azure TTS with neural voices
- 📞 **Twilio Integration** - Handle phone calls via webhooks
- 🏥 **Workflow Execution** - Follow configured call flows
- 📊 **Sentiment Analysis** - Real-time frustration/urgency detection
- 🚨 **Emergency Detection** - Automatic escalation for emergencies
- 📋 **Call Center Integration** - Escalate to human agents

## Quick Start

### 1. Install Dependencies

```bash
cd apps/voice-orchestrator-pipecat
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### 2. Configure Environment

Copy your existing Node.js `.env` or create a new one:

```bash
# Copy from Node version
cp ../voice-orchestrator/.env .env
```

Required environment variables:
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `AZURE_SPEECH_KEY` - Azure Speech Services key
- `AZURE_SPEECH_REGION` - Azure region (e.g., eastus2)
- `AZURE_OPENAI_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `AZURE_OPENAI_DEPLOYMENT` - Deployment name (e.g., o4-mini)
- `CORE_API_BASE_URL` - Wardline Core API URL
- `WEBHOOK_BASE_URL` - Your public URL (ngrok for local dev)

### 3. Start the Server

```bash
python server.py
```

Or with uvicorn:
```bash
uvicorn server:app --host 0.0.0.0 --port 3002 --reload
```

### 4. Expose with ngrok (for local development)

```bash
ngrok http 3002
```

### 5. Configure Twilio

1. Go to Twilio Console → Phone Numbers
2. Select your number (+1 513-951-1583)
3. Set webhook URL to: `https://YOUR-NGROK-URL/voice/incoming`

### 6. Test it!

Call (513) 951-1583 and start talking to the AI!

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Twilio    │────▶│  FastAPI    │────▶│  Core API   │
│  (Calls)    │◀────│  Server     │◀────│  (DB)       │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐  ┌──────────┐
              │  Azure   │  │  Azure   │
              │  OpenAI  │  │  Speech  │
              │  (LLM)   │  │ (STT/TTS)│
              └──────────┘  └──────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |
| `/voice/incoming` | POST | Twilio webhook for incoming calls |
| `/voice/process` | POST | Process speech and generate AI response |
| `/voice/status` | POST | Call status callbacks |
| `/media/{call_sid}` | WS | WebSocket for media streaming (future) |

## Call Flow

1. **Incoming Call** → Twilio sends webhook to `/voice/incoming`
2. **Greeting** → AI greets caller with hospital name
3. **Speech Gather** → Twilio captures caller speech
4. **Process** → Speech sent to `/voice/process`
5. **AI Response** → Azure OpenAI generates response
6. **TTS** → Response spoken via Twilio's `<Say>`
7. **Loop** → Continue conversation until complete

## Escalation Logic

Calls are escalated to human agents when:
- Emergency keywords detected (chest pain, can't breathe, etc.)
- Caller explicitly requests human agent
- High frustration detected (sentiment analysis)
- AI cannot understand after multiple attempts

## Future Enhancements (Pipecat Real-time)

The current implementation uses Twilio's `<Gather>` for speech recognition. For lower latency:

1. **Media Streams** - Use Twilio's WebSocket media streams
2. **Pipecat Pipeline** - Full real-time audio pipeline
3. **Barge-in** - Allow interruptions during AI speech
4. **Streaming TTS** - Word-by-word audio generation

## Development

### Project Structure

```
voice-orchestrator-pipecat/
├── server.py           # FastAPI application
├── bot.py              # Pipecat bot pipeline
├── config.py           # Configuration settings
├── prompts.py          # AI system prompts
├── call_context.py     # Call state management
├── core_api_client.py  # Core API integration
├── requirements.txt    # Python dependencies
└── README.md
```

### Running Tests

```bash
pytest tests/
```

### Logs

Logs are written to `logs/voice_orchestrator.log` with daily rotation.

## Troubleshooting

### "Resource not found" from Azure OpenAI
- Check `AZURE_OPENAI_ENDPOINT` is just the base URL
- Verify deployment name matches `AZURE_OPENAI_DEPLOYMENT`
- Ensure API version is `2024-12-01-preview` for o4-mini

### No audio response
- Check Twilio webhook URL is correct
- Verify ngrok is running and URL is updated
- Check server logs for errors

### Slow responses
- Current TwiML approach adds ~2-3s latency
- For production, implement full Pipecat with media streams

