import { TranscriptRetentionTask } from './transcript-retention.task';

describe('TranscriptRetentionTask', () => {
    let task: TranscriptRetentionTask;
    let prisma: any;
    let auditService: any;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-30T12:00:00Z'));

        prisma = {
            business: {
                findMany: jest.fn(),
            },
            callSession: {
                findMany: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            transcriptSegment: {
                deleteMany: jest.fn(),
            },
            voicemailRecord: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
        };
        auditService = {
            logAction: jest.fn().mockResolvedValue(undefined),
        };

        task = new TranscriptRetentionTask(prisma, auditService);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('deletes expired transcript segments using business-specific retention windows', async () => {
        const sharedCandidateCutoff = new Date('2026-03-30T12:00:00Z');
        sharedCandidateCutoff.setDate(sharedCandidateCutoff.getDate() - 14);

        prisma.business.findMany.mockResolvedValue([
            {
                id: 'business-1',
                settings: {
                    transcriptRetentionDays: 14,
                },
            },
            {
                id: 'business-2',
                settings: null,
            },
        ]);
        prisma.callSession.findMany.mockResolvedValue([
            {
                id: 'call-1',
                businessId: 'business-1',
                startedAt: new Date('2026-03-10T09:00:00Z'),
            },
            {
                id: 'call-2',
                businessId: 'business-1',
                startedAt: new Date('2026-03-01T18:00:00Z'),
            },
            {
                id: 'call-3',
                businessId: 'business-2',
                startedAt: new Date('2026-03-15T18:00:00Z'),
            },
        ]);
        prisma.transcriptSegment.deleteMany.mockResolvedValue({ count: 3 });

        await task.runRetentionCleanup();

        expect(prisma.callSession.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.callSession.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    businessId: {
                        in: ['business-1', 'business-2'],
                    },
                    startedAt: {
                        lt: sharedCandidateCutoff,
                    },
                }),
            }),
        );
        expect(prisma.transcriptSegment.deleteMany).toHaveBeenCalledWith({
            where: { callId: { in: ['call-1', 'call-2'] } },
        });
        expect(auditService.logAction).toHaveBeenCalledWith(
            expect.objectContaining({
                businessId: 'business-1',
                action: 'TRANSCRIPT_RETENTION_CLEANUP',
                entityType: 'TranscriptSegment',
                metadata: expect.objectContaining({
                    deletedTranscriptSegments: 3,
                    retentionDays: 14,
                    affectedCallIds: ['call-1', 'call-2'],
                }),
            }),
        );
        expect(auditService.logAction).toHaveBeenCalledTimes(1);
    });

    it('swallows cleanup failures so the scheduler does not crash the process', async () => {
        prisma.business.findMany.mockRejectedValue(new Error('database unavailable'));

        await expect(task.runRetentionCleanup()).resolves.not.toThrow();
        expect(auditService.logAction).not.toHaveBeenCalled();
    });
});
