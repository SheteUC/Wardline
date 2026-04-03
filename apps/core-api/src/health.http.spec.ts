import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './cache/cache.service';

describe('HealthController (http)', () => {
    let app: INestApplication;
    const prisma = {
        $queryRaw: jest.fn(),
    };
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

        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
        delete process.env.REDIS_URL;
    });

    it('serves the liveness endpoint over HTTP', async () => {
        await request(app.getHttpServer())
            .get('/health')
            .expect(200)
            .expect(({ body }) => {
                expect(body).toEqual(
                    expect.objectContaining({
                        status: 'ok',
                        service: 'core-api',
                    }),
                );
                expect(body.timestamp).toEqual(expect.any(String));
            });
    });

    it('returns a 503 readiness response when the database probe fails', async () => {
        prisma.$queryRaw.mockRejectedValue(new Error('db unavailable'));

        await request(app.getHttpServer())
            .get('/ready')
            .expect(503)
            .expect(({ body }) => {
                expect(body.status).toBe('degraded');
                expect(body.checks.database.ok).toBe(false);
            });
    });
});
