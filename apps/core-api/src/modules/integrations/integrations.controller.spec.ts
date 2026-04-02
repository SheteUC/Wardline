import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsController', () => {
    it('findAll delegates', async () => {
        const svc = { findAll: jest.fn().mockResolvedValue([]) };
        const c = new IntegrationsController(svc as unknown as IntegrationsService);
        await c.findAll('b1');
        expect(svc.findAll).toHaveBeenCalledWith('b1');
    });

    it('upsert forwards body', async () => {
        const svc = { upsert: jest.fn().mockResolvedValue({}) };
        const c = new IntegrationsController(svc as unknown as IntegrationsService);
        const body = { vendor: 'athenahealth' };
        await c.upsert('b1', 'SCHEDULING', body);
        expect(svc.upsert).toHaveBeenCalledWith('b1', 'SCHEDULING', body);
    });
});
