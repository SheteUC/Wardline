import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Logger } from '@wardline/utils';

/**
 * In-memory cache service for frequently accessed data.
 * Reduces database load and improves response times.
 * 
 * Features:
 * - TTL-based expiration
 * - LRU eviction when max size is reached
 * - Tag-based invalidation for related data
 * - Statistics tracking
 */

interface CacheEntry<T> {
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
}

@Injectable()
export class CacheService implements OnModuleDestroy {
    private readonly logger = new Logger(CacheService.name);
    private readonly cache = new Map<string, CacheEntry<unknown>>();
    private readonly maxSize = 1000; // Max entries in cache
    private readonly defaultTtl = 60 * 1000; // 1 minute default TTL
    private stats: CacheStats = { hits: 0, misses: 0, size: 0, evictions: 0 };
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Run cleanup every 30 seconds
        this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
        this.logger.info('Cache service initialized');
    }

    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    /**
     * Get a value from the cache
     * @param key - Cache key
     * @returns Cached value or undefined if not found/expired
     */
    get<T>(key: string): T | undefined {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        // Update access time for LRU
        entry.accessedAt = Date.now();
        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set a value in the cache
     * @param key - Cache key
     * @param value - Value to cache
     * @param options - TTL in ms and tags for invalidation
     */
    set<T>(key: string, value: T, options?: { ttl?: number; tags?: string[] }): void {
        const ttl = options?.ttl ?? this.defaultTtl;
        const tags = options?.tags ?? [];

        // Evict if at max size
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl,
            tags,
            accessedAt: Date.now(),
        });

        this.stats.size = this.cache.size;
    }

    /**
     * Get or set a value - runs the factory if cache miss
     * @param key - Cache key
     * @param factory - Async function to produce the value if not cached
     * @param options - TTL and tags
     */
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        options?: { ttl?: number; tags?: string[] }
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            return cached;
        }

        const value = await factory();
        this.set(key, value, options);
        return value;
    }

    /**
     * Delete a specific key from the cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Invalidate all entries with a specific tag
     * Useful for invalidating related data (e.g., all hospital data)
     */
    invalidateByTag(tag: string): number {
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags.includes(tag)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.logger.debug(`Invalidated ${count} entries with tag: ${tag}`);
        return count;
    }

    /**
     * Invalidate all entries matching a key prefix
     */
    invalidateByPrefix(prefix: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.logger.debug(`Invalidated ${count} entries with prefix: ${prefix}`);
        return count;
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
        this.stats.size = 0;
        this.logger.info('Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats & { hitRate: number } {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
        };
    }

    /**
     * Remove expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            this.stats.size = this.cache.size;
            this.logger.debug(`Cleaned up ${removed} expired entries`);
        }
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.accessedAt < oldestTime) {
                oldestTime = entry.accessedAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
        }
    }
}

// Cache key generators for consistent key formatting
export const CacheKeys = {
    // Hospital cache keys
    hospital: (id: string) => `hospital:${id}`,
    hospitalSettings: (id: string) => `hospital:${id}:settings`,
    hospitals: () => 'hospitals:list',

    // Calls cache keys
    callsList: (hospitalId: string, hash: string) => `calls:${hospitalId}:list:${hash}`,
    callDetail: (id: string) => `call:${id}`,
    callAnalytics: (hospitalId: string, startDate: string, endDate: string) =>
        `calls:${hospitalId}:analytics:${startDate}:${endDate}`,

    // Team cache keys
    teamMembers: (hospitalId: string) => `team:${hospitalId}:members`,

    // Workflows cache keys
    workflowsList: (hospitalId: string) => `workflows:${hospitalId}:list`,
    workflowDetail: (id: string) => `workflow:${id}`,
};

// TTL constants (in milliseconds)
export const CacheTTL = {
    SHORT: 30 * 1000,      // 30 seconds - for frequently changing data
    MEDIUM: 2 * 60 * 1000, // 2 minutes - for moderately changing data
    LONG: 10 * 60 * 1000,  // 10 minutes - for rarely changing data
    ANALYTICS: 60 * 1000,  // 1 minute - for analytics (balance freshness vs. performance)
};

