import { RuntimeActionsController } from './runtime-actions.controller';
import { RuntimeActionsService } from './runtime-actions.service';

describe('RuntimeActionsController', () => {
    it('requestAppointment delegates', async () => {
        const svc = { requestAppointment: jest.fn().mockResolvedValue({ handledLive: true }) };
        const c = new RuntimeActionsController(svc as unknown as RuntimeActionsService);
        const body = { callerPhone: '+1', serviceType: 'new' };
        await c.requestAppointment('b1', body);
        expect(svc.requestAppointment).toHaveBeenCalledWith('b1', body);
    });
});
