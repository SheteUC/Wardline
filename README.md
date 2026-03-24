# Wardline

Wardline is a Business-native AI voice receptionist platform for independent family medicine practices. The current V1 focuses on low-latency inbound call handling, operational reliability, and a controlled integration model instead of free-form agent behavior.

The system uses a shared US-only multi-tenant stack, one main workflow per business, English-only voice handling, athenahealth-first live connectors for supported categories, and a dashboard-first operations model for follow-up work.

## Current V1 Scope

- Target customer: independent family medicine practices
- Tenant model: `Business` only
- Geography: US only
- Language: English only
- Workflow model: one active main workflow per business
- Integration model: one configured vendor per category
- Voice runtime: Azure-first live voice path with a custom orchestrator
- After-hours urgent policy: no live urgent handling after hours; capture urgent voicemail and create a next-day queue item
- Data posture: compact summaries and operational metadata by default, with optional short transcript retention for debugging

## What Is Implemented

- Business-native contracts across the active web, core API, and voice runtime paths
- `GET /businesses/:id/runtime-config` for one-shot business runtime bootstrap
- Weekly operating hours stored in business settings
- Generic runtime actions for:
  - `appointment-request`
  - `refill-request`
  - `insurance-check`
  - `billing-request`
  - `manual-follow-up`
- Real connector health checks and normalized capability discovery for configured integrations
- Persisted follow-up tasks for:
  - urgent callbacks
  - manual review
  - appointment requests
  - refill requests
  - insurance checks
  - billing requests
- Dashboard queues for:
  - Urgent Calls
  - Voicemails
  - Follow-ups
  - Integrations
- Workflow compilation that translates integration nodes into vendor-agnostic runtime actions
- Voice confirmation handling so write actions do not execute until the caller explicitly confirms

## Runtime Flow

1. Twilio sends the inbound call to the Python voice orchestrator.
2. The orchestrator looks up the business by phone number.
3. The orchestrator loads `runtime-config`, including:
   - business profile
   - settings
   - operating hours
   - active workflow
   - integration categories and capabilities
4. A deterministic pre-LLM policy guard runs before normal conversation:
   - emergency phrase hit -> 911 / emergency redirect
   - after-hours urgent -> urgent voicemail + urgent follow-up task
   - after-hours non-urgent -> voicemail
   - business hours -> continue into workflow and runtime actions
5. The workflow and tools collect fields, summarize the requested action, and require confirmation for write operations.
6. The voice runtime calls a generic runtime-action endpoint on the Core API.
7. The Core API resolves the configured integration and either:
   - executes live if the connector is healthy and the capability is supported
   - creates a `FollowUpTask` if the action is unsupported, disconnected, too slow, or fails validation
8. The result is written back into:
   - the call session timeline
   - follow-up task metadata when fallback happens
   - dashboard queues for staff operations

## Safety And After-Hours Policy

- Emergency phrases are checked before the normal AI flow.
- After hours, urgent calls are not handled live in V1.
- The caller is instructed to use `911` or the ER for emergencies.
- Urgent after-hours calls become:
  - a priority voicemail
  - an urgent follow-up task
  - a next-day item in the `Urgent Calls` dashboard queue
- Non-urgent after-hours calls become a normal voicemail plus follow-up workflow when needed.

## Integration Model

Each business can configure one vendor per category.

| Category | V1 default vendor | Purpose |
| --- | --- | --- |
| `SCHEDULING` | `athenahealth` | Appointment requests and related scheduling actions |
| `EHR_REFILL` | `athenahealth` | Refill and EHR-adjacent request handling |
| `INSURANCE` | `athenahealth` | Live insurance acceptance / coverage checks |
| `BILLING` | `athenahealth` | Billing support requests |
| `KNOWLEDGE` | `wardline` | Internal FAQ / knowledge answers |

Business integrations are the source of truth. The active runtime uses:

- `vendor`
- `status`
- `credentialsRef`
- `settings`
- `capabilities`
- `lastHealthCheckAt`

`credentialsRef` is an environment-variable lookup key on the Core API host. Example:

```text
credentialsRef = ATHENAHEALTH_SCHEDULING_TOKEN
```

The current dashboard route `/dashboard/integration-failures` doubles as the minimal integration settings and health screen for this phase.

## Runtime Action Contract

All business runtime actions are exposed under:

```text
/api/businesses/:businessId/runtime-actions/*
```

Implemented endpoints:

- `POST /api/businesses/:businessId/runtime-actions/appointment-request`
- `POST /api/businesses/:businessId/runtime-actions/refill-request`
- `POST /api/businesses/:businessId/runtime-actions/insurance-check`
- `POST /api/businesses/:businessId/runtime-actions/billing-request`
- `POST /api/businesses/:businessId/runtime-actions/manual-follow-up`

