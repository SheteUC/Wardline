# Voice Runtime V2

FastAPI service for Twilio media streams, Deepgram STT, TTS, and call orchestration (supervisor + specialists + optional LLM layer).

**Architecture, env vars, safety, listening tuning, and deployment:** [../../docs/WARDLINE_PLATFORM.md](../../docs/WARDLINE_PLATFORM.md)

**Local run**

```bash
python -m pip install -r apps/voice-runtime-v2/requirements.txt
pnpm voice:v2:dev
```

**Key HTTP/WebSocket routes**

- `POST /telephony/twilio/bootstrap`
- `WS /telephony/twilio/media`
- `GET /health`, `GET /ready`
- Session harness: `POST /sessions`, `POST /sessions/{id}/turn`, etc.

**Tests**

```bash
node ../../scripts/run-voice-v2-python.js -m unittest discover apps/voice-runtime-v2/tests -v
```
