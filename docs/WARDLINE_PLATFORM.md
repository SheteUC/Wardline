# Wardline Platform Guide

Single canonical reference for product scope, architecture, voice runtime (including hybrid LLM), safety, deployment, compliance, and known gaps. Update this file when behavior or infrastructure changes.

---

## 1. Product scope (V1)

- **Customer:** Independent US family medicine practices.
- **Tenant model:** `Business` only; shared multi-tenant stack.
- **Language:** English only.
- **Workflow:** One generated published runtime workflow per business; Practice Setup is the customer-facing source of truth (no customer-authored agent graphs).
- **Voice:** Internal **Voice Runtime V2** only (legacy Gather/streaming runtimes archived).
- **After hours:** No live urgent handling; urgent voicemail + follow-up; non-urgent voicemail.
- **Data:** Compact summaries and operational metadata by default; optional transcript retention per business settings.

---

## 2. Repository layout

```text
apps/
  web/                 Next.js dashboard + Clerk
  core-api/            NestJS API, Prisma, runtime actions, call ingest
  voice-runtime-v2/    FastAPI: Twilio media, Deepgram STT, orchestration, LLM bridge
packages/
  db/                  Prisma schema + migrations
  config/, types/, utils/
```

**Runtime actions (write path):** `appointment-request`, `refill-request`, `insurance-check`, `billing-request`, `manual-follow-up` under `/api/businesses/:businessId/runtime-actions/*`. Writes require `confirmed: true`.

---

## 3. Voice Runtime V2 — architecture

### 3.1 Telephony path

1. Twilio → `POST /telephony/twilio/bootstrap` → TwiML `<Connect><Stream>` → `WS /telephony/twilio/media`.
2. Media bridge streams audio to Deepgram; transcripts feed the turn loop in `service.py`.
3. Core API: bootstrap session, ingest events/transcripts, runtime actions, voicemail.

### 3.2 Internal agents (rule-based layer)

- **SupervisorAgent** — keyword/rule routing (fallback when LLM disabled or fails).
- **SafetyAgent** — regex/pattern emergency and urgent-clinical triage.
- **SchedulingAgent, RefillAgent, InsuranceAgent, BillingAgent** — slot filling and confirmation flows.
- **KnowledgeAgent** — FAQ / policy text from `voicePolicyV2`.
- **HandoffAgent** — transfer, callback, after-hours paths.

Only one “voice” speaks to the caller; specialists return structured `SpecialistResult` objects.

### 3.3 Hybrid LLM layer (optional, feature-flagged)

| Component | Module | Purpose |
|-----------|--------|---------|
| Supervisor LLM | `llm_supervisor.py` | Routes turns to domain/mode; multi-intent; slot hints (`llmSlotEnrichment`). |
| Safety LLM | `llm_safety.py` | Semantic safety after regex misses (crisis language). |
| Slot LLM | `llm_slots.py` | Structured slot extraction before rule specialists (when agent LLM does not run). |
| Specialist LLMs | `llm_agents.py` | Per-domain prompts with conversation + practice policy + **caller context**. |

**Environment flags** (see repo-root `.env.example`):

- `VOICE_LLM_SUPERVISOR`, `VOICE_LLM_SAFETY`, `VOICE_LLM_SLOTS`, `VOICE_LLM_AGENTS`
- `VOICE_LLM_TIMEOUT_SECONDS`
- `LLM_PROVIDER` (`auto` / `openai` / `azure`), `OPENAI_*`, `AZURE_OPENAI_*`

**Env load order (voice runtime):** Root `.env` first, then `.env.local` with override so a blank key in `.env.local` does not block values from `.env`.

### 3.4 Caller context (cross-call memory, tenant-scoped)

- **API:** `GET /api/internal/voice/caller-context?businessId=&callerPhone=` (Core API).
- **Client:** `core_api_client.get_caller_context()`.
- **Session:** `SessionState.callerContext` populated at `start_session`; includes recent calls, known medications/refills, recent insurance inquiry hints, name/DOB on file when present.
- **Isolation:** Queries are always scoped by `businessId` + phone; two practices never share context.

