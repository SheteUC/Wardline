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

The local/session endpoints remain the fast proof surface, and the Twilio bootstrap + media endpoints now define the real telephony cutover path:

- `POST /sessions`
- `POST /telephony/twilio/bootstrap`
- `WS /telephony/twilio/media`
- `POST /sessions/{sessionId}/turn`
- `POST /sessions/{sessionId}/transcript`
- `POST /sessions/{sessionId}/events`
- `POST /sessions/{sessionId}/voicemail`

These endpoints validate:

- supervisor routing and clarification
- specialist intake and continuation
- confirmation repair and change flow
- runtime-action live/fallback parity
- voicemail and manual handoff packaging
- operator-summary persistence

`pnpm test:voice:v2` is the authoritative local voice proof gate for this phase.

## First real call

1. Start a local HTTPS tunnel to port `3003`. Example:
   - `ngrok http 3003`
2. Set both `VOICE_RUNTIME_V2_PUBLIC_URL` and `WEBHOOK_BASE_URL` to the tunnel URL.
3. Run `pnpm voice:v2:proof` to print the exact bootstrap URL and dashboard review path.
4. Start `pnpm mock:integrations`.
5. Run `pnpm voice:v2:preflight`.
6. Start `pnpm voice:v2:dev`.
7. Point the Twilio number voice webhook at the printed bootstrap URL.
8. Place one inbound scheduling call and confirm:
   - the caller hears the V2 greeting
   - the supervisor routes to scheduling
   - the caller confirms an appointment request
   - the mock scheduling action succeeds live
   - the dashboard call detail page shows operator summary and transport metadata
