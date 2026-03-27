# Archived Voice Runtime

This directory is archived and no longer part of Wardline's supported runtime path.

- Voice Runtime V2 in `apps/voice-runtime-v2` is the only supported live voice direction.
- The old Pipecat-based gather/streaming runtime, workflow execution path, and agent-type branching were removed as part of the V2 cutover.
- The historical virtual environment may still live under `venv/` and can be reused by `scripts/run-voice-v2-python.js`, but the runtime source in this directory should not be revived.
