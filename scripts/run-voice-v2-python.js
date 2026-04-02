const { existsSync, readdirSync } = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = process.cwd();
const voiceV2Dir = path.join(repoRoot, 'apps', 'voice-runtime-v2');
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
      ]
    : [
        path.join(voiceV2Dir, 'venv', 'bin', 'python'),
        path.join(voiceV2Dir, '.venv', 'bin', 'python'),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

function appendUserSitePackages(env) {
  if (process.platform !== 'win32') {
    return env;
  }

  const appData = process.env.APPDATA;
  if (!appData) {
    return env;
  }

  const pythonRoot = path.join(appData, 'Python');
  if (!existsSync(pythonRoot)) {
    return env;
  }

  let sitePackageDirs = [];
  try {
    sitePackageDirs = readdirSync(pythonRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('Python'))
      .map((entry) => path.join(pythonRoot, entry.name, 'site-packages'))
      .filter((candidate) => existsSync(candidate));
  } catch {
    return env;
  }

  if (sitePackageDirs.length === 0) {
    return env;
  }

  const existingPythonPath = env.PYTHONPATH ? env.PYTHONPATH.split(path.delimiter) : [];
  const merged = [...sitePackageDirs, ...existingPythonPath].filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );

  return {
    ...env,
    PYTHONPATH: merged.join(path.delimiter),
  };
}

const pythonBinary = resolvePythonBinary();
const result = spawnSync(pythonBinary, requestedArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: appendUserSitePackages(process.env),
  shell: false,
});

if (result.error) {
  console.error(`Failed to start Voice Runtime V2 command with ${pythonBinary}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
