import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CallsService } from './calls.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { FollowUpTasksService } from '../follow-up-tasks/follow-up-tasks.service';
import { CallProjectionService } from './call-projection.service';
import { CallIngestService } from './call-ingest.service';
import { CallCutoverMetricsService } from './call-cutover-metrics.service';

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
        callEvent: {
            findMany: jest.fn(),
            createMany: jest.fn(),
        },
        callSessionProjection: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
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
        $transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(mockPrisma)),
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

    const mockCallIngest = {
        rebuildProjection: jest.fn(),
        ingestDelta: jest.fn(),
        getCutoverHealthSummary: jest.fn(),
    };

    const mockCutoverMetrics = {
        recordFallbackRead: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCache },
                { provide: FollowUpTasksService, useValue: mockFollowUpTasks },
                CallProjectionService,
                { provide: CallIngestService, useValue: mockCallIngest },
                { provide: CallCutoverMetricsService, useValue: mockCutoverMetrics },
            ],
        }).compile();

        service = module.get<CallsService>(CallsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.CALLS_ENABLE_PROJECTION_FALLBACK;
        delete process.env.VOICE_RUNTIME_LEGACY_CALL_SYNC;
        delete process.env.RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS;
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
                    projection: {
                        latestDomain: 'scheduling',
                        resolution: 'LIVE_RESOLVED',
                        resolutionLabel: 'Appointment request sent',
                        operatorNextStep: 'No staff follow-up is currently required unless the caller contacts the practice again.',
                        latestRuntimeAction: 'appointment-request',
                        handledLive: true,
                        fallbackReason: null,
                    },
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
                projection: {
                    latestDomain: 'billing',
                    resolution: 'FOLLOW_UP_REQUIRED',
                    resolutionLabel: 'Billing request ready',
                    operatorNextStep: 'Open the billing request task and complete the requested staff follow-up.',
                    latestRuntimeAction: 'billing-request',
                    handledLive: false,
                    fallbackReason: 'timeout',
                    transportSummaryJson: {
                        runtime: 'voice-runtime-v2',
                        transport: 'livekit',
                        twilioCallSid: 'CA123',
                        roomName: 'wardline-business-call',
                        participantIdentity: 'wardline-session-session-1',
                        livekitUrl: 'wss://livekit.example.com',
                        twilioMediaStreamUrl: 'wss://voice.example.com/telephony/twilio/media',
                        twilioStreamSid: 'MZ123',
                        providerSessionId: 'dg-123',
                        deepgramRequestId: 'dg-123',
                        transcriptEventCount: 0,
                    },
                    intentTimelineJson: [
                        {
                            intentId: 'intent-1',
                            domain: 'billing',
                            summary: 'billing request about statement balance',
                            status: 'resolved',
                            detectedOrder: 1,
                            selectedOrder: 1,
                            actionName: 'billing-request',
                            fallbackReason: 'timeout',
                        },
                    ],
                    operatorSummaryJson: {
                        resolution: 'FOLLOW_UP_REQUIRED',
                        label: 'Billing request ready',
                        nextStep: 'Open the billing request task and complete the requested staff follow-up.',
                        actionName: 'billing-request',
                        handledLive: false,
                        followUpTaskId: 'task-1',
                        fallbackReason: 'timeout',
                    },
                },
                callEvents: [
                    {
                        payload: {
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
            mockPrisma.callSession.findUnique
                .mockResolvedValueOnce({
                    id: 'call-2',
                    businessId: 'business-1',
                    isEmergency: false,
                    tag: null,
                    status: 'ABANDONED',
                    callEvents: [],
                    projection: null,
                    transcriptSegments: [],
                    handoffs: [],
                    voicemails: [],
                    followUpTasks: [],
                })
                .mockResolvedValueOnce({
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

        it('does not query legacy turns when projection fallback is disabled', async () => {
            process.env.CALLS_ENABLE_PROJECTION_FALLBACK = 'false';
            mockPrisma.callSession.findUnique.mockResolvedValue({
                id: 'call-2',
                businessId: 'business-1',
                isEmergency: false,
                tag: null,
                status: 'ABANDONED',
                callEvents: [],
                projection: null,
                transcriptSegments: [],
                handoffs: [],
                voicemails: [],
                followUpTasks: [],
            });

            const result = await service.findOne('call-2');

            expect(result.operatorSummary).toEqual(
                expect.objectContaining({
                    resolution: 'CALL_ABANDONED',
                    label: 'Caller disconnected before completion',
                }),
            );
            expect(mockPrisma.callSession.findUnique).toHaveBeenCalledTimes(1);
            expect(mockCutoverMetrics.recordFallbackRead).not.toHaveBeenCalled();
        });

        it('surfaces handoff transfer results in the intent timeline', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue({
                id: 'call-3',
                businessId: 'business-1',
                isEmergency: false,
                tag: 'HUMAN_TRANSFER',
                status: 'COMPLETED',
                projection: {
                    latestDomain: 'handoff',
                    resolution: 'FOLLOW_UP_REQUIRED',
                    resolutionLabel: 'Staff follow-up required',
                    operatorNextStep: 'Open the manual review task and complete the requested staff follow-up.',
                    latestRuntimeAction: 'manual-follow-up',
                    handledLive: false,
                    fallbackReason: 'no-answer',
                    transportSummaryJson: null,
                    intentTimelineJson: [
                        {
                            intentId: 'intent-handoff',
                            domain: 'handoff',
                            summary: 'Medication question',
                            status: 'resolved',
                            actionName: 'manual-follow-up',
                            transferStatus: 'callback_requested',
                            transferTargetLabel: 'front desk',
                            followUpTaskId: 'task-callback',
                            fallbackReason: 'no-answer',
                        },
                    ],
                    operatorSummaryJson: {
                        resolution: 'FOLLOW_UP_REQUIRED',
                        label: 'Staff follow-up required',
                        nextStep: 'Open the manual review task and complete the requested staff follow-up.',
                    },
                },
                callEvents: [],
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

    describe('bootstrapVoiceSession', () => {
        it('returns the runtime bootstrap payload in one call', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue(null);
            mockPrisma.phoneNumber.findFirst.mockResolvedValue({
                id: 'phone-1',
                businessId: 'business-1',
                business: {
                    id: 'business-1',
                    name: 'Wardline Family Medicine',
                    slug: 'wardline-family',
                    status: 'ACTIVE',
                    timeZone: 'America/New_York',
                    updatedAt: new Date('2026-03-31T12:00:00Z'),
                    settings: null,
                    integrations: [
                        {
                            id: 'integration-1',
                            category: 'SCHEDULING',
                            vendor: 'athenahealth',
                            status: 'CONNECTED',
                            capabilities: { live: true },
                            lastHealthCheckAt: new Date('2026-03-31T12:00:00Z'),
                        },
                    ],
                    phoneNumbers: [
                        {
                            id: 'phone-1',
                            label: 'Main',
                            twilioPhoneNumber: '+15551234567',
                        },
                    ],
                },
            });
            mockPrisma.caller.upsert.mockResolvedValue({ id: 'caller-1' });
            mockPrisma.callSession.create.mockResolvedValue({
                id: 'call-bootstrap',
                businessId: 'business-1',
            });

            const result = await service.bootstrapVoiceSession({
                direction: 'INBOUND',
                fromNumber: '+15557654321',
                toNumber: '+15551234567',
                twilioCallSid: 'CA_bootstrap',
            });

            expect(result).toEqual(
                expect.objectContaining({
                    callId: 'call-bootstrap',
                    business: expect.objectContaining({
                        id: 'business-1',
                        name: 'Wardline Family Medicine',
                    }),
                    phoneNumbers: [
                        expect.objectContaining({
                            id: 'phone-1',
                            label: 'Main',
                        }),
                    ],
                    connectedIntegrationCategories: ['SCHEDULING'],
                    voicePolicyV2: expect.any(Object),
                }),
            );
            expect(mockCallIngest.rebuildProjection).toHaveBeenCalledWith('call-bootstrap');
        });
    });

    describe('ingestCall', () => {
        it('delegates delta ingest to the shared ingest service', async () => {
            mockCallIngest.ingestDelta.mockResolvedValue({
                accepted: true,
                callId: 'call-1',
                ingestedEventCount: 1,
            });

            const result = await service.ingestCall('call-1', {
                sessionId: 'session-1',
                events: [{ sequence: 1, type: 'session_bootstrap' }],
                transcriptSegments: [{ speaker: 'CALLER', text: 'Hello' }],
                statePatch: { status: 'ONGOING' },
            });

            expect(result).toEqual(
                expect.objectContaining({
                    accepted: true,
                    callId: 'call-1',
                }),
            );
            expect(mockCallIngest.ingestDelta).toHaveBeenCalledWith(
                'call-1',
                {
                    sessionId: 'session-1',
                    events: [{ sequence: 1, type: 'session_bootstrap' }],
                    transcriptSegments: [{ speaker: 'CALLER', text: 'Hello' }],
                    statePatch: { status: 'ONGOING' },
                },
                {
                    dualWriteLegacyTurns: false,
                },
            );
        });
    });

    describe('getCutoverHealthSummary', () => {
        it('returns counts plus rollout flag state', async () => {
            process.env.CALLS_ENABLE_PROJECTION_FALLBACK = 'false';
            process.env.VOICE_RUNTIME_LEGACY_CALL_SYNC = 'false';
            process.env.RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS = 'true';
            mockCallIngest.getCutoverHealthSummary.mockResolvedValue({
                callCount: 10,
                projectionRowCount: 10,
                fallbackReadCount: 0,
                ingestFailureCount: 0,
                projectionRebuildFailureCount: 0,
            });

            await expect(service.getCutoverHealthSummary()).resolves.toEqual({
                callCount: 10,
                projectionRowCount: 10,
                fallbackReadCount: 0,
                ingestFailureCount: 0,
                projectionRebuildFailureCount: 0,
                CALLS_ENABLE_PROJECTION_FALLBACK: false,
                VOICE_RUNTIME_LEGACY_CALL_SYNC: false,
                RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS: true,
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
            expect(mockCallIngest.rebuildProjection).toHaveBeenCalledWith('call-1');
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
            expect(mockCallIngest.rebuildProjection).toHaveBeenCalledWith('call-1');
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
