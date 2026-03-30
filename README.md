# Wardline

Wardline is a Business-native AI voice receptionist platform for independent family medicine practices. The current product focuses on operational reliability, controlled integration behavior, and a Practice Setup-first model instead of customer-authored workflows or free-form agent behavior.

The system uses a shared US-only multi-tenant stack, one generated runtime workflow per business, English-only voice handling, athenahealth-first live connectors for supported categories, and a dashboard-first operations model for follow-up work.

## Current V1 Scope

- Target customer: independent family medicine practices
- Tenant model: `Business` only
- Geography: US only
- Language: English only
- Workflow model: one generated active runtime workflow per business
- Integration model: one configured vendor per category
- Voice runtime: internal Voice Runtime V2 only, proven first through the local/session harness
- After-hours urgent policy: no live urgent handling after hours; capture urgent voicemail and create a next-day queue item
- Data posture: compact summaries and operational metadata by default, with optional short transcript retention for debugging

## What Is Implemented

- Business-native contracts across the active web, core API, and voice runtime paths
- Practice Setup as the customer-facing source of truth for hours, policies, integrations, and FAQs
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
- Generated runtime workflows compiled from practice settings and translated into vendor-agnostic runtime actions
- Voice confirmation handling so write actions do not execute until the caller explicitly confirms

## Runtime Flow

1. Twilio sends the inbound call to the active voice runtime.
2. The runtime looks up the business by phone number.
3. The runtime loads `runtime-config`, including:
   - business profile
   - settings
   - operating hours
   - generated active runtime workflow
   - integration categories and capabilities
4. A deterministic policy guard runs before normal conversation:
   - emergency phrase hit -> 911 / emergency redirect
   - after-hours urgent -> urgent voicemail + urgent follow-up task
   - after-hours non-urgent -> voicemail
   - business hours -> continue into the generated runtime workflow and runtime actions
5. The active runtime uses Practice Setup policy, generated runtime data, and internal specialist logic to collect fields, summarize the requested action, and require confirmation for write operations.
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
- Non-urgent after-hours calls become a normal voicemail plus staff follow-up when needed.

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

## Internal Runtime Workflow System

Normal customers do not author workflows in V1. Practice Setup is the customer-facing source of truth, and Wardline compiles one generated published runtime workflow per business behind the scenes.

Internal workflow tooling still exists for advanced testing and migration support. Its integration nodes no longer represent ad hoc vendor endpoints. They compile into generic runtime actions.

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
- `/dashboard/settings`

Notable operational behaviors:

- `Urgent Calls` is backed by persisted `FollowUpTask` records, not derived call filters
- `Follow-ups` shows fallback reason, originating runtime action, and integration vendor metadata
- `Voicemails` link to follow-up task status and runtime fallback metadata when present
- `Practice Setup` includes weekly operating-hours editing, recording defaults, transcript retention, service policies, FAQs, and custom emergency / out-of-scope keywords

## Repository Layout

```text
apps/
  web/
    src/app/dashboard/               Next.js dashboard
    src/lib/                        Business-aware API client and query hooks

  core-api/
    src/modules/businesses/          Business settings and runtime-config
    src/modules/calls/               Call logs, voicemail records, call session endpoints
    src/modules/follow-up-tasks/     Persisted operational queues
    src/modules/integrations/        Connector registry, settings, health checks
    src/modules/runtime-actions/     Generic live actions + follow-up fallback
    src/modules/workflows/           Generated runtime artifact support
  voice-runtime-v2/
    server.py                        FastAPI control plane and transport bootstrap
    service.py                       Supervisor + specialist orchestration
    agents.py                        Internal specialist agents and routing logic
    core_api_client.py               Runtime-config and runtime-action bridge for V2

packages/
  db/                               Prisma schema and generated client
  types/                            Shared enums and types
  config/                           Environment schemas
  utils/                            Logging and helpers
```

## Local Development

### Prerequisites

- Node.js 20.x
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
python -m pip install -r apps/voice-runtime-v2/requirements.txt
```

### Environment

Use the repo-root `.env.local` or `.env` as the canonical local configuration file.

- `apps/core-api/.env`, `apps/web/.env.local`, and `packages/db/.env` are deprecated for local development and ignored by the loaders.
- The Core API and Prisma now load only the root env files.
- The web app injects its public runtime variables from the root env files.
- Voice Runtime V2 loads from the root env files.
- Set `WARDLINE_WARN_ON_DEPRECATED_ENV_FILES=true` locally if you want explicit warnings while those ignored files still exist.

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
pnpm voice:v2:dev
```