### 3.5 Turn pipeline (efficiency)

1. Regex **SafetyAgent** (instant). If hit → handle safety.
2. In parallel: **LLM safety** + **supervisor** (`route_turn_llm` via `_choose_domain`). If LLM safety hits first → return; supervisor work is discarded if safety triggers.
3. Rule supervisor fallback if LLM routing returns `None` or is disabled.
4. **LLM specialist agent** (`run_llm_agent`) if enabled; on success, slots merged and **standalone `extract_slots_llm` is skipped** for that turn.
5. Else: `extract_slots_llm` → rule-based specialist.

### 3.6 Listening and end-of-utterance (avoid cutting callers off)

- **Deepgram:** `DEEPGRAM_ENDPOINTING_MS` (default 1200) — silence before a chunk is marked final.
- **Deepgram:** `DEEPGRAM_UTTERANCE_END_MS` (default 1500) — `utterance_end_ms` query param; `UtteranceEnd` events flush the buffer.
- **Telephony:** `TwilioMediaSession` accumulates consecutive finals into `_utterance_buffer` with a short settle delay (`_UTTERANCE_SETTLE_SECONDS`, 0.8s) before one merged `process_transcript_turn(..., final=True)`.

Partial transcripts still call `process_transcript_turn` with `final=False` (no reply).

### 3.7 Patient safety — emergencies

- Regex + LLM safety can classify **emergency** (911 / 988 guidance).
- On **emergency** severity, the runtime calls **`_begin_final_close`** with `reason="emergency-detected"` and tag `EMERGENCY`: session enters **closing**; further caller text is ignored after close; 911/988 message is still spoken via TTS.
- Manual follow-up events are created when configured on the safety result.

### 3.8 Session storage limitations (known)

- Sessions live in an **in-process dict** (`VoiceRuntimeV2.sessions`). Not shared across workers; lost on restart.
- `finalize_session` does not remove entries from the dict (memory growth until process restart).
- No per-session `asyncio.Lock` today; concurrent transcript + HTTP on same session can race.

---

## 4. Core API — notable surfaces

- Business: `GET /businesses/by-phone`, `GET /businesses/:id/runtime-config`, settings PATCH.
- Dashboard data: call logs, voicemails, follow-ups, integrations.
- Internal voice: `POST /api/internal/voice/bootstrap`, `GET /api/internal/voice/caller-context`, `POST /api/internal/calls/:id/ingest`.
- Cutover health: `GET /api/internal/calls/cutover-health`.

---

## 5. Deployment

**Topology**

- `apps/web` → Vercel.
- `apps/core-api` and `apps/voice-runtime-v2` → long-running hosts (e.g. Render per `render.yaml`: Postgres, Redis, both APIs).

**Do not** deploy the voice runtime to Vercel (WebSockets, long-lived state).

**Render blueprint** (`render.yaml`)

- Services: `wardline-postgres`, `wardline-redis`, `wardline-core-api`, `wardline-voice-runtime-v2`, `wardline-web` (optional; same blueprint as APIs — set `NEXT_PUBLIC_*` and Clerk/PostHog/Stripe publishable keys).
- Voice runtime can use `RENDER_EXTERNAL_URL` for public URL; `CORE_API_HOSTPORT` for private API reachability.
- Prompted secrets: Clerk (core-api), Twilio / LiveKit / Deepgram (voice).

**Health checks**

- Core API: `GET /health` (liveness, no I/O); `GET /ready` (Postgres `SELECT 1` + Redis when `REDIS_URL` is set — returns **503** if a required check fails). Cutover: `GET /api/internal/calls/cutover-health`.
- Voice: `GET /health` (process up); `GET /ready` (preflight + LiveKit/Twilio/Deepgram/TTS + Redis if configured + core-api `GET /health` — **503** when not ready).
- Web (Docker / Render): `GET /api/health`.

