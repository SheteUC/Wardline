import type { CoreApiEnv } from '@wardline/config';

const LOCAL_DEV_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3003',
] as const;

export function buildCorsOriginAllowlist(
    env: Pick<CoreApiEnv, 'WEB_BASE_URL' | 'CORE_API_ALLOWED_ORIGINS'>,
): string[] {
    const rawOrigins = [
        env.WEB_BASE_URL,
        ...(env.CORE_API_ALLOWED_ORIGINS?.split(',') ?? []),
        ...LOCAL_DEV_ORIGINS,
    ];

    const normalizedOrigins: string[] = [];

    for (const rawOrigin of rawOrigins) {
        const trimmedOrigin = rawOrigin?.trim();
        if (!trimmedOrigin) {
            continue;
        }

        let parsedOrigin: string;
        try {
            parsedOrigin = new URL(trimmedOrigin).origin;
        } catch {
            throw new Error(`Invalid CORS origin: ${trimmedOrigin}`);
        }

        if (!normalizedOrigins.includes(parsedOrigin)) {
            normalizedOrigins.push(parsedOrigin);
        }
    }

    return normalizedOrigins;
}

export function isCorsOriginAllowed(origin: string, allowlist: string[]): boolean {
    try {
        return allowlist.includes(new URL(origin).origin);
    } catch {
        return false;
    }
}
