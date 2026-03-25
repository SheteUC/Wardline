jest.mock('ioredis', () => jest.fn());

import Redis from 'ioredis';
import { CacheService, resolveRedisUrl } from './cache.service';

describe('CacheService', () => {
    const originalEnv = { ...process.env };
    let redisHandlers: Record<string, (...args: any[]) => void>;
    let mockRedis: any;
    let createdServices: CacheService[];

    beforeEach(() => {
        process.env = { ...originalEnv, NODE_ENV: 'test' };
        redisHandlers = {};
        createdServices = [];
        mockRedis = {
            on: jest.fn((event: string, handler: (...args: any[]) => void) => {
                redisHandlers[event] = handler;
                return mockRedis;
            }),
            connect: jest.fn(async () => {
                redisHandlers.connect?.();
            }),
            disconnect: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            smembers: jest.fn(),
            scan: jest.fn(),
            flushdb: jest.fn(),
            pipeline: jest.fn(() => ({
                set: jest.fn().mockReturnThis(),
                sadd: jest.fn().mockReturnThis(),
                pexpire: jest.fn().mockReturnThis(),
                del: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([]),
            })),
        };
        (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);
    });

    afterEach(() => {
        for (const service of createdServices) {
            service.onModuleDestroy();
        }
        process.env = originalEnv;
        jest.clearAllMocks();
    });

    it('uses in-memory fallback when REDIS_URL is absent outside development', async () => {
        delete process.env.REDIS_URL;
        process.env.NODE_ENV = 'test';
        const service = new CacheService();
        createdServices.push(service);

        await service.onModuleInit();
        await service.set('foo', { ok: true });

        expect(await service.get('foo')).toEqual({ ok: true });
        expect((Redis as unknown as jest.Mock)).not.toHaveBeenCalled();
        expect(service.getStats().usingRedis).toBe(false);
    });

    it('connects to Redis when REDIS_URL is configured', async () => {
        process.env.REDIS_URL = 'redis://cache-host:6379';
        const service = new CacheService();
        createdServices.push(service);

        await service.onModuleInit();

        expect((Redis as unknown as jest.Mock)).toHaveBeenCalledWith(
            'redis://cache-host:6379',
            expect.objectContaining({
                lazyConnect: true,
                enableOfflineQueue: false,
                maxRetriesPerRequest: 1,
                connectTimeout: 5000,
            }),
        );
        expect(mockRedis.connect).toHaveBeenCalled();
        expect(service.getStats().usingRedis).toBe(true);
    });

    it('defaults to local Redis in development when REDIS_URL is absent', () => {
        expect(resolveRedisUrl({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(
            'redis://localhost:6379',
        );
        expect(resolveRedisUrl({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBeNull();
    });
});
