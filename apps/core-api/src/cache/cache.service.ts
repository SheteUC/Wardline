import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Logger } from '@wardline/utils';
import Redis from 'ioredis';

/**
 * Redis-backed cache service with in-memory fallback.
 *
 * Features:
 * - Redis primary store (shared across instances, survives restarts)
 * - In-memory LRU fallback when Redis is unavailable
 * - TTL-based expiration (delegated to Redis)
 * - Tag-based invalidation via Redis Sets
 * - Prefix-based invalidation via Redis SCAN
 * - Statistics tracking
 */

interface FallbackEntry<T> {
    value: T;
    expiresAt: number;
    tags: string[];
    accessedAt: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    evictions: number;
    usingRedis: boolean;
}

export function resolveRedisUrl(env: NodeJS.ProcessEnv = process.env): string | null {
    const configuredUrl = env.REDIS_URL?.trim();
    if (configuredUrl) {
        return configuredUrl;
    }

    if ((env.NODE_ENV ?? 'development') === 'development') {
        return 'redis://localhost:6379';
    }

    return null;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CacheService.name);

    // Redis client (primary)
    private redis: Redis | null = null;
    private redisAvailable = false;

    // In-memory LRU fallback
    private readonly fallback = new Map<string, FallbackEntry<unknown>>();
    private readonly maxFallbackSize = 1000;
    private readonly defaultTtl = 60 * 1000; // 1 minute

    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        size: 0,
        evictions: 0,
        usingRedis: false,
    };

    private cleanupInterval: NodeJS.Timeout | null = null;

    async onModuleInit() {
        await this._connectRedis();
        // Fallback cleanup only needed when Redis is absent
        if (!this.redisAvailable) {
            this.cleanupInterval = setInterval(() => this._cleanupFallback(), 30_000);
        }
    }

    onModuleDestroy() {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        if (this.redis) {
            this.redis.disconnect();
        }
    }

    // -------------------------------------------------------------------------
    // Public API (all methods are now async)
    // -------------------------------------------------------------------------

    async get<T>(key: string): Promise<T | undefined> {
        if (this.redisAvailable && this.redis) {
            try {
                const raw = await this.redis.get(key);
                if (raw === null) {
                    this.stats.misses++;
                    return undefined;
                }
                this.stats.hits++;
                return JSON.parse(raw) as T;
            } catch (err) {
                this.logger.warn(`Redis get error, falling back: ${err}`);
                this._handleRedisError();
            }
        }
        return this._fallbackGet<T>(key);
    }

    async set<T>(
        key: string,
        value: T,
        options?: { ttl?: number; tags?: string[] },
    ): Promise<void> {
        const ttl = options?.ttl ?? this.defaultTtl;
        const tags = options?.tags ?? [];

        if (this.redisAvailable && this.redis) {
            try {
                const pipeline = this.redis.pipeline();
                // Store value with TTL (PX = milliseconds)
                pipeline.set(key, JSON.stringify(value), 'PX', ttl);
                // Register key under each tag set (tag set also expires after ttl)
                for (const tag of tags) {
                    pipeline.sadd(`tag:${tag}`, key);
                    pipeline.pexpire(`tag:${tag}`, ttl * 10); // tag set lives longer
                }
                await pipeline.exec();
                return;
            } catch (err) {
                this.logger.warn(`Redis set error, falling back: ${err}`);
                this._handleRedisError();
            }
        }
        this._fallbackSet(key, value, ttl, tags);
    }

    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        options?: { ttl?: number; tags?: string[] },
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== undefined) return cached;
        const value = await factory();
        await this.set(key, value, options);
        return value;
    }

    async delete(key: string): Promise<boolean> {
        if (this.redisAvailable && this.redis) {
            try {
                const deleted = await this.redis.del(key);
                return deleted > 0;
            } catch (err) {
                this.logger.warn(`Redis del error: ${err}`);
                this._handleRedisError();
            }
        }
        return this.fallback.delete(key);
    }

    async invalidateByTag(tag: string): Promise<number> {
        if (this.redisAvailable && this.redis) {
            try {
                const tagKey = `tag:${tag}`;
                const keys = await this.redis.smembers(tagKey);
                if (keys.length > 0) {
                    const pipeline = this.redis.pipeline();
                    pipeline.del(...keys);
                    pipeline.del(tagKey);
                    await pipeline.exec();
                }
                this.logger.debug(`Redis: invalidated ${keys.length} keys for tag "${tag}"`);
                return keys.length;
            } catch (err) {
                this.logger.warn(`Redis invalidateByTag error: ${err}`);
                this._handleRedisError();
            }
        }
        return this._fallbackInvalidateByTag(tag);
    }

    async invalidateByPrefix(prefix: string): Promise<number> {
        if (this.redisAvailable && this.redis) {
            try {
                let count = 0;
                let cursor = '0';
                do {
                    const [next, keys] = await this.redis.scan(
                        cursor,
                        'MATCH',
                        `${prefix}*`,
                        'COUNT',
                        100,
                    );
                    cursor = next;
                    if (keys.length > 0) {
                        await this.redis.del(...keys);
                        count += keys.length;
                    }
                } while (cursor !== '0');
                this.logger.debug(`Redis: invalidated ${count} keys with prefix "${prefix}"`);
                return count;
            } catch (err) {
                this.logger.warn(`Redis invalidateByPrefix error: ${err}`);
                this._handleRedisError();
            }
        }
        return this._fallbackInvalidateByPrefix(prefix);
    }

    async clear(): Promise<void> {
        if (this.redisAvailable && this.redis) {
            try {
                // Only flush in development to avoid accidental production wipes
                if (process.env.NODE_ENV !== 'production') {
                    await this.redis.flushdb();
                }
                return;
            } catch (err) {
                this.logger.warn(`Redis clear error: ${err}`);
                this._handleRedisError();
            }
        }
        this.fallback.clear();
    }

    getStats(): CacheStats & { hitRate: number } {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            usingRedis: this.redisAvailable,
            hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
        };
    }

    /** Live Redis probe; used by readiness when REDIS_URL is set. */
    async pingRedis(): Promise<{ ok: boolean; detail: string }> {
        if (!this.redis || !this.redisAvailable) {
            return { ok: false, detail: 'not_connected' };
        }
        try {
            const pong = await this.redis.ping();
            return { ok: pong === 'PONG', detail: String(pong) };
        } catch (err) {
            return {
                ok: false,
                detail: err instanceof Error ? err.message : 'ping_failed',
            };
        }
    }

    // -------------------------------------------------------------------------
    // Redis connection management
    // -------------------------------------------------------------------------

    private async _connectRedis() {
        const configuredUrl = process.env.REDIS_URL?.trim();
        const url = resolveRedisUrl();
        if (!url) {
            this.logger.warn('REDIS_URL not set; using in-memory cache fallback');
            return;
        }

        if (!configuredUrl) {
            this.logger.info(`REDIS_URL not set; defaulting to ${url} for local development`);
        }

        try {
            this.redis = new Redis(url, {
                lazyConnect: true,
                enableOfflineQueue: false,
                maxRetriesPerRequest: 1,
                connectTimeout: 5000,
            });

            this.redis.on('error', (err) => {
                if (this.redisAvailable) {
                    this.logger.warn(`Redis error: ${err.message}`);
                }
                this._handleRedisError();
            });

            this.redis.on('connect', () => {
                if (!this.redisAvailable) {
                    this.logger.info('Redis connected; switching to Redis cache');
                    this.redisAvailable = true;
                    this.stats.usingRedis = true;
                }
            });

            await this.redis.connect();
            this.redisAvailable = true;
            this.stats.usingRedis = true;
            this.logger.info('Cache service initialised with Redis');
        } catch (err) {
            this.logger.warn(`Cannot connect to Redis: ${err}; using in-memory fallback`);
            this.redisAvailable = false;
        }
    }

    private _handleRedisError() {
        if (this.redisAvailable) {
            this.redisAvailable = false;
            this.stats.usingRedis = false;
            this.logger.warn('Redis unavailable; falling back to in-memory cache');
        }
    }

    // -------------------------------------------------------------------------
    // In-memory fallback helpers
    // -------------------------------------------------------------------------

    private _fallbackGet<T>(key: string): T | undefined {
        const entry = this.fallback.get(key) as FallbackEntry<T> | undefined;
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.fallback.delete(key);
            this.stats.misses++;
            return undefined;
        }
        entry.accessedAt = Date.now();
        this.stats.hits++;
        return entry.value;
    }

    private _fallbackSet<T>(key: string, value: T, ttl: number, tags: string[]): void {
        if (this.fallback.size >= this.maxFallbackSize && !this.fallback.has(key)) {
            this._evictLRU();
        }
        this.fallback.set(key, {
            value,
            expiresAt: Date.now() + ttl,
            tags,
            accessedAt: Date.now(),
        });
        this.stats.size = this.fallback.size;
    }

    private _fallbackInvalidateByTag(tag: string): number {
        let count = 0;
        for (const [key, entry] of this.fallback.entries()) {
            if (entry.tags.includes(tag)) {
                this.fallback.delete(key);
                count++;
            }
        }
        return count;
    }

    private _fallbackInvalidateByPrefix(prefix: string): number {
        let count = 0;
        for (const key of this.fallback.keys()) {
            if (key.startsWith(prefix)) {
                this.fallback.delete(key);
                count++;
            }
        }
        return count;
    }

    private _cleanupFallback(): void {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.fallback.entries()) {
            if (now > entry.expiresAt) {
                this.fallback.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            this.stats.size = this.fallback.size;
        }
    }

    private _evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.fallback.entries()) {
            if (entry.accessedAt < oldestTime) {
                oldestTime = entry.accessedAt;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.fallback.delete(oldestKey);
            this.stats.evictions++;
        }
    }
}

// ---------------------------------------------------------------------------
// Cache key generators unchanged so callers don't need to update imports
// ---------------------------------------------------------------------------
export const CacheKeys = {
    business: (id: string) => `business:${id}`,
    businessSettings: (id: string) => `business:${id}:settings`,
    businesses: () => 'businesses:list',
    callsList: (businessId: string, hash: string) => `calls:${businessId}:list:${hash}`,
    callDetail: (id: string) => `call:${id}`,
    callAnalytics: (businessId: string, startDate: string, endDate: string) =>
        `calls:${businessId}:analytics:${startDate}:${endDate}`,
    teamMembers: (businessId: string) => `team:${businessId}:members`,
    workflowsList: (businessId: string) => `workflows:${businessId}:list`,
    workflowDetail: (id: string) => `workflow:${id}`,
};

// TTL constants (milliseconds)
export const CacheTTL = {
    SHORT: 30 * 1000,
    MEDIUM: 2 * 60 * 1000,
    LONG: 10 * 60 * 1000,
    ANALYTICS: 60 * 1000,
};
