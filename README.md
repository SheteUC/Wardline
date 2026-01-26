# Wardline

Enterprise multi-agent voice AI platform for healthcare call centers with hybrid AI + human orchestration.

## Overview

Wardline is a HIPAA-compliant SaaS platform that revolutionizes hospital call triage through intelligent agent orchestration. Powered by Pipecat for real-time voice AI, the platform seamlessly blends automated AI agents with human specialists for 24/7 patient care, emergency screening, and administrative automation.

## Architecture

### Multi-Agent Platform

```
┌─────────────────────────────────────────────────────────────────┐
│  PHONE CALL → Pipecat Voice Orchestrator (Python/FastAPI)      │
│  ├─ Real-time speech recognition (Azure Speech)                 │
│  ├─ AI conversation (Azure OpenAI GPT-4)                       │
│  ├─ Natural TTS (Azure Neural Voices)                          │
│  └─ Emergency detection & sentiment analysis                    │
│                            ↕                                     │
│  Core API (NestJS) - Multi-Agent Backend                       │
│  ├─ Workflow execution engine (15+ node types)                 │
│  ├─ Queue management & assignment (4 strategies)               │
│  ├─ Agent orchestration (AI + Human)                           │
│  ├─ Medical safety guard (60+ keywords)                        │
│  └─ WebSocket gateway (real-time events)                       │
│                            ↕                                     │
│  Web Dashboard (Next.js)                                        │
│  ├─ Visual workflow editor (ReactFlow)                         │
│  ├─ Agent management & monitoring                              │
│  ├─ Queue metrics & analytics                                  │
│  └─ Human agent dashboard                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Applications

- **apps/web**: Next.js 14 App Router with shadcn/ui (Port 3000)
  - Visual workflow editor with ReactFlow
  - Real-time agent dashboard with WebSocket
  - Analytics and queue monitoring
  
- **apps/core-api**: NestJS REST API + WebSocket Gateway (Port 3001)
  - Multi-agent orchestration platform
  - Workflow execution engine
  - Queue management with 4 assignment strategies
  - Medical safety guard with 60+ keywords
  - Redis caching for performance
  
- **apps/voice-orchestrator-pipecat**: Python/FastAPI + Pipecat (Port 3002)
  - Twilio media stream handling
  - Real-time voice AI with <200ms latency
  - Azure Speech Services integration
  - Azure OpenAI conversation engine

### Packages

- **packages/db**: Prisma schema with 20+ models including Agent, CallQueue, CallAssignment
- **packages/types**: 50+ TypeScript interfaces for domain models
- **packages/config**: Environment configuration with validation
- **packages/utils**: Logging, error handling, audit trail
- **packages/ui**: Design system components

## Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Azure subscription (with Azure AI Speech and Azure OpenAI)
- Twilio account (HIPAA-flagged with BAA)
- Clerk account
- Stripe account
- PostHog account

## Getting Started

### 1. Installation

```bash
pnpm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate
```

### 4. Development

Start all services in development mode:

```bash
pnpm dev
```

Individual services:

```bash
# Web UI (port 3000)
pnpm --filter @wardline/web dev

# Core API (port 3001)
pnpm --filter @wardline/core-api dev

