# Voice Runtime V2

Voice Runtime V2 is Wardline's supported live voice runtime.

## Goals

- replace the old Gather and Python streaming runtime paths with one internal architecture
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

- Core API emits `voicePolicyV2` inside `GET /businesses/:id/runtime-config`
- the dashboard and Practice Setup no longer expose agent/workflow authoring surfaces
- `apps/voice-runtime-v2` now owns:
  - typed session state
  - supervisor/specialist orchestration
  - runtime-action bridge
  - voicemail capture
  - transport/bootstrap metadata for LiveKit-oriented cutover
  - unit-test harness

The legacy Python voice runtime is now archived code, not a supported product direction.
