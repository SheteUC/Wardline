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

    it('getRecentEscalations parses limit', async () => {
        const svc = { getRecentEscalations: jest.fn().mockResolvedValue([]) };
        const c = new EscalationsController(svc as unknown as EscalationsService);
        await c.getRecentEscalations('b1', '5');
        expect(svc.getRecentEscalations).toHaveBeenCalledWith('b1', 5);
    });
});