Default local ports:

- Web: `http://localhost:3000`
- Core API: `http://localhost:3001`
- Voice Runtime V2: `http://localhost:3003`

### Voice Runtime V2

Voice Runtime V2 is the supported live voice runtime. It keeps Practice Setup and runtime actions intact while replacing the old live voice layer completely.

```bash
pnpm voice:v2:dev
```

Current validation for the V2 service uses its session/bootstrap harness:

```bash
pnpm voice:v2:preflight
pnpm voice:v2:proof
pnpm test:voice:v2
```

Telephony cutover is now driven by the V2 service itself:

- `POST /telephony/twilio/bootstrap` returns the TwiML `<Connect><Stream>` response for inbound calls
- `WS /telephony/twilio/media` accepts the Twilio media stream and feeds provider-backed transcripts into the V2 turn loop
- the first real-call proof target is: real Twilio + LiveKit/Deepgram-ready transport + mock-backed runtime actions

The V2 scripts reuse the archived voice virtualenv automatically when `apps/voice-orchestrator-pipecat/venv` exists. You can still override the interpreter with `WARDLINE_VOICE_PYTHON=/path/to/python`.

### Mock Connector Smoke Flow

The recommended local acceptance path for this phase uses the built-in mock integration server instead of real vendor credentials.

1. Start the mock integration server in its own terminal:

```bash
pnpm mock:integrations
```

2. Seed the smoke fixture:

```bash
pnpm db:seed:smoke
```

This creates:

- one owner user membership for local sign-in
- one business
- one phone number
- one generated published runtime workflow compiled from practice settings
- one integration per category pointed at the mock integration service

3. Start the web app, Core API, and Voice Runtime V2.
4. Open the integration screen and run a health check if you want to confirm capabilities manually.
5. Run the smoke commands or manual call flows described below.

### Staging Validation Flow

Use the staging preflight and seed path when moving from mock validation to real secrets:

```bash
pnpm test:staging:preflight
pnpm db:seed:staging
```

The canonical pilot gate lives in [docs/PILOT_READINESS.md](./docs/PILOT_READINESS.md).
The full staging matrix lives in [docs/STAGING_VALIDATION.md](./docs/STAGING_VALIDATION.md).
Operational response steps live in [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md).
Pilot proof now includes both technical validation and receptionist-quality review:

- voice confirmation repair and caller recovery
- direct answers for common practice questions like hours and supported services
- operator-facing call detail pages that explain what happened and what staff should do next

Do not resume broader feature work until both the staging gate and the pilot-quality review pass.

## Environment Variables

### Shared / database

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Required by Prisma and the Core API |
| `REDIS_URL` | Recommended for the local happy path; defaults to `redis://localhost:6379` in Core API development mode |
| `NODE_ENV` | `development`, `test`, or `production` |

### Web

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Usually `http://localhost:3001` locally |
| `NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL` | Usually `http://localhost:3003` locally |
| `NEXT_PUBLIC_CORE_API_URL` | Core API origin for web helpers |
| `NEXT_PUBLIC_WEB_BASE_URL` | Public-facing web origin; defaults to `WEB_BASE_URL` for staging env preflight |
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

### Voice Runtime V2

| Variable | Notes |
| --- | --- |
| `VOICE_RUNTIME_V2_PORT` | Defaults to `3003` |
| `CORE_API_BASE_URL` | Core API base URL |
| `VOICE_RUNTIME_V2_PUBLIC_URL` or `WEBHOOK_BASE_URL` | Public URL for Twilio/media callbacks |
| `TWILIO_ACCOUNT_SID` | Twilio |
| `TWILIO_AUTH_TOKEN` | Twilio |
| `TWILIO_PHONE_NUMBER` | Twilio number |
| `LIVEKIT_URL` | LiveKit server URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `LIVEKIT_TOKEN_TTL_MINUTES` | Access-token TTL for the V2 transport session |
| `DEEPGRAM_API_KEY` | Deepgram streaming STT |
| `DEEPGRAM_STT_MODEL` | Defaults to `nova-2-phonecall` |
| `DEEPGRAM_TTS_MODEL` | Defaults to `aura-2-thalia-en` |
| `TWILIO_MEDIA_STREAM_PATH` | Defaults to `/telephony/twilio/media` |
| `AZURE_SPEECH_KEY` | Optional managed speech fallback |
| `AZURE_SPEECH_REGION` | Optional managed speech fallback region |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT` | Defaults to `gpt-4o-mini` |

### Integration secrets

Each configured `credentialsRef` should map to an environment variable available to the Core API process. Example:

```text
ATHENAHEALTH_SCHEDULING_TOKEN=...
ATHENAHEALTH_REFILL_TOKEN=...
ATHENAHEALTH_INSURANCE_TOKEN=...
ATHENAHEALTH_BILLING_TOKEN=...
```

## Verification

These are the main checks for the supported V2 runtime:

```bash
pnpm test:smoke:typecheck
pnpm test:smoke:db
python -m py_compile \
  apps/voice-runtime-v2/config.py \
  apps/voice-runtime-v2/core_api_client.py \
  apps/voice-runtime-v2/providers.py \
  apps/voice-runtime-v2/server.py \
  apps/voice-runtime-v2/service.py \
  apps/voice-runtime-v2/agents.py
