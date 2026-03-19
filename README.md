# Wardline

AI voice receptionist SaaS platform for medical and dental clinics. Inbound calls are handled 24/7 by configurable AI agents that schedule appointments, answer FAQs, process billing inquiries, verify insurance, and log prescription refill requests — with a seamless handoff to a human (or voicemail) when needed.

No code required. Clinic owners configure call behavior visually.

## Platform Overview

```
┌────────────────────────────────────────────────────────────┐
│  INBOUND CALL → Pipecat Voice Orchestrator (Python)        │
│  ├─ Real-time speech recognition (Azure Speech)            │
│  ├─ AI receptionist (Azure OpenAI GPT-4)                   │
│  ├─ Natural TTS (Azure Neural Voices)                       │
│  ├─ One-problem-at-a-time conversation loop                 │
│  └─ Always-on emergency keyword detection                   │
│                         ↕                                   │
│  Core API (NestJS)                                          │
│  ├─ Agent catalog + deployed agent management               │
│  ├─ Visual workflow execution engine (13 node types)        │
│  ├─ Voicemail recording & notification                      │
│  ├─ Call log with turn-level detail                         │
│  └─ Safety guard (configurable keywords)                    │
│                         ↕                                   │
│  Web Dashboard (Next.js)                                    │
│  ├─ Agent catalog (browse & deploy agents)                  │
│  ├─ Active agents (configure tools, toggle on/off)          │
│  ├─ Visual call flow editor (ReactFlow)                     │
│  ├─ Call Logs with turn-level insight                       │
│  └─ Voicemail inbox                                         │
└────────────────────────────────────────────────────────────┘
```

## The 5 Starter Agents

| Agent | What it handles | Scope boundary |
|---|---|---|
| **Appointment Scheduling** | Book, reschedule, cancel | No symptoms, no clinical questions |
| **Billing & Payments** | Balance inquiries, payment processing | No disputes, no payment plan negotiation |
| **Insurance Verification** | Plan acceptance, basic coverage, claim/auth status | No denials, no appeals |
| **General FAQ & Info** | Hours, location, services, providers, prep instructions | No clinical advice |
| **Prescription Refill** | Log refill requests, check refill status | No new prescriptions, no clinical questions |

## Call Flow Model

Every inbound call follows this pattern:

```
Greet → Detect Intent → Route to Agent → Resolve Problem
      → "Anything else?" → Loop or End Call

At any point:
  Emergency keyword detected → 911 advisory (always enforced)
  Out-of-scope question → deflect + offer human transfer
  Human transfer → if no answer → Voicemail
```

## Project Structure

```
wardline/
├── apps/
│   ├── web/                            # Next.js 14 frontend
│   │   └── src/app/dashboard/
│   │       ├── agents/                 # Catalog + Active agents tabs
│   │       ├── calls/                  # Call Logs
│   │       ├── voicemails/             # Voicemail inbox
│   │       ├── workflows/              # Visual call flow editor
│   │       └── settings/               # Business settings
│   ├── core-api/                       # NestJS REST API
│   │   └── src/modules/
│   │       ├── agents/                 # Catalog + deployed agent CRUD
│   │       ├── businesses/             # Tenant management
│   │       ├── calls/                  # Call logs + voicemail endpoints
│   │       ├── workflows/              # Execution engine (13-node palette)
│   │       ├── safety/                 # Safety guard (emergency + out-of-scope)
│   │       ├── escalations/            # Human transfer + emergency escalation
│   │       ├── prescriptions/          # Agent 5 — refill requests
│   │       └── insurance/              # Agent 3 — insurance verification
│   └── voice-orchestrator-pipecat/    # Python/FastAPI + Pipecat
│       ├── server.py                   # FastAPI + Twilio webhook
│       ├── conversation_agent.py       # One-problem-at-a-time AI agent
│       └── call_context.py             # Call state + turn management
└── packages/
    ├── db/
    │   ├── prisma/schema.prisma        # Business, Agent, CallSession, VoicemailRecord
    │   └── src/seed-agents.ts          # 5 starter agent definitions + seeder
    ├── types/
    │   ├── src/domain.ts               # AgentCatalogItem, DeployedAgent, CallTurn, etc.
    │   └── src/enums.ts                # WorkflowNodeType (13 nodes), AgentCatalogId, etc.
    ├── config/                         # Environment validation
    └── utils/                          # Logging, error handling, audit trail
```

## Applications

