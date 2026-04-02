import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './cache/cache.service';

describe('HealthController', () => {
    let controller: HealthController;
    const prisma = { $queryRaw: jest.fn() };
    const cache = {
        pingRedis: jest.fn(),
        getStats: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const moduleRef = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                { provide: PrismaService, useValue: prisma },
                { provide: CacheService, useValue: cache },
            ],
        }).compile();
        controller = moduleRef.get(HealthController);
    });

    it('returns liveness without dependencies', () => {
        expect(controller.checkLiveness()).toEqual(
            expect.objectContaining({
                status: 'ok',
                service: 'core-api',
                timestamp: expect.any(String),
            }),
        );
    });

    it('readiness passes when database and configured Redis respond', async () => {
        prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        process.env.REDIS_URL = 'redis://localhost:6379';
        cache.getStats.mockReturnValue({ usingRedis: true, hits: 0, misses: 0 });
        cache.pingRedis.mockResolvedValue({ ok: true, detail: 'PONG' });

        await expect(controller.readiness()).resolves.toMatchObject({
            status: 'ready',
            checks: expect.objectContaining({
                database: { ok: true },
            }),
        });

        delete process.env.REDIS_URL;
    });

    it('readiness returns 503 when database query fails', async () => {
        prisma.$queryRaw.mockRejectedValue(new Error('db down'));
        delete process.env.REDIS_URL;

        try {
            await controller.readiness();
            throw new Error('expected HttpException');
        } catch (e: unknown) {
            expect(e).toBeInstanceOf(HttpException);
            expect((e as HttpException).getStatus()).toBe(503);
        }
    });
});
