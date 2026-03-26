const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGETS = [
    path.join(ROOT, 'apps', 'core-api', 'src'),
    path.join(ROOT, 'apps', 'web', 'src'),
    path.join(ROOT, 'apps', 'voice-orchestrator-pipecat'),
];

const IGNORE_SEGMENTS = new Set(['venv', '__pycache__', 'tests', 'logs', '.cache', '.pytest_cache']);
const TEXT_FILE_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.json',
    '.py',
    '.md',
]);

const PATTERNS = [
    /\bhospitalId\b/g,
    /\bhospital_id\b/g,
    /\bhospital_name\b/g,
    /\bselectedHospitalId\b/g,
    /\bdefaultHospitalId\b/g,
    /\bhospitalRoles\b/g,
    /\bcreateHospitalService\b/g,
    /\bHospitalSettings\b/g,
    /\buseHospital\b/g,
    /\bHospitalProvider\b/g,
    /\/hospitals\b/g,
    /\bhospital-context\b/g,
];

function shouldIgnore(filePath) {
    const segments = filePath.split(path.sep);
    return segments.some((segment) => IGNORE_SEGMENTS.has(segment));
}

function getFiles(dir) {
    let entries = [];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
        if (error && (error.code === 'EPERM' || error.code === 'EACCES')) {
            return [];
        }
        throw error;
    }
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (shouldIgnore(fullPath)) {
            continue;
        }

        if (entry.isDirectory()) {
            files.push(...getFiles(fullPath));
            continue;
        }

        if (TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }

    return files;
}

function lineNumberForIndex(content, index) {
    return content.slice(0, index).split(/\r?\n/).length;
}

const findings = [];

for (const target of TARGETS) {
    if (!fs.existsSync(target)) {
        continue;
    }

    for (const filePath of getFiles(target)) {
        const content = fs.readFileSync(filePath, 'utf8');

        for (const pattern of PATTERNS) {
            pattern.lastIndex = 0;
            const match = pattern.exec(content);
            if (!match) {
                continue;
            }

            findings.push({
                filePath,
                line: lineNumberForIndex(content, match.index),
                token: match[0],
            });
        }
    }
}

if (findings.length > 0) {
    console.error('Business terminology gate failed. Remove legacy hospital naming from active paths:');
    for (const finding of findings) {
        console.error(`- ${path.relative(ROOT, finding.filePath)}:${finding.line} (${finding.token})`);
    }
    process.exit(1);
}

console.log('Business terminology gate passed.');
