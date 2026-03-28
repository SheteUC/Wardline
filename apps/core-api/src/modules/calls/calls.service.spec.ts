import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CallsService } from './calls.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { FollowUpTasksService } from '../follow-up-tasks/follow-up-tasks.service';

describe('CallsService', () => {
    let service: CallsService;

    const mockPrisma = {
        callSession: {
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        phoneNumber: {
            findFirst: jest.fn(),
        },
        transcriptSegment: {
            createMany: jest.fn(),
        },
        handoff: {
            create: jest.fn(),
        },
        voicemailRecord: {
            create: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        $queryRaw: jest.fn(),
    };

    const mockCache = {
        getOrSet: jest.fn().mockImplementation(async (_key: string, factory: () => Promise<unknown>) => factory()),
        delete: jest.fn(),
        invalidateByTag: jest.fn(),
    };

    const mockFollowUpTasks = {
        create: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCache },
                { provide: FollowUpTasksService, useValue: mockFollowUpTasks },
            ],
        }).compile();

        service = module.get<CallsService>(CallsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findAllByBusiness', () => {
        it('returns paginated business call logs', async () => {
            mockPrisma.callSession.findMany.mockResolvedValue([
                {
                    id: 'call-1',
                    businessId: 'business-1',
                    twilioCallSid: 'CA123',
                    direction: 'INBOUND',
                    status: 'COMPLETED',
                    tag: 'FAQ',
                    isEmergency: false,
                    turnCount: 2,
                    startedAt: new Date('2026-03-24T12:00:00Z'),
                    endedAt: new Date('2026-03-24T12:05:00Z'),
                    sentimentScore: 0.75,
                    phoneNumber: { twilioPhoneNumber: '+15551234567', label: 'Main' },
                    caller: { id: 'caller-1', name: 'Jane Doe', phone: '+15557654321' },
                    voicemails: [],
                    followUpTasks: [{ id: 'task-1', priority: 'HIGH', status: 'OPEN' }],
                },
            ]);
            mockPrisma.callSession.count.mockResolvedValue(1);

            const result = await service.findAllByBusiness('business-1');

            expect(result.total).toBe(1);
            expect(result.data[0]).toEqual(
                expect.objectContaining({
                    id: 'call-1',
                    businessId: 'business-1',
                    callerName: 'Jane Doe',
                    followUpTaskCount: 1,
                }),
            );
        });
    });

    describe('findOne', () => {
        it('returns the full call detail when found', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue({
                id: 'call-1',
                businessId: 'business-1',
                isEmergency: false,
                tag: 'BILLING',
                status: 'COMPLETED',
                turnsJson: [
                    {
                        type: 'session_bootstrap',
                        actionName: 'voice-runtime-v2',
                        data: {
                            transport: {
                                runtime: 'voice-runtime-v2',
                                transport: 'livekit',
                                roomName: 'wardline-business-call',
                                participantIdentity: 'wardline-session-session-1',
                                livekitUrl: 'wss://livekit.example.com',
                                twilioMediaStreamUrl: 'wss://voice.example.com/telephony/twilio/media',
                            },
                        },
                    },
                    {
                        type: 'transport_event',
                        actionName: 'twilio_stream_started',
                        data: {
                            twilioStreamSid: 'MZ123',
                            deepgramRequestId: 'dg-123',
                        },
                    },
                    {
                        type: 'runtime_action_outcome',
                        actionName: 'billing-request',
                        domain: 'billing',
                        integrationCategory: 'BILLING',
                        integrationVendor: 'athenahealth',
                        handledLive: false,
                        followUpTaskId: 'task-1',
                        fallbackReason: 'timeout',
                        operatorSummary: 'Billing request ready',
                        data: { latencyMs: 1200 },
                        createdAt: '2026-03-26T12:00:00.000Z',
                    },
                ],
                transcriptSegments: [],
                handoffs: [],
                voicemails: [],
                followUpTasks: [
                    {
                        id: 'task-1',
                        type: 'BILLING_REQUEST',
                        status: 'OPEN',
                        priority: 'HIGH',
                    },
                ],
            });

            const result = await service.findOne('call-1');

            expect(result.id).toBe('call-1');
            expect(result.runtimeActionEvents).toEqual([
                expect.objectContaining({
                    actionName: 'billing-request',
                    domain: 'billing',
                    handledLive: false,
                    fallbackReason: 'timeout',
                    followUpTaskId: 'task-1',
                    operatorSummary: 'Billing request ready',
                    latencyMs: 1200,
                }),
            ]);
            expect(result.operatorSummary).toEqual(
                expect.objectContaining({
                    label: 'Billing request ready',
                    fallbackReason: 'timeout',
                    actionName: 'billing-request',
                }),
            );
            expect(result.transportSummary).toEqual(
                expect.objectContaining({
                    runtime: 'voice-runtime-v2',
                    transport: 'livekit',
                    roomName: 'wardline-business-call',
                    twilioStreamSid: 'MZ123',
                    providerSessionId: 'dg-123',
                }),
            );
        });

        it('throws when the call is missing', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue(null);

            await expect(service.findOne('missing-call')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('creates a call session from the matched business phone number', async () => {
            mockPrisma.phoneNumber.findFirst.mockResolvedValue({
                id: 'phone-1',
                businessId: 'business-1',
                twilioPhoneNumber: '+15554321',
            });
            mockPrisma.callSession.create.mockResolvedValue({ id: 'call-1', status: 'INITIATED' });

            const result = await service.create({
                twilioCallSid: 'CA_test',
                direction: 'INBOUND',
                fromNumber: '+15551234',
                toNumber: '+15554321',
            });

            expect(result.id).toBe('call-1');
            expect(mockPrisma.callSession.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    businessId: 'business-1',
                    phoneNumberId: 'phone-1',
                    twilioCallSid: 'CA_test',
                }),
            });
        });
    });

    describe('saveTranscript', () => {
        it('persists transcript segments and invalidates the call detail cache', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue({ id: 'call-1' });
            mockPrisma.transcriptSegment.createMany.mockResolvedValue({ count: 1 });

            await service.saveTranscript('call-1', [
                { speaker: 'CALLER', text: 'Hello', confidence: 0.95 },
            ]);

            expect(mockPrisma.transcriptSegment.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.arrayContaining([
                        expect.objectContaining({
                            callId: 'call-1',
                            speaker: 'CALLER',
                            text: 'Hello',
                        }),
                    ]),
                }),
            );
            expect(mockCache.delete).toHaveBeenCalledWith('calls:detail:call-1');
        });
    });

    describe('createVoicemail', () => {
        it('creates a linked follow-up task for urgent voicemail', async () => {
            mockPrisma.voicemailRecord.create.mockResolvedValue({ id: 'voicemail-1' });
            mockPrisma.callSession.update.mockResolvedValue({});

            await service.createVoicemail({
                callId: 'call-1',
                businessId: 'business-1',
                callerPhone: '+15551234',
                callerName: 'Jane Doe',
                recordingUrl: 'https://example.com/audio.mp3',
                context: 'Caller reports an urgent medication issue.',
                isUrgent: true,
                urgencyKeywords: ['urgent'],
            });

            expect(mockFollowUpTasks.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    businessId: 'business-1',
                    voicemailId: 'voicemail-1',
                    type: 'URGENT_CALLBACK',
                    priority: 'URGENT',
                    urgencyKeywords: ['urgent'],
                }),
            );
        });
    });
});
