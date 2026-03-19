# HIPAA Compliance Guide — Wardline

This document records Wardline's technical and administrative safeguards for HIPAA compliance. Update this file whenever infrastructure, data flows, or vendor relationships change.

---

## 1. Business Associate Agreements (BAAs)

All third-party vendors that process, transmit, or store Protected Health Information (PHI) must have a signed BAA before PHI is sent to them.

| Vendor | Purpose | BAA Status |
|--------|---------|-----------|
| **Twilio** | PSTN telephony, call recording, Media Streams | ✅ Available via Twilio's HIPAA-compliant edition. Must be enabled per Twilio docs. |
| **Microsoft Azure** | Speech-to-Text, Text-to-Speech, OpenAI (GPT-4), AI Foundry | ✅ Azure signs BAAs as part of the Microsoft Products and Services BAA. Activate from the Azure Portal → Compliance → HIPAA. |
| **Vercel** | Next.js hosting | ⚠️ Vercel does **not** sign BAAs. PHI must not be stored or logged in the Next.js app. Web-layer PHI (patient names, phone numbers in UI) must be treated as transient. |
| **Clerk** | Authentication, user metadata | ⚠️ Clerk does not sign BAAs. `publicMetadata.agentId` is non-PHI (internal ID). Do not store patient identifiers in Clerk user records. |
| **Neon / Supabase (PostgreSQL)** | Primary database | ✅ HIPAA-compliant hosting available. Ensure SSL mode is required (`DATABASE_URL` must include `?sslmode=require`). Enable at-rest encryption (AES-256). |
| **Redis / Upstash** | Caching (call lists, hospital data) | ⚠️ PHI is **never** cached (call transcript content is excluded from Redis cache). Only aggregate counts and non-PHI metadata are cached. Verify with cache key inventory below. |
| **LangSmith** | LLM tracing | ⚠️ If enabled, LangSmith receives conversation text. Enable `LANGSMITH_ANONYMIZE=true` or disable in production until a BAA is in place. |

### Cache Key Inventory (Redis)
The following keys are used. PHI-containing data is explicitly excluded from caching:

```
calls:list:{hospitalId}:{filterHash}     — call metadata (no transcript text)
calls:detail:{callId}                    — call metadata (no transcript text)
hospitals:{hospitalId}                   — hospital config (no patient data)
```

Transcript text (`TranscriptSegment.text`) is **never** placed in cache.

---

## 2. Encryption

### In Transit
- All HTTP traffic must be served over TLS 1.2+ (enforced by Vercel / Azure App Service).
- WebSocket connections (Twilio Media Streams, Agent Console) use WSS (TLS).
- Internal service-to-service calls between `core-api` and `voice-orchestrator` must use HTTPS in production (`VOICE_ORCHESTRATOR_URL` must be an `https://` URL).

### At Rest
- PostgreSQL: Enable at-rest encryption at the provider level (Neon/Supabase both support AES-256).
- Ensure `DATABASE_URL` includes `?sslmode=require`.
- Redis: Use TLS-enabled Redis (Upstash enforces TLS by default).
- Azure Speech / OpenAI: Data in transit is encrypted; Azure does not persist audio or transcripts beyond the API call lifetime for the standard tier.

---

## 3. Audit Logging

### AuditInterceptor Coverage
The `AuditInterceptor` (`apps/core-api/src/audit/audit.interceptor.ts`) is applied globally in `AppModule`. It logs requests decorated with `@Auditable(...)`.

**Endpoints currently decorated with `@Auditable`:**

| Endpoint | Action Logged |
|----------|--------------|
| `POST /api/hospitals/:id/calls` | `CREATE_CALL` |
| `PATCH /api/hospitals/:id/calls/:callId` | `UPDATE_CALL` |
| `POST /api/calls/:id/transcript` | `SAVE_TRANSCRIPT` |
| `POST /api/calls/:id/escalate` | `ESCALATE_CALL` |
| `POST /api/workflows` | `CREATE_WORKFLOW` |
| `PUT /api/workflows/:id` | `UPDATE_WORKFLOW` |
| `POST /api/workflows/:id/publish` | `PUBLISH_WORKFLOW` |
| `GET /api/hospitals/:id/patients` | `ACCESS_PATIENT_LIST` |
| `GET /api/hospitals/:id/patients/:patientId` | `ACCESS_PATIENT_RECORD` |
| `POST /api/agents` | `CREATE_AGENT` |
| `DELETE /api/agents/:id` | `DELETE_AGENT` |

