import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

const rootEnvPaths = [
    resolve(__dirname, '../../../.env.local'),
    resolve(__dirname, '../../../.env'),
];

const deprecatedEnvPaths = [
    resolve(__dirname, '../.env.local'),
    resolve(__dirname, '../.env'),
];

for (const envPath of rootEnvPaths) {
    if (existsSync(envPath)) {
        config({ path: envPath, override: false });
    }
}

const globalForEnvWarnings = globalThis as typeof globalThis & {
    __wardlineDeprecatedEnvWarningShown?: boolean;
};

if (!globalForEnvWarnings.__wardlineDeprecatedEnvWarningShown) {
    const existingDeprecatedEnvPaths = deprecatedEnvPaths.filter((envPath) => existsSync(envPath));

    if (existingDeprecatedEnvPaths.length > 0) {
        console.warn(
            `[wardline] Deprecated local env file(s) detected: ${existingDeprecatedEnvPaths.join(
                ', ',
            )}. Use the repo-root .env.local/.env files instead.`,
        );
        globalForEnvWarnings.__wardlineDeprecatedEnvWarningShown = true;
    }
}
