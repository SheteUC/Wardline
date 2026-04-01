# Operations Runbook

Use this runbook during pilot operations and incident response.

## Telephony Rollback

Use this when Voice Runtime V2 cannot safely handle live calls.

1. Remove the Twilio number webhook from `/telephony/twilio/bootstrap`.
2. Point the number to the approved fallback destination for the pilot practice.
3. Announce the rollback to the daily pilot owner and staff contact.
4. Preserve call and audit evidence before redeploying.
5. Run one proof call before restoring Wardline as the live target.

## Secret Rotation

Use this after suspected credential exposure or scheduled credential rotation.

1. Rotate the affected secret in the provider console.
2. Update the deployed environment store for every affected service.
3. Redeploy `core-api` and `voice-runtime-v2`.
4. Run `pnpm voice:v2:preflight`.
5. Re-run integration health checks and one inbound proof call.

## Manual Follow-Up During Runtime or Connector Outage

Use this when live execution is degraded but staff still need to service callers.

1. Treat all live runtime-action failures as manual follow-up work.
2. Review `/dashboard/follow-ups`, `/dashboard/urgent-calls`, and `/dashboard/voicemails`.
3. Confirm each urgent or voicemail item has an explicit owner.
4. Document the outage window and the affected calls.
5. After recovery, verify that new calls return to normal live-or-fallback behavior.

## Daily Pilot Ownership

Every pilot day needs named owners for:

- queue review
- telephony incident response
- secret rotation authority
- business/staff communications

Do not expand pilot traffic unless those owners are assigned for the current day.

## Runtime Hot Path Cutover

Use this during the final event-log/projection cutover.

### Rollout flags

- `CALLS_ENABLE_PROJECTION_FALLBACK`
  - keeps dashboard call list/detail on projection-first reads, but still allows fallback to legacy `turnsJson` when a projection row is missing
- `VOICE_RUNTIME_LEGACY_CALL_SYNC`
  - keeps Voice Runtime V2 dual-writing the legacy full-session PATCH after ingest
- `RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS`
  - keeps runtime-action outcomes appending to legacy `turnsJson` through the ingest service

Defaults:

- all three flags should remain `true` until parity is proven in the target environment

### Health surface

Use the internal health route during rollout:

- `GET /api/internal/calls/cutover-health`

It returns:

- `callCount`
- `projectionRowCount`
- `fallbackReadCount`
- `ingestFailureCount`
- `projectionRebuildFailureCount`
- current values for the three rollout flags

The metric counters are process-local and reset on restart. Treat them as current-process telemetry, not as durable audit history.

### Commands

Run these in order for Stage 1 validation:

1. `pnpm --filter @wardline/db migrate:deploy`
2. `pnpm db:backfill:call-events`
3. `pnpm db:verify:call-projections`
4. `pnpm test:smoke`
5. `pnpm voice:v2:proof`

### Logs to watch

Watch for these exact messages:

- `Projection fallback used for dashboard call rows`
- `Projection fallback used for call detail`
- `Projection row missing while fallback is disabled for dashboard call rows`
- `Projection row missing while fallback is disabled for call detail`
- `Call ingest failed`
- `Call projection rebuild failed`
- `Legacy call sync still active`

### Staging sequence

Stage 1:

- deploy with all three flags set to `true`
- run the five commands above
- require:
  - `Missing projection rows: 0`
  - `Mismatched projection rows: 0`
  - green smoke
  - successful `voice:v2:proof`

Stage 2:

- set:
  - `VOICE_RUNTIME_LEGACY_CALL_SYNC=false`
  - `RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS=false`
  - `CALLS_ENABLE_PROJECTION_FALLBACK=true`
- soak for 24 hours
- require:
  - `ingestFailureCount = 0`
  - `projectionRebuildFailureCount = 0`
  - no runtime-action regressions
  - no dashboard regressions

Stage 3:

- set `CALLS_ENABLE_PROJECTION_FALLBACK=false`
- soak for 24 hours
- require:
  - `fallbackReadCount = 0`
  - no projection-missing logs
  - correct call list/detail rendering for scheduling, refill, insurance, billing, handoff/voicemail, safety, and multi-intent calls

### Production sequence

Repeat the same order in production.

Production Gate 1:

- deploy with all three flags `true`
- run migration, backfill, verifier
- require zero missing and zero mismatched projection rows

Production Gate 2:

- disable:
  - `VOICE_RUNTIME_LEGACY_CALL_SYNC`
  - `RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS`
- observe for 24 hours
- require zero ingest and projection rebuild failures

Production Gate 3:

- disable `CALLS_ENABLE_PROJECTION_FALLBACK`
- observe for 72 hours
- require zero fallback reads and zero projection-missing errors

During Production Gates 2 and 3, manually spot-check live call detail for:

- latest runtime action
- operator summary
- transport summary
- intent timeline
- handled-live vs fallback reason state
