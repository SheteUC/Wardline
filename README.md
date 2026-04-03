# Wardline

Wardline is a business-native AI voice receptionist platform for independent US family medicine practices. Practice Setup drives hours, policies, integrations, and FAQs; Voice Runtime V2 handles live calls; the Core API persists calls, transcripts, and runtime actions.

**Full documentation (architecture, hybrid LLM, safety, deployment, compliance, backlog):** [docs/WARDLINE_PLATFORM.md](./docs/WARDLINE_PLATFORM.md)

## Quick start

**Prerequisites:** Node.js 20.x, pnpm 8+, Python 3.11+, PostgreSQL, Redis.

```bash
pnpm install
python -m pip install -r apps/voice-runtime-v2/requirements.txt
pnpm db:generate && pnpm db:migrate
```

Configure **repo-root** `.env` or `.env.local` (see [.env.example](./.env.example)).

## Run locally with Docker Compose

```bash
docker compose up --build
```

This starts:

- web: `http://localhost:3000`
- core-api: `http://localhost:3001`
- voice-runtime-v2: `http://localhost:3003`
- postgres: `localhost:5432`
- redis: `localhost:6379`

## Run locally without Compose

```bash
pnpm --filter @wardline/web dev        # http://localhost:3000
pnpm --filter @wardline/core-api dev   # http://localhost:3001
pnpm voice:v2:dev                      # http://localhost:3003
```

## Mock integrations + smoke business

```bash
pnpm mock:integrations
pnpm db:seed:smoke
```

## Voice checks

```bash
pnpm voice:v2:preflight
pnpm voice:v2:proof
pnpm test:voice:v2
```

## Core verification

```bash
pnpm test:smoke
pnpm test:smoke:db
```

## Repository layout

```text
apps/web                 Next.js dashboard (Clerk)
apps/core-api            NestJS API, Prisma, runtime actions
apps/voice-runtime-v2    FastAPI voice + Twilio + Deepgram + orchestration
packages/db              Prisma schema
```

## Telephony (production or tunnel)

- Point Twilio voice webhook to: `https://<voice-runtime-host>/telephony/twilio/bootstrap`
- For local proof: `ngrok http 3003`, set `VOICE_RUNTIME_V2_PUBLIC_URL` and `WEBHOOK_BASE_URL` to the tunnel URL

## Deploy

- **Web:** Vercel (`apps/web`)
- **APIs:** Long-running host - see [render.yaml](./render.yaml) and [docs/WARDLINE_PLATFORM.md](./docs/WARDLINE_PLATFORM.md)
- `render.yaml` is a development/staging blueprint. Production requires paid plans, backup policy, and regional review.

## License

Proprietary. All rights reserved.