### `apps/web` — Next.js 14 Dashboard (Port 3000)
- **Agents page**: Browse the catalog, deploy agents, configure tools (no code)
- **Call Logs**: All inbound calls with tag, agent, turns, outcome, duration
- **Voicemail inbox**: Listen, read transcription, call back
- **Call Flow editor**: Visual drag-and-drop workflow with 13 node types
- **Settings**: Business info, recording defaults, custom safety keywords

### `apps/core-api` — NestJS API (Port 3001)
- `GET /api/businesses/:id/agents` — list deployed agents
- `POST /api/businesses/:id/agents/deploy/:catalogId` — deploy a catalog agent
- `PATCH /api/businesses/:id/agents/:id/tool-config` — save tool credentials
- `GET /api/businesses/:id/call-logs` — paginated call log
- `GET /api/businesses/:id/voicemails` — voicemail inbox
- `POST /api/calls/:id/voicemail` — record voicemail (called by orchestrator)
- `POST /api/safety/check` — real-time safety check
- `POST /api/escalations/human-transfer` — initiate human transfer
- `POST /api/escalations/emergency` — flag emergency call

### `apps/voice-orchestrator-pipecat` — Python/FastAPI (Port 3002)
- Twilio media stream → Pipecat pipeline → Azure Speech STT → GPT-4 → Azure TTS
- Emergency check on every utterance (before LLM call)
- One-problem-at-a-time loop with continuation check node
- Voicemail recording when human transfer fails

## Node Palette (13 node types)

| Node | Purpose |
|---|---|
| `greeting` | Configurable welcome message |
| `intent-detect` | NLU classify caller intent → route to agent |
| `route` | Conditional branching |
| `continuation-check` | "Anything else?" loop gate |
| `collect-info` | Structured field collection |
| `confirmation` | Read back collected data |
| `knowledge-base` | FAQ lookup from configured knowledge base |
| `availability-check` | Calendar integration — offer open slots |
| `action` | Call an external tool (billing, EHR, etc.) |
| `human-transfer` | Warm/cold transfer with context |
| `voicemail` | Record message when no human available |
| `emergency-escalate` | 911 advisory (always-on, cannot be disabled) |
| `end-call` | Graceful close |

## Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Azure subscription (Azure AI Speech + Azure OpenAI)
- Twilio account
- Clerk account (auth)
- Stripe account (billing)

## Getting Started

```bash
# Install
pnpm install

# Environment
cp .env.example .env

# Database
pnpm db:generate
pnpm db:migrate

# Seed starter agents (run after first business is created)
pnpm db:seed

# Development
pnpm dev
```

Individual services:
```bash
pnpm --filter @wardline/web dev          # Port 3000
pnpm --filter @wardline/core-api dev     # Port 3001
cd apps/voice-orchestrator-pipecat && python server.py  # Port 3002
```

## Safety Architecture

The system enforces two layers of protection that **cannot be disabled** by any business owner:

1. **Emergency escalation** — A curated list of keywords (chest pain, seizure, suicidal, etc.) triggers an immediate 911 advisory and call escalation on every utterance, before any LLM processing.

2. **Out-of-scope deflection** — Clinical questions (symptoms, diagnoses, medication advice) are immediately deflected with an offer to transfer to a human. The AI agent never engages on these topics.

Business owners can *add* custom keywords to both lists via Business Settings, but cannot remove the system defaults.

## Deployment

### Vercel (Web)
```bash
cd apps/web && vercel deploy --prod
```

### Azure Container Apps (API + Voice)
```bash
az containerapp create --name wardline-api \
  --resource-group wardline-rg \
  --environment wardline-env \
  --image wardline-api:latest \
  --target-port 3001

az containerapp create --name wardline-voice \
  --resource-group wardline-rg \
  --environment wardline-env \
  --image wardline-voice:latest \
  --target-port 3002
```

### Required Environment Variables

| Variable | Used by |
|---|---|
| `DATABASE_URL` | core-api, db |
| `REDIS_URL` | core-api |
| `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` | voice-orchestrator |
| `AZURE_OPENAI_KEY` + `AZURE_OPENAI_ENDPOINT` | voice-orchestrator, core-api |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` | voice-orchestrator |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web, core-api |
| `STRIPE_SECRET_KEY` | core-api |
| `CORE_API_BASE_URL` | voice-orchestrator |
| `WEBHOOK_BASE_URL` | voice-orchestrator (Twilio webhook) |

## License

Proprietary — All rights reserved
