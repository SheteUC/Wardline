import { ConflictException } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

describe('BusinessesService', () => {
    let service: BusinessesService;
    let prisma: any;
    let cache: any;
    let workflowsService: any;

    beforeEach(() => {
        prisma = {
            business: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
            $transaction: jest.fn(),
        };
        cache = {
            getOrSet: jest.fn(),
            invalidateByTag: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };
        workflowsService = {
            getActiveWorkflow: jest.fn(),
            syncPracticeSetupWorkflow: jest.fn().mockResolvedValue(undefined),
        };

        service = new BusinessesService(prisma, cache, workflowsService);
    });

    it('creates an owner membership when a creator user is provided', async () => {
        prisma.business.findFirst.mockResolvedValue(null);

        const createdBusiness = {
            id: 'business-1',
            name: 'Family Practice',
            slug: 'family-practice',
            settings: {},
        };
        const tx = {
            business: {
                create: jest.fn().mockResolvedValue(createdBusiness),
            },
        };
        prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

        const result = await service.create(
            {
                name: 'Family Practice',
                slug: 'family-practice',
                timeZone: 'America/New_York',
            },
            'user-1',
        );

        expect(result).toEqual(createdBusiness);
        expect(tx.business.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    users: {
                        create: {
                            userId: 'user-1',
                            role: 'OWNER',
                        },
                    },
                }),
            }),
        );
        expect(cache.invalidateByTag).toHaveBeenCalledWith('businesses');
        expect(cache.invalidateByTag).toHaveBeenCalledWith('user:user-1:businesses');
        expect(workflowsService.syncPracticeSetupWorkflow).toHaveBeenCalledWith('business-1', 'user-1');
    });

    it('throws when a business with the same name or slug already exists', async () => {
        prisma.business.findFirst.mockResolvedValue({ id: 'existing-business' });

        await expect(
            service.create({ name: 'Family Practice', slug: 'family-practice' }),
        ).rejects.toThrow(ConflictException);
    });

    it('returns an empty list immediately when the user has no memberships', async () => {
        const result = await service.findAll(true, 'user-1', []);

        expect(result).toEqual([]);
        expect(cache.getOrSet).not.toHaveBeenCalled();
        expect(prisma.business.findMany).not.toHaveBeenCalled();
    });
});
