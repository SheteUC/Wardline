import { FollowUpTasksService } from './follow-up-tasks.service';

describe('FollowUpTasksService', () => {
    let service: FollowUpTasksService;
    let prisma: any;
    let cache: any;

    beforeEach(() => {
        prisma = {
            followUpTask: {
                findMany: jest.fn(),
                create: jest.fn(),
                upsert: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        };
        cache = {
            getOrSet: jest.fn(),
            invalidateByTag: jest.fn().mockResolvedValue(undefined),
        };

        service = new FollowUpTasksService(prisma, cache);
    });

    it('queries follow-up tasks directly and sorts by priority before recency', async () => {
        prisma.followUpTask.findMany.mockResolvedValue([
            {
                id: 'task-normal',
                priority: 'NORMAL',
                createdAt: new Date('2026-03-29T10:00:00Z'),
            },
            {
                id: 'task-urgent',
                priority: 'URGENT',
                createdAt: new Date('2026-03-28T10:00:00Z'),
            },
            {
                id: 'task-high-newer',
                priority: 'HIGH',
                createdAt: new Date('2026-03-30T10:00:00Z'),
            },
        ]);

        const result = await service.findAllByBusiness('business-1', {
            search: 'Jane',
        });

        expect(cache.getOrSet).not.toHaveBeenCalled();
        expect(prisma.followUpTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    businessId: 'business-1',
                    OR: expect.any(Array),
                }),
            }),
        );
        expect(result.map((task: any) => task.id)).toEqual([
            'task-urgent',
            'task-high-newer',
            'task-normal',
        ]);
    });
});
