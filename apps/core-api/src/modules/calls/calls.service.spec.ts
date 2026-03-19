import { Test, TestingModule } from '@nestjs/testing';
import { CallsService } from './calls.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { MedicalTriageGuardService } from '../safety/medical-triage-guard.service';

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
            findUnique: jest.fn(),
        },
        transcriptSegment: {
            createMany: jest.fn(),
            findMany: jest.fn(),
        },
        handoff: { create: jest.fn() },
    };

    const mockCache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
        getOrSet: jest.fn().mockImplementation(async (_key: string, factory: () => Promise<unknown>) => factory()),
        delete: jest.fn(),
        invalidateByTag: jest.fn(),
    };

    const mockTriageGuard = {
        detectMedicalContent: jest.fn().mockResolvedValue({
            isMedical: false,
            requiresHumanEscalation: false,
            triggeredKeywords: [],
            confidence: 0,
        }),
        enforceHumanEscalation: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCache },
                { provide: MedicalTriageGuardService, useValue: mockTriageGuard },
            ],
        }).compile();
        service = module.get<CallsService>(CallsService);
    });

    afterEach(() => jest.clearAllMocks());

    // -----------------------------------------------------------------------
    // findAllByHospital
    // -----------------------------------------------------------------------

    describe('findAllByHospital', () => {
        it('returns paginated results from database', async () => {
            mockPrisma.callSession.findMany.mockResolvedValue([{ id: 'c1' }]);
            mockPrisma.callSession.count.mockResolvedValue(1);
            const result = await service.findAllByHospital('hosp-1');
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('returns cached result when available', async () => {
            const cached = { data: [{ id: 'cached' }], total: 1 };
            mockCache.get.mockResolvedValueOnce(cached);
            const result = await service.findAllByHospital('hosp-1');
            expect(result).toEqual(cached);
            expect(mockPrisma.callSession.findMany).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // findOne
    // -----------------------------------------------------------------------

    describe('findOne', () => {
        it('returns call session with transcript', async () => {
            const mockCall = { id: 'c1', hospitalId: 'hosp-1', transcriptSegments: [] };
            mockPrisma.callSession.findUnique.mockResolvedValue(mockCall);
            const result = await service.findOne('c1');
            expect(result.id).toBe('c1');
        });

        it('returns null when call not found', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue(null);
            const result = await service.findOne('bad');
            expect(result).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // create
    // -----------------------------------------------------------------------

    describe('create', () => {
        it('creates and returns a new call session', async () => {
            mockPrisma.phoneNumber.findUnique.mockResolvedValue({ id: 'pn-1', twilioPhoneNumber: '+15554321' });
            mockPrisma.callSession.create.mockResolvedValue({ id: 'new-call', status: 'INITIATED' });
            const result = await service.create({
                hospitalId: 'hosp-1',
                twilioCallSid: 'CA_test',
                direction: 'INBOUND',
                fromNumber: '+15551234',
                toNumber: '+15554321',
            });
            expect(result.id).toBe('new-call');
        });
    });

    // -----------------------------------------------------------------------
    // saveTranscript
    // -----------------------------------------------------------------------

    describe('saveTranscript', () => {
        const callId = 'call-1';
        const segments = [
            { speaker: 'CALLER', text: 'Hello I need an appointment', timestamp: new Date(), confidence: 0.95 },
        ];

        beforeEach(() => {
            mockPrisma.callSession.findUnique.mockResolvedValue({ startedAt: new Date() });
            mockPrisma.transcriptSegment.createMany.mockResolvedValue({ count: 1 });
        });

        it('creates transcript segments in the database', async () => {
            await service.saveTranscript(callId, segments);
            expect(mockPrisma.transcriptSegment.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.arrayContaining([
                        expect.objectContaining({ callId, text: segments[0].text }),
                    ]),
                }),
            );
        });

        it('invalidates the call detail cache', async () => {
            await service.saveTranscript(callId, segments);
            expect(mockCache.delete).toHaveBeenCalledWith(expect.stringContaining(callId));
        });

        it('triggers medical triage analysis asynchronously', async () => {
            await service.saveTranscript(callId, segments);
            // Allow microtask queue to flush
            await new Promise((r) => setTimeout(r, 0));
            expect(mockTriageGuard.detectMedicalContent).toHaveBeenCalledWith(
                expect.stringContaining('Hello I need an appointment'),
            );
        });

        it('calls enforceHumanEscalation when medical content is detected', async () => {
            mockTriageGuard.detectMedicalContent.mockResolvedValueOnce({
                isMedical: true,
                requiresHumanEscalation: true,
                triggeredKeywords: ['chest pain'],
                confidence: 0.9,
            });

            const medSegments = [
                { speaker: 'CALLER', text: 'I have chest pain', timestamp: new Date(), confidence: 0.95 },
            ];
            await service.saveTranscript(callId, medSegments);
            await new Promise((r) => setTimeout(r, 10));

            expect(mockTriageGuard.enforceHumanEscalation).toHaveBeenCalledWith(
                callId,
                expect.any(String),
                expect.arrayContaining(['chest pain']),
            );
        });

        it('does not fail when triage guard throws', async () => {
            mockTriageGuard.detectMedicalContent.mockRejectedValueOnce(new Error('AI service timeout'));
            await expect(service.saveTranscript(callId, segments)).resolves.not.toThrow();
        });

        it('throws when call is not found', async () => {
            mockPrisma.callSession.findUnique.mockResolvedValue(null);
            await expect(service.saveTranscript('bad-call', segments)).rejects.toThrow('Call not found');
        });
    });
});