**Vercel (web)**

- Root directory: `apps/web`.
- Set `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CORE_API_URL`, `NEXT_PUBLIC_VOICE_RUNTIME_URL` (legacy: `NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL`), `NEXT_PUBLIC_WEB_BASE_URL`, Clerk keys.

**After Vercel exists:** Set `WEB_BASE_URL` on Core API to the Vercel origin and redeploy (CORS / webhooks).

**Twilio voice webhook:** `https://<voice-runtime-host>/telephony/twilio/bootstrap`

**Rollout commands (order)**

1. `pnpm --filter @wardline/db migrate:deploy`
2. `pnpm db:backfill:call-events`
3. `pnpm db:verify:call-projections`
4. `pnpm test:smoke`
5. `pnpm voice:v2:proof`

**Feature flags (call projection / legacy sync)**

- `CALLS_ENABLE_PROJECTION_FALLBACK`
- `VOICE_RUNTIME_LEGACY_CALL_SYNC`
- `RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS`

Staged rollout: start all `true`; then disable legacy dual-write flags; finally disable projection fallback when metrics are clean. See logs mentioned in cutover-health and Core API logs for projection/ingest failures.

---

## 6. Local development (quick)

**Prerequisites:** Node 20+, pnpm 8+, Python 3.11+, Postgres, Redis, Twilio/Clerk/Deepgram keys as needed.

```bash
pnpm install
python -m pip install -r apps/voice-runtime-v2/requirements.txt
pnpm db:generate && pnpm db:migrate
```

**Env:** Repo-root `.env` / `.env.local` only (per-app env files deprecated).

**Run**

```bash
pnpm --filter @wardline/web dev          # :3000
pnpm --filter @wardline/core-api dev     # :3001
pnpm voice:v2:dev                        # :3003
```

**Mock integrations:** `pnpm mock:integrations` + `pnpm db:seed:smoke`.

**Voice proof:** `pnpm voice:v2:preflight`, `pnpm voice:v2:proof`, `pnpm test:voice:v2`. Real call: tunnel `ngrok http 3003`, set `VOICE_RUNTIME_V2_PUBLIC_URL` and `WEBHOOK_BASE_URL` to tunnel URL, point Twilio webhook at printed bootstrap URL.

---

## 7. Pilot, staging, and operations

### 7.1 Pilot gate (go / no-go)

All must be green before expanding pilot traffic:

- `pnpm test:smoke`, `pnpm test:smoke:db`, `pnpm test:staging:env`
- `pnpm db:seed:staging` when using staging tenant
- At least one end-to-end provider-backed Voice Runtime V2 call (scheduling + confirmation + mock/live action + dashboard visibility)
- Staging validation matrix (live + fallback for scheduling/refill/insurance/billing; receptionist-quality cases; queues)
- Compliance + operations signoff (see §8)

### 7.2 Staging preflight

```bash
pnpm test:staging:preflight
pnpm db:seed:staging
```

Seed defaults use `STAGING_*` variables from `.env.example`.

### 7.3 Operations runbook (summary)

- **Telephony rollback:** Point Twilio away from `/telephony/twilio/bootstrap` to approved fallback; preserve evidence; proof call before restore.
- **Secret rotation:** Rotate in provider → update all env stores → redeploy core-api + voice-runtime → `pnpm voice:v2:preflight` + health checks + proof call.
- **Degraded connectors:** Treat failures as manual follow-up; review urgent calls, voicemails, follow-ups; document outage window.
- **Daily pilot:** Named owners for queue review, telephony incidents, secret rotation, staff comms.

---

## 8. HIPAA-relevant notes (not legal advice)

