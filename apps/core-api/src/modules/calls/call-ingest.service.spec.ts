import { NotFoundException } from '@nestjs/common';
import { CallIngestService } from './call-ingest.service';

describe('CallIngestService', () => {
    it('ingestDelta throws when call is missing', async () => {
        const prisma = {
            callSession: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
        };
        const service = new CallIngestService(
            prisma as any,
            {} as any,
            {} as any,
            {} as any,
        );
        await expect(service.ingestDelta('missing-id', {})).rejects.toBeInstanceOf(NotFoundException);
    });
});
