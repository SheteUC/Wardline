import { FollowUpTasksController } from './follow-up-tasks.controller';
import { FollowUpTasksService } from './follow-up-tasks.service';

describe('FollowUpTasksController', () => {
    it('findAll builds filter object', async () => {
        const svc = { findAllByBusiness: jest.fn().mockResolvedValue([]) };
        const c = new FollowUpTasksController(svc as unknown as FollowUpTasksService);
        await c.findAll('b1', 'URGENT', 'OPEN', 'HIGH', 'needle');
        expect(svc.findAllByBusiness).toHaveBeenCalledWith('b1', {
            type: 'URGENT',
            status: 'OPEN',
            priority: 'HIGH',
            search: 'needle',
        });
    });

    it('updateStatus delegates', async () => {
        const svc = { updateStatus: jest.fn().mockResolvedValue({}) };
        const c = new FollowUpTasksController(svc as unknown as FollowUpTasksService);
        await c.updateStatus('b1', 't1', { status: 'COMPLETED' });
        expect(svc.updateStatus).toHaveBeenCalledWith('t1', 'b1', 'COMPLETED');
    });
});
