import { Controller, Get, HttpException, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './cache/cache.service';

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) {}

    /** Process liveness: does not touch DB/Redis (suitable for the busiest probes). */
    @Get('health')
    @Public()
    @SkipThrottle()
    checkLiveness() {
        return {
            status: 'ok',
            service: 'core-api',
            timestamp: new Date().toISOString(),
        };
    }

    /** Readiness: DB + optional Redis when REDIS_URL is configured. Returns 503 if a required check fails. */
    @Get('ready')
    @Public()
    @SkipThrottle()
    async readiness() {
        const checks: Record<string, unknown> = {};
        let ok = true;

        try {
            await this.prisma.$queryRaw`SELECT 1`;
            checks.database = { ok: true };
        } catch (err) {
            ok = false;
            checks.database = {
                ok: false,
                error: err instanceof Error ? err.message : 'query_failed',
            };
        }

        const redisUrlConfigured = Boolean(process.env.REDIS_URL?.trim());
        if (redisUrlConfigured) {
            const stats = this.cache.getStats();
            const ping = await this.cache.pingRedis();
            const redisOk = stats.usingRedis && ping.ok;
            if (!redisOk) {
                ok = false;
            }
            checks.redis = {
                ok: redisOk,
                configured: true,
                usingRedis: stats.usingRedis,
                ping: ping.detail,
            };
        } else {
            checks.redis = { ok: true, configured: false, skipped: true };
        }

        checks.llm = {
            ok: true,
            note: 'LLM is used by voice-runtime-v2, not core-api',
        };

        const body = {
            status: ok ? 'ready' : 'degraded',
            service: 'core-api',
            checks,
            timestamp: new Date().toISOString(),
        };

        if (!ok) {
            throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
        }

        return body;
    }
}
