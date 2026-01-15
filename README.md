# Wardline

HIPAA-compliant hospital call triage platform using Twilio Programmable Voice, Azure AI, and Next.js.

## Overview

Wardline is a cloud-only SaaS platform that answers hospital phone calls 24/7, performs emergency screening, conducts administrative triage, and routes callers to appropriate human staff with structured handoffs.

## Architecture

- **apps/web**: Next.js App Router UI (Vercel)
- **apps/core-api**: NestJS REST API (Azure)
- **apps/voice-orchestrator-pipecat**: Python/FastAPI service for Twilio + Azure AI (Azure)
- **packages/db**: Prisma schema and database client
- **packages/types**: Shared TypeScript types and Zod schemas
- **packages/config**: Environment configuration with validation
- **packages/utils**: Logging, error handling, telemetry
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

## HIPAA Compliance

This platform is designed for HIPAA compliance with the following requirements:

- **BAAs**: Required with Twilio, Microsoft Azure, and Vercel
- **Encryption**: TLS everywhere, database encryption at rest
- **Access Controls**: RBAC with MFA via Clerk
- **Audit Logging**: All PHI access logged
- **Minimum Necessary**: Limited data collection and exposure
- **Retention**: Configurable per-hospital (default 30 days)

## Project Structure

```
wardline/
├── apps/
│   ├── web/                      # Next.js frontend
│   ├── core-api/                 # NestJS backend
│   └── voice-orchestrator-pipecat/  # Python/FastAPI voice service
└── packages/
    ├── db/                       # Prisma database
    ├── types/                    # Shared types
    ├── config/                   # Environment config
    ├── utils/                    # Shared utilities
    └── ui/                       # UI components
```

## Testing

Tests are located within each application:

```bash
# Run core-api tests
pnpm --filter @wardline/core-api test

# Run web tests
pnpm --filter @wardline/web test
```

## Deployment

### Vercel Deployment (Web)

```bash
cd apps/web
vercel deploy --prod
```

### Azure Deployment (API & Voice)

See Azure Container Apps documentation for deploying NestJS and FastAPI services.

## License

Proprietary - All rights reserved
