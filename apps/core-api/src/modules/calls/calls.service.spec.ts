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
        caller: {
            upsert: jest.fn(),
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
                    turnsJson: [
                        {
                            type: 'runtime_action_outcome',
                            actionName: 'appointment-request',
                            domain: 'scheduling',
                            handledLive: true,
                            operatorSummary: 'Appointment request sent',
                            createdAt: '2026-03-24T12:04:00.000Z',
                        },
                    ],
                },
            ]);
            mockPrisma.callSession.count.mockResolvedValue(1);

            const result = await service.findAllByBusiness('business-1');

            expect(result.total).toBe(1);
            expect(mockCache.getOrSet).not.toHaveBeenCalled();
            expect(result.data[0]).toEqual(
                expect.objectContaining({
                    id: 'call-1',
                    businessId: 'business-1',
                    callerName: 'Jane Doe',
                    followUpTaskCount: 1,
                    resolution: 'LIVE_RESOLVED',
                    latestRuntimeAction: 'appointment-request',
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
                                twilioCallSid: 'CA123',
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
                        type: 'intent_detected',
                        actionName: 'intent_detected',
                        domain: 'billing',
                        data: {
                            intentId: 'intent-1',
                            summary: 'billing request about statement balance',
                            status: 'queued',
                            detectedOrder: 1,
                        },
                    },
                    {
                        type: 'intent_selected',
                        actionName: 'intent_selected',
                        domain: 'billing',
                        data: {
                            intentId: 'intent-1',
                            summary: 'billing request about statement balance',
                            status: 'active',
                            detectedOrder: 1,
                            selectedOrder: 1,
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
                        data: { latencyMs: 1200, intentId: 'intent-1' },
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
            expect(mockCache.getOrSet).not.toHaveBeenCalled();
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
                    twilioCallSid: 'CA123',
                    roomName: 'wardline-business-call',
                    twilioStreamSid: 'MZ123',
                    providerSessionId: 'dg-123',
                    deepgramRequestId: 'dg-123',
                }),
            );
            expect(result.intentTimeline).toEqual([
                expect.objectContaining({
                    intentId: 'intent-1',
                    domain: 'billing',
                    summary: 'billing request about statement balance',
                    status: 'resolved',
                    detectedOrder: 1,
                    selectedOrder: 1,
                    actionName: 'billing-request',
                    fallbackReason: 'timeout',
                }),
            ]);
        });

        it('builds an operator fallback summary for abandoned calls with transport events', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue({
                id: 'call-2',
                businessId: 'business-1',
                isEmergency: false,
                tag: null,
                status: 'ABANDONED',
                turnsJson: [
                    {
                        type: 'session_bootstrap',
                        actionName: 'voice-runtime-v2',
                        data: {
                            transport: {
                                runtime: 'voice-runtime-v2',
                                transport: 'livekit',
                                twilioCallSid: 'CA999',
                            },
                        },
                    },
                    {
                        type: 'transport_event',
                        actionName: 'twilio_stream_started',
                        data: {
                            twilioStreamSid: 'MZ999',
                        },
                    },
                ],
                transcriptSegments: [],
                handoffs: [],
                voicemails: [],
                followUpTasks: [],
            });

            const result = await service.findOne('call-2');

            expect(mockCache.getOrSet).not.toHaveBeenCalled();
            expect(result.operatorSummary).toEqual(
                expect.objectContaining({
                    resolution: 'CALL_ABANDONED',
                    label: 'Caller disconnected before completion',
                }),
            );
            expect(result.intentTimeline).toBeUndefined();
        });

        it('surfaces handoff transfer results in the intent timeline', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue({
                id: 'call-3',
                businessId: 'business-1',
                isEmergency: false,
                tag: 'HUMAN_TRANSFER',
                status: 'COMPLETED',
                turnsJson: [
                    {
                        type: 'intent_detected',
                        actionName: 'intent_detected',
                        domain: 'handoff',
                        data: {
                            intentId: 'intent-handoff',
                            summary: 'Medication question',
                            status: 'queued',
                            detectedOrder: 1,
                        },
                    },
                    {
                        type: 'intent_selected',
                        actionName: 'intent_selected',
                        domain: 'handoff',
                        data: {
                            intentId: 'intent-handoff',
                            summary: 'Medication question',
                            status: 'active',
                            detectedOrder: 1,
                            selectedOrder: 1,
                        },
                    },
                    {
                        type: 'handoff_transfer_requested',
                        actionName: 'handoff-transfer',
                        domain: 'handoff',
                        data: {
                            intentId: 'intent-handoff',
                            reasonSummary: 'Medication question',
                            transferTargetLabel: 'front desk',
                        },
                    },
                    {
                        type: 'handoff_transfer_failed',
                        actionName: 'handoff-transfer',
                        domain: 'handoff',
                        followUpTaskId: 'task-callback',
                        fallbackReason: 'no-answer',
                        data: {
                            intentId: 'intent-handoff',
                            reasonSummary: 'Medication question',
                            transferTargetLabel: 'front desk',
                            followUpTaskId: 'task-callback',
                            fallbackReason: 'no-answer',
                        },
                    },
                    {
                        type: 'handoff_callback_requested',
                        actionName: 'manual-follow-up',
                        domain: 'handoff',
                        followUpTaskId: 'task-callback',
                        fallbackReason: 'no-answer',
                        data: {
                            intentId: 'intent-handoff',
                            reasonSummary: 'Medication question',
                            transferTargetLabel: 'front desk',
                            followUpTaskId: 'task-callback',
                            fallbackReason: 'no-answer',
                        },
                    },
                ],
                transcriptSegments: [],
                handoffs: [],
                voicemails: [],
                followUpTasks: [
                    {
                        id: 'task-callback',
                        type: 'MANUAL_REVIEW',
                        status: 'OPEN',
                        priority: 'HIGH',
                    },
                ],
            });

            const result = await service.findOne('call-3');

            expect(result.intentTimeline).toEqual([
                expect.objectContaining({
                    intentId: 'intent-handoff',
                    domain: 'handoff',
                    summary: 'Medication question',
                    status: 'resolved',
                    actionName: 'manual-follow-up',
                    transferStatus: 'callback_requested',
                    transferTargetLabel: 'front desk',
                    followUpTaskId: 'task-callback',
                    fallbackReason: 'no-answer',
                }),
            ]);
        });

        it('throws when the call is missing', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue(null);

            await expect(service.findOne('missing-call')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('creates a call session from the matched business phone number', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue(null);
            mockPrisma.phoneNumber.findFirst.mockResolvedValue({
                id: 'phone-1',
                businessId: 'business-1',
                twilioPhoneNumber: '+15554321',
            });
            mockPrisma.caller.upsert.mockResolvedValue({ id: 'caller-1' });
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
                    callerId: 'caller-1',
                    twilioCallSid: 'CA_test',
                }),
            });
        });

        it('matches the Twilio number even when formatting differs', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue(null);
            mockPrisma.phoneNumber.findFirst.mockResolvedValue({
                id: 'phone-1',
                businessId: 'business-1',
                twilioPhoneNumber: '+15551239999',
            });
            mockPrisma.caller.upsert.mockResolvedValue({ id: 'caller-1' });
            mockPrisma.callSession.create.mockResolvedValue({ id: 'call-1', status: 'INITIATED' });

            const result = await service.create({
                twilioCallSid: 'CA_test',
                direction: 'INBOUND',
                fromNumber: '+15557654321',
                toNumber: '+1 (555) 123-9999',
            });

            expect(result.id).toBe('call-1');
            expect(mockPrisma.phoneNumber.findFirst).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    OR: expect.arrayContaining([
                        { twilioPhoneNumber: '+1 (555) 123-9999' },
                        { twilioPhoneNumber: '15551239999' },
                        { twilioPhoneNumber: '5551239999' },
                        { twilioPhoneNumber: '+15551239999' },
                        { twilioPhoneNumber: { endsWith: '5551239999' } },
                    ]),
                }),
            });
        });

        it('returns the existing call when the same Twilio call SID is created twice', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue({
                id: 'call-existing',
                businessId: 'business-1',
                twilioCallSid: 'CA_repeat',
            });

            const result = await service.create({
                twilioCallSid: 'CA_repeat',
                direction: 'INBOUND',
                fromNumber: '+15557654321',
                toNumber: '+15551239999',
            });

            expect(result.id).toBe('call-existing');
            expect(mockPrisma.callSession.create).not.toHaveBeenCalled();
            expect(mockPrisma.phoneNumber.findFirst).not.toHaveBeenCalled();
        });

        it('recovers from a duplicate create race by returning the existing call', async () => {
            mockPrisma.callSession.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({
                    id: 'call-existing',
                    businessId: 'business-1',
                    twilioCallSid: 'CA_race',
                });
            mockPrisma.phoneNumber.findFirst.mockResolvedValue({
                id: 'phone-1',
                businessId: 'business-1',
                twilioPhoneNumber: '+15551239999',
            });
            mockPrisma.caller.upsert.mockResolvedValue({ id: 'caller-1' });
            mockPrisma.callSession.create.mockRejectedValue({ code: 'P2002' });

            const result = await service.create({
                twilioCallSid: 'CA_race',
                direction: 'INBOUND',
                fromNumber: '+15557654321',
                toNumber: '+15551239999',
            });

            expect(result.id).toBe('call-existing');
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

    describe('getVoicemails', () => {
        it('loads voicemail records directly without caching PHI-bearing payloads', async () => {
            mockPrisma.voicemailRecord.findMany.mockResolvedValue([
                {
                    id: 'voicemail-1',
                    callerName: 'Jane Doe',
                    callerPhone: '+15551234',
                    transcription: 'Please call me back.',
                },
            ]);

            const result = await service.getVoicemails('business-1', true);

            expect(mockCache.getOrSet).not.toHaveBeenCalled();
            expect(mockPrisma.voicemailRecord.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        businessId: 'business-1',
                        isListened: false,
                    }),
                }),
            );
            expect(result).toHaveLength(1);
        });
    });
});
