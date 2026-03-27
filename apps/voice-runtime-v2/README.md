# Voice Runtime V2

Voice Runtime V2 is Wardline's internal multi-agent voice service and the only supported live voice direction.

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

The local/session endpoints are the current validation harness while provider-backed telephony is being wired:

- `POST /sessions`
- `POST /telephony/twilio/bootstrap`
- `POST /sessions/{sessionId}/turn`
- `POST /sessions/{sessionId}/transcript`
- `POST /sessions/{sessionId}/events`
- `POST /sessions/{sessionId}/voicemail`

These endpoints validate internal multi-agent behavior and transport bootstrap metadata without depending on a full carrier cutover.