# Voice Orchestrator (port 3002)
cd apps/voice-orchestrator-pipecat && python server.py
```

## Key Features

### Multi-Agent Orchestration
- **AI Agents**: Pipecat-powered voice AI with configurable personas
- **Human Agents**: Clinical staff dashboard with real-time assignments
- **Smart Routing**: 4 assignment strategies (skill-based, round-robin, least-busy, priority)
- **Queue Management**: Real-time metrics, SLA tracking, wait time monitoring

### Voice AI Platform
- **Ultra-Low Latency**: <200ms response time with Pipecat streaming
- **Natural Conversations**: Azure Speech + OpenAI GPT-4 integration
- **Sentiment Analysis**: Real-time frustration and urgency detection
- **Emergency Detection**: Automatic escalation for critical keywords

### Workflow Automation
- **Visual Editor**: ReactFlow-based drag-and-drop workflow designer
- **15+ Node Types**: AI agent, human queue, conditional, safety check, integration
- **Workflow Validation**: Enforces safety rules at design time
- **Real-Time Execution**: Dynamic routing based on call context

### Medical Safety
- **60+ Medical Keywords**: Categorized by severity (emergency, clinical, mental health)
- **Automatic Escalation**: Enforced human routing for medical content
- **Design-Time Validation**: Prevents unsafe workflows from being published
- **Runtime Enforcement**: Medical triage guard monitors all conversations
- **Complete Audit Trail**: Every safety event logged for compliance

### Performance & Scale
- **Redis Caching**: Sub-second response times for repeat queries
- **Database Indexing**: Optimized queries for high-volume operations
- **WebSocket Real-Time**: Instant updates without polling
- **Horizontal Scaling**: Stateless architecture ready for multi-region

## HIPAA Compliance

This platform is designed for HIPAA compliance with the following requirements:

- **BAAs**: Required with Twilio, Microsoft Azure, and Vercel
- **Encryption**: TLS 1.3 everywhere, database encryption at rest
- **Access Controls**: RBAC with MFA via Clerk, role-based permissions
- **Audit Logging**: All PHI access, routing decisions, and safety events logged
- **Minimum Necessary**: Limited data collection and exposure
- **Retention**: Configurable per-hospital (default 30 days)
- **Safety Enforcement**: Multi-layer medical content guardrails

## Project Structure

```
wardline/
├── apps/
│   ├── web/                            # Next.js 14 frontend
│   │   ├── src/app/dashboard/agents/  # Agent management UI
│   │   ├── src/app/dashboard/queues/  # Queue monitoring
│   │   ├── src/app/dashboard/workflows/ # Workflow editor
│   │   ├── src/app/agent/dashboard/   # Human agent dashboard
│   │   └── src/lib/hooks/             # WebSocket & query hooks
│   ├── core-api/                      # NestJS REST API + WebSocket
│   │   ├── src/modules/agents/        # Agent CRUD & session tracking
│   │   ├── src/modules/queues/        # Queue & assignment management
│   │   ├── src/modules/workflows/     # Workflow execution & validation
│   │   ├── src/modules/safety/        # Medical triage guard
│   │   ├── src/modules/calls/         # Call session management
│   │   ├── src/websocket/             # WebSocket gateway
│   │   └── src/cache/                 # Redis caching service
│   └── voice-orchestrator-pipecat/    # Pipecat voice AI
│       ├── server.py                  # FastAPI server
│       ├── bot.py                     # Pipecat pipeline
│       ├── prompts.py                 # System prompts
│       └── core_api_client.py         # Core API integration
└── packages/
    ├── db/                            # Prisma ORM
    │   ├── prisma/schema.prisma       # 20+ models
    │   └── src/seed-agents.ts         # Agent seeding
    ├── types/                         # TypeScript types
    │   ├── src/domain.ts              # 50+ interfaces
    │   └── src/enums.ts               # Agent, queue, workflow enums
    ├── config/                        # Environment validation
    ├── utils/                         # Shared utilities
    └── ui/                            # Design system
```

## Testing

### Manual Testing

See [MANUAL_TESTING_GUIDE.md](MANUAL_TESTING_GUIDE.md) for comprehensive testing procedures.

### Automated Tests

Tests are located within each application:

```bash
# Run core-api tests
pnpm --filter @wardline/core-api test

# Run web tests
pnpm --filter @wardline/web test

# Run voice orchestrator tests
cd apps/voice-orchestrator-pipecat && pytest
```

### Test API Endpoints

```bash
# Test core API
node test-api-complete.js

# Test with authentication
.\test-with-token.ps1
```

## Deployment

### Vercel Deployment (Web)

```bash
cd apps/web
vercel deploy --prod
```

### Azure Deployment (API & Voice)

Deploy NestJS API and Pipecat voice orchestrator to Azure Container Apps:

```bash
# Core API
az containerapp create --name wardline-api \
  --resource-group wardline-rg \
  --environment wardline-env \
  --image wardline-api:latest \
  --target-port 3001

# Voice Orchestrator
az containerapp create --name wardline-voice \
  --resource-group wardline-rg \
  --environment wardline-env \
  --image wardline-voice:latest \
  --target-port 3002
```

### Environment Variables

Ensure all services have access to:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis cache connection
- `AZURE_SPEECH_KEY` & `AZURE_SPEECH_REGION`
- `AZURE_OPENAI_KEY` & `AZURE_OPENAI_ENDPOINT`
- `TWILIO_ACCOUNT_SID` & `TWILIO_AUTH_TOKEN`
- `CORE_API_BASE_URL` - Internal API endpoint
- `WEBHOOK_BASE_URL` - Public Twilio webhook URL

## Documentation

- [Implementation Summary](IMPLEMENTATION_SUMMARY_FINAL.md) - Complete feature overview
- [Multi-Agent Platform](MULTI_AGENT_IMPLEMENTATION_SUMMARY.md) - Detailed architecture
- [Manual Testing Guide](MANUAL_TESTING_GUIDE.md) - Testing procedures
- [Next Steps](NEXT_STEPS.md) - Roadmap and future enhancements

## License

Proprietary - All rights reserved
