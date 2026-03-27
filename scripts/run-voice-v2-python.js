const { existsSync } = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const voiceV2Dir = path.join(repoRoot, 'apps', 'voice-runtime-v2');
const archivedVoiceDir = path.join(repoRoot, 'apps', 'voice-orchestrator-pipecat');
const requestedArgs = process.argv.slice(2);

if (requestedArgs.length === 0) {
  console.error('Usage: node scripts/run-voice-v2-python.js <python-args...>');
  process.exit(1);
}

function resolvePythonBinary() {
  const explicit = process.env.WARDLINE_VOICE_PYTHON?.trim();
  if (explicit) {
    return explicit;
  }

  const candidates = process.platform === 'win32'
    ? [
        path.join(voiceV2Dir, 'venv', 'Scripts', 'python.exe'),
        path.join(voiceV2Dir, '.venv', 'Scripts', 'python.exe'),
        path.join(archivedVoiceDir, 'venv', 'Scripts', 'python.exe'),
        path.join(archivedVoiceDir, '.venv', 'Scripts', 'python.exe'),
      ]
    : [
        path.join(voiceV2Dir, 'venv', 'bin', 'python'),
        path.join(voiceV2Dir, '.venv', 'bin', 'python'),
        path.join(archivedVoiceDir, 'venv', 'bin', 'python'),
        path.join(archivedVoiceDir, '.venv', 'bin', 'python'),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

const pythonBinary = resolvePythonBinary();
const result = spawnSync(pythonBinary, requestedArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

if (result.error) {
  console.error(`Failed to start Voice Runtime V2 command with ${pythonBinary}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
