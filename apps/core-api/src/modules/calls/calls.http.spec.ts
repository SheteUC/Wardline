import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

describe('CallsController (http)', () => {
    let app: INestApplication;
    const callsService = {
        bootstrapVoiceSession: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const moduleRef = await Test.createTestingModule({
            controllers: [CallsController],
            providers: [{ provide: CallsService, useValue: callsService }],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
            prefix: 'v',
        });
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('accepts a valid voice bootstrap payload through the HTTP route', async () => {
        callsService.bootstrapVoiceSession.mockResolvedValue({ callId: 'call-1' });

        await request(app.getHttpServer())
            .post('/v1/api/internal/voice/bootstrap')
            .send({
                direction: 'INBOUND',
                fromNumber: '+15550001111',
                toNumber: '+15551230001',
                twilioCallSid: 'CA123',
            })
            .expect(201)
            .expect({ callId: 'call-1' });

        expect(callsService.bootstrapVoiceSession).toHaveBeenCalledWith(
            expect.objectContaining({
                direction: 'INBOUND',
                fromNumber: '+15550001111',
                toNumber: '+15551230001',
                twilioCallSid: 'CA123',
            }),
        );
    });

    it('rejects invalid bootstrap payloads before they reach the service', async () => {
        await request(app.getHttpServer())
            .post('/v1/api/internal/voice/bootstrap')
            .send({
                fromNumber: '+15550001111',
                toNumber: '+15551230001',
            })
            .expect(400);

        expect(callsService.bootstrapVoiceSession).not.toHaveBeenCalled();
    });
});
