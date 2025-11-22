# Voice Orchestrator Service

Real-time voice AI orchestrator for hospital phone systems using Twilio, Azure AI Speech, and Azure OpenAI.

## Features

- 📞 **Twilio Integration**: TwiML webhooks for call handling
- 🔌 **WebSocket Media Streaming**: Real-time audio streaming via Twilio Media Streams
- 🎤 **Speech-to-Text**: Azure AI Speech for real-time transcription
- 🔊 **Text-to-Speech**: Natural voice synthesis with Azure Neural Voices
- 🤖 **LLM Orchestration**: Azure OpenAI for intelligent conversation
- 🚨 **Emergency Detection**: Real-time keyword matching for life-threatening situations
- 🧠 **Intent Recognition**: Function calling-based intent classification
- 📊 **Call State Machine**: 8-state flow with automatic transitions
- 💾 **Context Management**: In-memory call session management
- 🔐 **HIPAA Compliance**: Audit logging and encrypted communications

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌────────────────┐
│   Twilio    │────────▶│ Voice Orchestrator│◀───────│  Core API      │
│   (Phone)   │ WebHook │                  │   HTTP  │  (Database)    │
└─────────────┘         │  - Express HTTP  │         └────────────────┘
                        │  - WebSocket WS  │
                        │  - State Machine │
                        └──────────────────┘
                               ▲   ▲
                               │   │
                   ┌───────────┘   └───────────┐
                   │                           │
            ┌──────▼──────┐           ┌───────▼────────┐
            │ Azure Speech│           │ Azure OpenAI   │
            │   (STT/TTS) │           │     (LLM)      │
            └─────────────┘           └────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd apps/voice-orchestrator
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required credentials:
- Twilio Account SID and Auth Token
- Azure Speech Key and Region
- Azure OpenAI Key, Endpoint, and Deployment
- Core API Base URL

### 3. Development

```bash
# Start in development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

## Twilio Configuration

### Phone Number Setup

1. Purchase a phone number in Twilio Console
2. Configure Voice webhook:
   - **Webhook URL**: `https://your-domain.com/voice/incoming` (use ngrok for local testing)
   - **HTTP Method**: POST
3. Configure Status callback:
   - **Status Callback URL**: `https://your-domain.com/voice/status`
   - **HTTP Method**: POST

### Local Testing with ngrok

```bash
# Start ngrok tunnel
ngrok http 3002

# Update Twilio webhook to ngrok URL
# e.g., https://abc123.ngrok.io/voice/incoming
```

## API Endpoints

### Webhooks

- `POST /voice/incoming` - Initial call webhook from Twilio
- `POST /voice/gather` - DTMF/speech input callback
- `POST /voice/status` - Call status updates

### Health Check

- `GET /health` - Service health status

## Call Flow

1. **Incoming Call** → Twilio sends webhook to `/voice/incoming`
2. **Greeting** → AI greets caller and establishes WebSocket connection
3. **Emergency Screening** → Checks for life-threatening keywords
4. **Intent Detection** → Classifies caller's need (appointment, billing, etc.)
5. **Adaptive Intake** → Collects required information dynamically
6. **Escalation/Booking** → Transfers to human or books appointment
7. **Call End** → Saves transcript and analytics

## State Machine

```
INITIALIZING → GREETING → EMERGENCY_SCREENING → TRIAGE → BOOKING/ESCALATING → ENDING → COMPLETED
                              ↓ (if emergency detected)
                          ESCALATING
```

## Testing

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

## Production Deployment

See main project README for Azure deployment instructions.

## HIPAA Compliance Notes

- Audio streams are **ephemeral** (not persisted by voice-orchestrator)
- All transcripts sent to core-api for secure storage
- WebSocket connections validate Twilio signatures
- All Azure API calls use TLS encryption
- PHI access logged via audit system
