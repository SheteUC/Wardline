# Voice Runtime V2

Voice Runtime V2 is the new internal multi-agent rewrite of Wardline's live voice layer.

## Goals

- replace the current Gather and Python streaming runtime paths with one internal architecture
- keep Practice Setup as the customer-facing source of truth
- keep runtime actions as the only execution boundary
- make the caller experience feel like one consistent receptionist rather than a wrapper

## Internal agents

- `SupervisorAgent`
- `SafetyAgent`
- `SchedulingAgent`
- `RefillAgent`
- `InsuranceAgent`
- `BillingAgent`
- `KnowledgeAgent`
- `HandoffAgent`

Only the supervisor speaks to the caller. Specialists return structured results for confirmation, execution, fallback, and operator summaries.

## Current status

- Core API now emits `voicePolicyV2` inside `GET /businesses/:id/runtime-config`
- legacy agent APIs/pages are explicitly marked deprecated internal-only
- a parallel `apps/voice-runtime-v2` service now exists with:
  - typed session state
  - supervisor/specialist orchestration
  - runtime-action bridge
  - voicemail capture endpoint
  - unit-test harness

The V1 voice runtime remains the rollback path until V2 reaches parity and staging proof.
