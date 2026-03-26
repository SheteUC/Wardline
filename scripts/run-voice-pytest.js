const { existsSync } = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const voiceAppDir = path.join(repoRoot, 'apps', 'voice-orchestrator-pipecat');

const requestedArgs = process.argv.slice(2);

if (requestedArgs.length === 0) {
  console.error('Usage: node scripts/run-voice-pytest.js <pytest-args...>');
  process.exit(1);
}

function resolvePythonBinary() {
  const explicit = process.env.WARDLINE_VOICE_PYTHON?.trim();
  if (explicit) {
    return explicit;
  }

  const candidates = process.platform === 'win32'
    ? [
        path.join(voiceAppDir, 'venv', 'Scripts', 'python.exe'),
        path.join(voiceAppDir, '.venv', 'Scripts', 'python.exe'),
      ]
    : [
        path.join(voiceAppDir, 'venv', 'bin', 'python'),
        path.join(voiceAppDir, '.venv', 'bin', 'python'),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

const pythonBinary = resolvePythonBinary();
const baseArgs = ['-m', 'pytest', '-p', 'no:cacheprovider'];
const result = spawnSync(pythonBinary, [...baseArgs, ...requestedArgs], {
  cwd: voiceAppDir,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

if (result.error) {
  console.error(`Failed to start pytest with ${pythonBinary}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