- **BAAs:** Required for vendors that touch PHI (Twilio HIPAA account, Azure in covered boundary, Postgres host, etc.). Vercel/Clerk typically **not** BAA-covered — keep PHI out of those tiers beyond transient browser use.
- **Encryption:** TLS for all public HTTP/WSS; DB SSL in production; Redis TLS when deployed.
- **Audit:** `AuditInterceptor` + `AuditService`; `audit_logs` append-only (DB triggers prevent update/delete).
- **Caching:** Call lists, detail, transcripts, voicemails bypass Redis; some business/config keys are cached — see Core API cache service for exact keys.
- **Retention:** `transcriptRetentionDays` per business; nightly task `transcript-retention.task.ts` deletes old transcript segments and audit-logs cleanup. Validate with `pnpm --filter @wardline/core-api test -- --runInBand tasks/transcript-retention.task.spec.ts` and `pnpm test:smoke:db`.
- **Incident:** Revoke credentials, disable affected path, preserve `audit_logs`, notify per legal/process.

---

## 9. Known gaps and improvement backlog

Prioritized engineering debt (from platform review):

| Priority | Topic | Notes |
|----------|--------|------|
| **Critical** | Cross-tenant authorization | Many `:businessId` routes need explicit membership checks; risk of IDOR if `businessId` is guessed. |
| **Critical** | Rate limiting | None on Core API public/internal routes; add throttling for bootstrap/ingest/runtime-actions. |
| **Critical** | Twilio WS / webhook auth | Media WebSocket and some webhooks lack signature validation; session IDs guessable. |
| **High** | Shared session store | Redis or similar for voice sessions; sticky routing alone is insufficient at scale. |
| **High** | Session memory | Remove or TTL completed sessions from in-memory dict. |
| **High** | Per-session concurrency lock | Prevent races between transcript loop and HTTP turns. |
| **High** | Retries | Transient failures on LLM, httpx, TTS — add bounded retries. |
| **High** | Deepgram reconnect | Currently stops receiving on disconnect; should reconnect or fail loudly. |
| **Medium** | Web CSP | Next.js app has no Content-Security-Policy headers. |
| **Medium** | Controller / service tests | Many Nest controllers and services lack dedicated specs. |
| **Medium** | Global exception filter | Normalize API errors; avoid raw stack traces in production. |
| **Medium** | Observability | Structured logs, metrics, tracing (request/correlation IDs across Twilio → voice → core-api). |
| **Medium** | API versioning | No `/v1` prefix yet. |
| **Medium** | Health depth | `/health` does not always check DB/Redis/LLM reachability. |
| **Low** | Docker Compose | Add healthchecks for core-api and voice-runtime; fix voice-runtime Dockerfile HEALTHCHECK if `requests` missing from requirements. |
| **Low** | Python pins | `requirements.txt` uses `>=`; prefer lockfile or exact pins for reproducible deploys. |

Security checklist for releases: `tests/security/SECURITY_AUDIT_CHECKLIST.md`.

---

## 10. Environment variables (reference)

Full tables live in **`.env.example`** at the repo root. Highlights:

- **Voice LLM:** `VOICE_LLM_*`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `LLM_PROVIDER`, `AZURE_OPENAI_*`
- **Listening:** `DEEPGRAM_ENDPOINTING_MS`, `DEEPGRAM_UTTERANCE_END_MS`, `DEEPGRAM_STT_MODEL`, `DEEPGRAM_TTS_MODEL`
- **Voice transport:** `TWILIO_*`, `LIVEKIT_*`, `DEEPGRAM_API_KEY`, `CORE_API_BASE_URL`, `VOICE_RUNTIME_V2_PUBLIC_URL` / `WEBHOOK_BASE_URL`

---

## 11. Verification commands

```bash
pnpm test:smoke:typecheck
pnpm test:smoke:db
pnpm test:smoke:api
pnpm test:smoke:web
pnpm test:voice:v2
pnpm voice:v2:preflight
```

Python unit tests: `node scripts/run-voice-v2-python.js -m unittest discover apps/voice-runtime-v2/tests -v`

---

## 12. License

Proprietary. All rights reserved.