pnpm test:smoke:api
pnpm test:smoke:web
pnpm test:voice:v2
pnpm test:smoke:local
```

The voice smoke commands use the archived voice virtualenv automatically when `apps/voice-orchestrator-pipecat/venv` exists. You can override the interpreter with `WARDLINE_VOICE_PYTHON=/path/to/python` if needed.

Install V2 voice requirements, which include the Python runtime dependencies used by the smoke path:

```bash
python -m pip install -r apps/voice-runtime-v2/requirements.txt
```

For staging preflight, verify the required environment variables first:

```bash
pnpm test:staging:env
pnpm voice:v2:preflight
```

Focused voice runtime tests are:

```bash
node scripts/run-voice-v2-python.js -m unittest discover apps/voice-runtime-v2/tests -v
```

### Manual Smoke Checklist

Use this sequence as the local release gate until broader end-to-end automation exists:

1. Start Docker Postgres and Redis.
2. Run `pnpm db:migrate`.
3. Run `pnpm test:smoke:db`.
4. Start the mock integration server with `pnpm mock:integrations`.
5. Run `pnpm db:seed:smoke`.
6. Start the web app, Core API, and Voice Runtime V2.
7. Sign in and let the first authenticated request auto-provision the local user.
8. Confirm the smoke business is visible and selected automatically, or create a business manually if you are not using the smoke seed.
9. Open `/dashboard/integration-failures`, run a health check, and confirm the integration status becomes `CONNECTED`.
10. Open `/dashboard/settings` and confirm the Practice Setup readiness checklist reflects the configured hours, policies, integrations, and knowledge content.
11. Run the Voice Runtime V2 validation flow, then confirm:
   - the call appears in call logs
   - live runtime actions record their outcomes
   - fallback scenarios create follow-up tasks with the correct fallback reason
   - voicemail links to the follow-up task when after-hours behavior is triggered
   - the V2 session bootstrap exposes transport metadata for LiveKit / Twilio cutover
   - the inbound Twilio bootstrap endpoint returns TwiML that points at the V2 media websocket
12. Open the `Urgent Calls`, `Follow-ups`, and `Voicemails` queues and confirm the dashboard reflects the mock outcomes cleanly.

### Telephony Cutover Checklist

Use this sequence for the first provider-backed V2 call:

1. Start a local HTTPS tunnel to port `3003`. Example:
   - `ngrok http 3003`
2. Set both `VOICE_RUNTIME_V2_PUBLIC_URL` and `WEBHOOK_BASE_URL` to the tunnel URL.
3. Seed a business with `voicePolicyV2` and confirm the business phone number matches the Twilio number.
4. Start `pnpm mock:integrations`.
5. Run `pnpm voice:v2:preflight`.
6. Run `pnpm voice:v2:proof` to print the exact Twilio bootstrap URL and dashboard review path.
7. Start `pnpm voice:v2:dev`.
8. Point the Twilio number voice webhook at the printed bootstrap URL.
9. Place one real inbound scheduling call and confirm:
   - the call reaches V2
   - the caller hears the greeting
   - the supervisor routes to scheduling
   - the caller confirms an appointment request
   - the mock scheduling action succeeds live
   - call detail shows operator summary plus transport metadata

## Known V2 Constraints

- Real provider-backed telephony still depends on real Twilio, LiveKit, and Deepgram credentials plus public callback wiring
- No bilingual runtime yet
- No multi-vendor routing within a category
- No live human queueing or staff presence management yet
- Manual integration credential provisioning only
- Active web, Core API, and voice runtime paths are `Business`-native; the next milestone after one real call is the full staging gate

## License

Proprietary. All rights reserved.