Write actions require `confirmed: true`.

Standard response shape:

```json
{
  "ok": true,
  "handledLive": false,
  "fallbackCreated": true,
  "requiresStaffFollowUp": true,
  "message": "I have captured your billing request for staff follow-up.",
  "integration": {
    "category": "BILLING",
    "vendor": "athenahealth",
    "status": "CONNECTED",
    "capabilities": {}
  },
  "data": {},
  "followUpTaskId": "task_123"
}
```

## Main API Surfaces

### Business bootstrap

- `GET /businesses/by-phone`
- `GET /businesses/:id`
- `PATCH /businesses/:id/settings`
- `GET /businesses/:id/runtime-config`

### Integrations

- `GET /api/businesses/:businessId/integrations`
- `GET /api/businesses/:businessId/integrations/:category`
- `PUT /api/businesses/:businessId/integrations/:category`
- `POST /api/businesses/:businessId/integrations/:category/test`

### Operational queues

- `GET /api/businesses/:businessId/follow-up-tasks`
- `POST /api/businesses/:businessId/follow-up-tasks`
- `PATCH /api/businesses/:businessId/follow-up-tasks/:id/status`
- `GET /api/businesses/:businessId/call-logs`
- `GET /api/businesses/:businessId/call-logs/analytics`
- `GET /api/businesses/:businessId/call-logs/:id`
- `GET /api/businesses/:businessId/voicemails`
- `PATCH /api/voicemails/:id/mark-listened`

### Voice orchestrator callbacks

- `POST /api/calls`
- `PATCH /api/calls/:id`
- `POST /api/calls/:id/transcript`
- `POST /api/calls/:id/voicemail`
- `POST /api/handoffs`

## Workflow System

The workflow editor is still visual, but integration nodes no longer represent ad hoc vendor endpoints. They now compile into generic runtime actions.

New integration-node model:

- `runtimeAction`
- `integrationCategory`
- `requiresConfirmation`
- `fallbackBehavior`
- `prompt`

Legacy vendor-style configs can still be translated during compilation for compatibility, but new work should use runtime-action nodes only.

## Dashboard

The current dashboard is API-backed and centered on operational work:

- `/dashboard`
- `/dashboard/calls`
- `/dashboard/urgent-calls`
- `/dashboard/voicemails`
- `/dashboard/follow-ups`
- `/dashboard/integration-failures`
- `/dashboard/workflows`
- `/dashboard/settings`

Notable operational behaviors:

- `Urgent Calls` is backed by persisted `FollowUpTask` records, not derived call filters
- `Follow-ups` shows fallback reason, originating runtime action, and integration vendor metadata
- `Voicemails` link to follow-up task status and runtime fallback metadata when present
- `Workflow Settings` includes weekly operating-hours editing, recording defaults, transcript retention, and custom emergency / out-of-scope keywords

## Repository Layout

```text
apps/
  web/
    src/app/dashboard/               Next.js dashboard
    src/components/workflow/         Workflow editor and config panels
    src/lib/                        Business-aware API client and query hooks

  core-api/
    src/modules/businesses/          Business settings and runtime-config
    src/modules/calls/               Call logs, voicemail records, call session endpoints
    src/modules/follow-up-tasks/     Persisted operational queues
    src/modules/integrations/        Connector registry, settings, health checks
    src/modules/runtime-actions/     Generic live actions + follow-up fallback
    src/modules/workflows/           Workflow compile, validate, publish, simulate

  voice-orchestrator-pipecat/
    server.py                        Twilio webhook + after-hours policy + confirmation flow
    call_context.py                  Canonical Business-native call context
    core_api_client.py               Runtime-config and runtime-action client
    tools.py                         Voice tools with confirmation gating
    node_executors.py                Workflow executor runtime-action bridge
    flow_manager.py                  Workflow loading and execution

packages/
  db/                               Prisma schema and generated client
  types/                            Shared enums and types
  config/                           Environment schemas
  utils/                            Logging and helpers
```

## Local Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3.11+
- PostgreSQL 14+
- Redis
- Twilio account
- Azure Speech
- Azure OpenAI and/or Azure AI Foundry
- Clerk

### Install

```bash
pnpm install
python -m pip install -r apps/voice-orchestrator-pipecat/requirements.txt
```

### Database

```bash
pnpm db:generate
pnpm db:migrate
```

If you have an older local Wardline database from the pre-`Business` migration history, reset the local Docker volumes before rerunning migrations:

```bash
docker compose down -v
docker compose up -d postgres redis
```

### Run services

```bash
pnpm --filter @wardline/web dev
pnpm --filter @wardline/core-api dev
cd apps/voice-orchestrator-pipecat && python server.py
```

Default local ports:

- Web: `http://localhost:3000`
- Core API: `http://localhost:3001`
- Voice orchestrator: `http://localhost:3002`

## Environment Variables

### Shared / database

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Required by Prisma and the Core API |
| `REDIS_URL` | Optional but recommended; Core API falls back to in-memory cache if missing |
| `NODE_ENV` | `development`, `test`, or `production` |

### Web

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Usually `http://localhost:3001` locally |
| `NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL` | Usually `http://localhost:3002` locally |
| `NEXT_PUBLIC_CORE_API_URL` | Used by some websocket hooks |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth |
| `CLERK_SECRET_KEY` | Required server-side in Next.js |

### Core API

| Variable | Notes |
| --- | --- |
| `PORT` | Defaults to `3001` |
| `CLERK_SECRET_KEY` | Auth |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Optional if using Clerk webhooks |
| `WEB_BASE_URL` or `WEB_URL` | Used for CORS / websocket allowlist |
| `AZURE_OPENAI_KEY` | Required for current Core API env schema |
| `AZURE_OPENAI_ENDPOINT` | Required for current Core API env schema |
| `AZURE_OPENAI_DEPLOYMENT` | Required for current Core API env schema |
| `STRIPE_SECRET_KEY` | Required by current Core API env schema |
| `STRIPE_WEBHOOK_SECRET` | Required by current Core API env schema |

### Voice orchestrator

| Variable | Notes |
| --- | --- |
| `PORT` | Defaults to `3002` |
| `CORE_API_BASE_URL` | Core API base URL |
| `WEBHOOK_BASE_URL` | Public URL for Twilio callbacks / media streams |
| `USE_STREAMING` | `true` for Twilio Media Streams, otherwise Gather fallback |
| `VOICE_AGENT_TYPE` | `azure_ai_foundry`, `conversational`, or `langchain_tools` |
| `TWILIO_ACCOUNT_SID` | Twilio |
| `TWILIO_AUTH_TOKEN` | Twilio |
| `TWILIO_PHONE_NUMBER` | Twilio number |
| `AZURE_SPEECH_KEY` | Azure Speech |
| `AZURE_SPEECH_REGION` | Azure Speech region |
| `AZURE_EXISTING_AIPROJECT_ENDPOINT` | Azure AI Foundry project endpoint |
| `AZURE_EXISTING_AGENT_ID` | Azure AI Foundry agent identifier |
| `AZURE_OPENAI_KEY` | Needed for conversational / langchain modes and parts of streaming |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Azure OpenAI deployment |
| `AZURE_OPENAI_API_VERSION` | Defaults in `config.py` |

### Integration secrets

Each configured `credentialsRef` should map to an environment variable available to the Core API process. Example:

```text
ATHENAHEALTH_SCHEDULING_TOKEN=...
ATHENAHEALTH_REFILL_TOKEN=...
ATHENAHEALTH_INSURANCE_TOKEN=...
ATHENAHEALTH_BILLING_TOKEN=...
```

## Verification

These are the main checks for the current V1 runtime:

```bash
pnpm exec tsc --noEmit -p apps/core-api/tsconfig.json
pnpm exec tsc --noEmit -p apps/web/tsconfig.json
python -m py_compile \
  apps/voice-orchestrator-pipecat/call_context.py \
  apps/voice-orchestrator-pipecat/core_api_client.py \
  apps/voice-orchestrator-pipecat/tools.py \
  apps/voice-orchestrator-pipecat/server.py \
  apps/voice-orchestrator-pipecat/node_executors.py \
  apps/voice-orchestrator-pipecat/flow_manager.py
```

If `pytest` is installed in your Python environment, the focused voice runtime tests are:

```bash
python -m pytest apps/voice-orchestrator-pipecat/tests/unit/test_tools.py
python -m pytest apps/voice-orchestrator-pipecat/tests/unit/test_flow_manager.py
python -m pytest apps/voice-orchestrator-pipecat/tests/unit/test_node_executors.py
```

## Known V1 Constraints

- No live human queueing or staff presence management yet
- No bilingual runtime yet
- No multi-vendor routing within a category
- No live after-hours urgent transfer in V1
- Manual integration credential provisioning only
- Some legacy `hospital` compatibility shims still exist outside the active path, but new work should use `Business` terminology and Business-scoped APIs only

## License

Proprietary. All rights reserved.
