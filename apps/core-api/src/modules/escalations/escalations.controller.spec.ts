import { EscalationsController } from './escalations.controller';
import { EscalationsService } from './escalations.service';

describe('EscalationsController', () => {
    it('escalateToHuman delegates', async () => {
        const svc = { escalateToHuman: jest.fn().mockResolvedValue({ ok: true }) };
        const c = new EscalationsController(svc as unknown as EscalationsService);
        const ctx = { callId: 'c1', businessId: 'b1' } as any;
        await c.escalateToHuman(ctx);
        expect(svc.escalateToHuman).toHaveBeenCalledWith(ctx);
    });

    it('getRecentEscalations normalizes pagination params', async () => {
        const svc = {
            getRecentEscalations: jest.fn().mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                pageSize: 5,
            }),
        };
        const c = new EscalationsController(svc as unknown as EscalationsService);
        await c.getRecentEscalations('b1', { limit: 5 });
        expect(svc.getRecentEscalations).toHaveBeenCalledWith('b1', {
            page: 1,
            pageSize: 5,
            skip: 0,
            take: 5,
        });
    });
});