**Additional actions logged via AuditService directly:**
- `ROUTING_DECISION` — logged by `WorkflowExecutionService.logRoutingDecision`
- `SAFETY_CHECK` — logged by `WorkflowExecutionService.logSafetyCheck`
- `SAFETY_EVENT` — logged by `MedicalTriageGuardService.enforceHumanEscalation`

### AuditLog Schema
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  hospitalId  String
  userId      String?
  action      String
  entityType  String
  entityId    String?
  metadata    Json
  createdAt   DateTime @default(now())
}
```

Audit logs are append-only. No update or delete operations should be permitted on `AuditLog` records.

**TODO:** Add a database-level check that prevents `DELETE` on `AuditLog` (trigger or row-level security policy in PostgreSQL).

---

## 4. PHI Access Control

### Role-Based Access (RBAC)
Roles are stored in Clerk's `publicMetadata.role`. The `RbacGuard` enforces them on every API request.

| Role | PHI Access |
|------|-----------|
| `ADMIN` | Full access to all hospital data |
| `SUPERVISOR` | Read call recordings, transcripts, escalations for their hospital |
| `AGENT` | Read/update assigned calls only |
| `CALLER` | No API access (voice-only interaction via Twilio) |

### Minimum Necessary Principle
- AI agents receive only the fields they need (`hospital_id`, detected intent, collected fields). Full patient records are never sent to Azure OpenAI.
- `CallContext.extractedFields` stores only form-field-level data (name, phone, service type). Full medical histories are not collected via voice AI.

---

## 5. Data Retention

### Configuration
`transcriptRetentionDays` is stored per hospital in `HospitalSettings` (default: 30 days). See `apps/core-api/src/modules/hospitals/hospitals.service.ts`.

### Automated Cleanup
A NestJS scheduled task (`TranscriptRetentionTask`) runs nightly to delete transcript segments older than the hospital's configured retention window.

> **Status: TODO** — The retention scheduler is not yet implemented. See `apps/core-api/src/tasks/transcript-retention.task.ts` (to be created).

Until the cron task is implemented, the following manual query can be run to clean up transcripts:

```sql
-- Delete transcript segments older than 30 days
DELETE FROM "TranscriptSegment"
WHERE "createdAt" < NOW() - INTERVAL '30 days'
  AND "callId" IN (
    SELECT id FROM "CallSession" WHERE "hospitalId" = '<hospitalId>'
  );
```

**TODO:** Implement `TranscriptRetentionTask` using `@nestjs/schedule` and `@Cron` decorators. Task should:
1. Query all hospitals with their `transcriptRetentionDays` setting
2. Delete `TranscriptSegment` records older than the retention window
3. Log deletion counts to `AuditLog`
4. Run nightly at 02:00 UTC

---

## 6. Incident Response

In the event of a potential PHI breach:
1. Immediately revoke the affected API keys (Twilio, Azure, Clerk).
2. Disable the affected hospital account in the Wardline admin panel.
3. Preserve all `AuditLog` records — do not delete.
4. Notify the hospital's Privacy Officer within 24 hours.
5. If PHI of 500+ individuals is involved, notify HHS within 60 days per the Breach Notification Rule.

---

## 7. Checklist Before Go-Live

- [ ] Twilio HIPAA-compliant account enabled and BAA countersigned
- [ ] Azure BAA accepted in Azure Portal for all subscriptions used
- [ ] `DATABASE_URL` includes `?sslmode=require`
- [ ] Redis TLS enabled
- [ ] `VOICE_ORCHESTRATOR_URL` is `https://`
- [ ] LangSmith disabled or anonymized in production
- [ ] `TranscriptRetentionTask` implemented and scheduled
- [ ] Penetration test completed by a HIPAA-specialized firm
- [ ] Staff security awareness training documented
- [ ] Privacy Policy and Terms of Service reviewed by legal counsel
