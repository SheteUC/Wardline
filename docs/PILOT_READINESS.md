# Pilot Readiness Gate

This is the canonical Wardline pilot-readiness checklist. Other docs may cover one slice of the work, but this file defines the required sequence and go/no-go gate.

## 1. Repo Validation

Complete these checks before any real-call proof:

1. Keep runtime values in the repo-root `.env.local` or `.env` files only.
2. Run `pnpm test:smoke`.
3. Run `pnpm test:smoke:db`.
4. Run `pnpm test:staging:env`.
5. Run `pnpm db:seed:staging`.

Evidence to capture:

- smoke suite result
- DB immutability result
- staging env check result

## 2. First Provider-Backed Call

Prove one real inbound scheduling call against Voice Runtime V2 while keeping business actions on mock integrations.

Required sequence:

1. Start `pnpm mock:integrations`.
2. Run `pnpm voice:v2:preflight`.
3. Run `pnpm voice:v2:proof`.
4. Start `pnpm voice:v2:dev`.
5. Point the Twilio number at `/telephony/twilio/bootstrap`.
6. Place one inbound scheduling call.

Required outcomes:

- the caller hears the greeting
- the supervisor routes to scheduling
- confirmation is required before the write action
- the mock appointment request executes live
- the call detail page shows operator summary and transport metadata

## 3. Full Staging Validation

After the first real call succeeds, complete the staging matrix in [docs/STAGING_VALIDATION.md](./STAGING_VALIDATION.md).

Required outcomes:

- live and fallback validation for appointment, refill, insurance, and billing
- receptionist-quality validation for hours, services, confirmation repair, request changes, voicemail, and emergency interruption
- queue validation for calls, voicemails, urgent items, and follow-ups

## 4. Compliance and Operations Signoff

Before pilot traffic:

1. Review [docs/HIPAA_COMPLIANCE.md](./HIPAA_COMPLIANCE.md).
2. Review [docs/OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
3. Confirm BAAs, SSL/TLS, cache boundaries, audit-log immutability, and retention cleanup are all in place.
4. Assign daily owners for queue review and incident response.

## 5. Go / No-Go Decision

Wardline is pilot-ready only when all of the following are true:

- `pnpm test:smoke` is green
- `pnpm test:smoke:db` is green
- `pnpm test:staging:env` is green
- one provider-backed V2 call has succeeded end to end
- the full staging validation matrix is complete
- compliance and operations signoff is complete

If any item above is red, fix trust, safety, or operational gaps before expanding scope or traffic.
