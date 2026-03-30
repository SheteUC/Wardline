# HIPAA Compliance Guide - Wardline

This document records Wardline's current HIPAA-relevant technical safeguards and operational boundaries. Update it whenever data flows, vendors, runtime behavior, or infrastructure change.

## 1. Business Associate Agreements

All third-party vendors that process, transmit, or store PHI must have a signed BAA before production PHI is sent to them.

| Vendor | Purpose | BAA status | Notes |
| --- | --- | --- | --- |
| Twilio | PSTN telephony, call recording, Media Streams | Available | Must be enabled on the HIPAA-compliant Twilio account used for pilot and production numbers. |
| Microsoft Azure | Speech, OpenAI, AI Foundry | Available | Azure services used by Wardline must remain inside the covered subscription boundary. |
| Vercel | Next.js hosting | Not available | Do not treat the web tier as a PHI system of record. Keep PHI transient in the browser and server-rendered app. |
| Clerk | Authentication and user metadata | Not available | Store only Wardline business/user identifiers. Never store patient identifiers in Clerk metadata. |
| PostgreSQL host | Primary application database | Available from covered providers | `DATABASE_URL` must use SSL in deployed environments. |
| Redis host | Shared cache | Provider-dependent | Cache is limited to non-PHI config and aggregate analytics only. |
| LangSmith | LLM tracing | Not approved by default | Keep disabled in production until a BAA is in place, or enable anonymization explicitly. |

## 2. Encryption

### In transit

- All HTTP traffic must be served over TLS 1.2+.
- Voice Runtime V2 webhooks and media ingress must use `https://` and `wss://`.
- Service-to-service calls between `core-api` and Voice Runtime V2 must use HTTPS in deployed environments.

### At rest

- PostgreSQL must use provider-managed encryption at rest.
- Redis must use TLS when deployed.
- Azure speech and model providers must stay within the covered Azure account boundary.

## 3. Audit Logging

### AuditInterceptor coverage

`AuditInterceptor` is registered globally in [apps/core-api/src/app.module.ts](../apps/core-api/src/app.module.ts). It logs requests decorated with `@Auditable(...)`.

Current decorated endpoints:

| Endpoint | Action |
| --- | --- |
| `POST /businesses/:businessId/workflows` | `CREATE` |
| `POST /businesses/:businessId/workflows/:id/versions` | `CREATE_VERSION` |
| `POST /businesses/:businessId/workflows/versions/:versionId/publish` | `PUBLISH_VERSION` |
| `POST /businesses/:businessId/workflows/:id/simulate` | `SIMULATE` |
| `POST /users/:userId/businesses/:businessId` | `ADD_TO_BUSINESS` |
| `PATCH /users/:userId/businesses/:businessId/role` | `UPDATE_ROLE` |
| `DELETE /users/:userId/businesses/:businessId` | `REMOVE_FROM_BUSINESS` |

Failed interceptor-backed requests are also logged as `${action}_FAILED`.

### Direct audit actions

These actions are logged through `AuditService.logAction(...)`:

| Source | Actions |
| --- | --- |
| Integrations service | `integration.upserted`, `integration.health_check_passed`, `integration.health_check_failed` |
| Runtime actions service | `runtime_action.executed_live`, `runtime_action.downgraded_to_follow_up` |
| Transcript retention task | `TRANSCRIPT_RETENTION_CLEANUP` |

### Append-only enforcement

`AuditLog` rows are append-only by database policy. The migration [packages/db/prisma/migrations/20260330_audit_log_immutability/migration.sql](../packages/db/prisma/migrations/20260330_audit_log_immutability/migration.sql) installs PostgreSQL triggers that reject `UPDATE` and `DELETE` against `audit_logs`.

Validation path:

- `pnpm test:smoke:db`

## 4. Access Control

- RBAC is enforced in the Core API through `AuthGuard` and `RbacGuard`.
- Clerk user records must only contain Wardline user and business identifiers.
- Patient identity and call content remain inside the Core API database and Voice Runtime V2 data path, not Clerk metadata.

## 5. Caching and PHI Boundaries

Operational PHI payloads bypass Redis and the in-memory fallback cache.

Not cached:

- call list responses
- call detail responses
- transcript segments
- voicemail queues and voicemail transcriptions
- follow-up task queues

Currently cached server-side:

- `businesses:list:{userId}:{includeSettings}`
- `businesses:{businessId}:true|false`
- `businesses:by-phone:{normalizedPhone}`
- `businesses:{businessId}:runtime-config`
- `workflows:active:{businessId}:{phoneNumberId|default}`
- `calls:analytics:{businessId}:{dateKey}`

The cached call analytics payload is aggregate-only. Caller names, caller phone numbers, transcript text, voicemail transcriptions, and follow-up summaries are not cached.

## 6. Data Retention

`transcriptRetentionDays` is stored per business in `BusinessSettings`.

Automated cleanup is implemented in [transcript-retention.task.ts](../apps/core-api/src/tasks/transcript-retention.task.ts) and registered in [app.module.ts](../apps/core-api/src/app.module.ts). The task runs nightly at `02:00 UTC`, deletes transcript segments older than the business-specific retention window, and writes an audit log for each business with deleted rows.

Validation path:

- `pnpm --filter @wardline/core-api test -- --runInBand tasks/transcript-retention.task.spec.ts`

Fallback manual cleanup when the scheduler is unavailable:

```sql
DELETE FROM "transcript_segments"
WHERE "created_at" < NOW() - INTERVAL '30 days'
  AND "call_id" IN (
    SELECT "id" FROM "call_sessions" WHERE "business_id" = '<businessId>'
  );
```

## 7. Incident Response

In the event of a suspected PHI breach:

1. Revoke the affected provider credentials immediately.
2. Disable the affected pilot or business path.
3. Preserve all `audit_logs` rows.
4. Review the operational runbook in [docs/OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
5. Notify the business privacy contact and escalate per legal requirements.

## 8. Pre-Pilot Checklist

- Twilio HIPAA-compliant account enabled for the production-grade number
- Azure subscription remains inside the covered BAA boundary
- PostgreSQL SSL enforced in deployed environments
- Redis TLS enabled in deployed environments
- Voice Runtime V2 callback URLs are HTTPS/WSS
- LangSmith disabled or explicitly anonymized before pilot traffic
- `pnpm test:smoke:db` passes
- Transcript retention task is deployed with the Core API
- Pilot operations owners are assigned using [docs/PILOT_READINESS.md](./PILOT_READINESS.md)
