import { NotFoundException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService', () => {
    it('findOne throws when integration row missing', async () => {
        const prisma = {
            businessIntegration: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
        };
        const connectors = {
            normalizeSettings: jest.fn(),
            buildCapabilities: jest.fn(),
        };
        const service = new IntegrationsService(
            prisma as any,
            {} as any,
            {} as any,
            connectors as any,
            {} as any,
        );
        await expect(service.findOne('b1', 'SCHEDULING')).rejects.toBeInstanceOf(NotFoundException);
    });
});
