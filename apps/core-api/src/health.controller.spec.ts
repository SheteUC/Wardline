import { HealthController } from './health.controller';

describe('HealthController', () => {
    it('returns a healthy status payload', () => {
        const controller = new HealthController();

        expect(controller.checkHealth()).toEqual(
            expect.objectContaining({
                status: 'healthy',
                service: 'core-api',
                timestamp: expect.any(String),
            }),
        );
    });
});
