import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { UserRole } from '@wardline/types';
import { PERMISSIONS_KEY } from '../../auth/permissions.constants';

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

    it('protects integration writes behind supervisor permissions', () => {
        expect(
            Reflect.getMetadata(PERMISSIONS_KEY, IntegrationsController.prototype.upsert),
        ).toEqual([UserRole.SUPERVISOR]);
    });
});
