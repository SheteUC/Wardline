import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

const envPaths = [
    resolve(__dirname, '../../../.env.local'),
    resolve(__dirname, '../../../.env'),
    resolve(__dirname, '../.env.local'),
    resolve(__dirname, '../.env'),
];

for (const envPath of envPaths) {
    if (existsSync(envPath)) {
        config({ path: envPath, override: false });
    }
}
