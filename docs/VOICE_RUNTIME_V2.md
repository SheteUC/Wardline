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
  - Twilio bootstrap + media ingress
  - transport/bootstrap metadata for LiveKit-oriented cutover
  - unit-test harness

The legacy Python voice runtime is now archived code, not a supported product direction.

## Telephony cutover

- Twilio inbound calls should target `POST /telephony/twilio/bootstrap`.
- Voice Runtime V2 responds with TwiML that connects the call to `WS /telephony/twilio/media`.
- The media bridge persists provider transport metadata, forwards Deepgram transcripts into the existing V2 turn loop, and reuses the runtime-action/operator-summary path that already exists in the local harness.

## Proof target

The next provider-backed proof target is:

- `pnpm voice:v2:preflight` passes with real Twilio, LiveKit, and Deepgram env
- `pnpm voice:v2:proof` prints the tunnel-derived bootstrap URL and dashboard review path
- one real Twilio inbound call
- one scheduling flow with caller confirmation before the mock appointment request executes
- Voice Runtime V2 as the only live runtime
- mock-backed business actions
- operator review through the existing dashboard call detail page

Use [docs/PILOT_READINESS.md](./PILOT_READINESS.md) as the canonical gate after this first real-call proof succeeds.
