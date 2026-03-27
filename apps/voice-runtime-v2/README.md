# Voice Runtime V2

Voice Runtime V2 is Wardline's new internal multi-agent voice service.

It is intentionally separate from `apps/voice-orchestrator-pipecat` so the team can:

- rebuild the voice architecture without restarting the product
- keep Practice Setup as the customer-facing source of truth
- preserve existing runtime-action APIs and operator workflows
- cut over only after V2 reaches behavioral parity

## Runtime model

- `SupervisorAgent` is the only speaking agent
- specialist agents are internal-only:
  - safety
  - scheduling
  - refill
  - insurance
  - billing
  - knowledge
  - handoff
- specialists return structured results that drive confirmation, runtime actions, and operator summaries

## Intended provider stack

- Twilio for telephony
- LiveKit for realtime media/session orchestration
- Deepgram for streaming STT
- GPT-4o-mini-class reasoning for supervisor/specialists
- managed low-latency TTS first

## Local run

```bash
python -m pip install -r apps/voice-runtime-v2/requirements.txt
pnpm voice:v2:dev
```

The root script reuses the existing voice virtual environment when available, so
V2 local runs do not depend on whichever Python happens to be first on `PATH`.

## Validation

The text-turn endpoints are the current local harness while realtime transport is being introduced:

- `POST /sessions`
- `POST /sessions/{sessionId}/turn`
- `POST /sessions/{sessionId}/voicemail`

These endpoints validate the internal multi-agent behavior without depending on full telephony cutover.
