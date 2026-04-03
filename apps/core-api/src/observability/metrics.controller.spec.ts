import { INTERNAL_API_KEY } from '../auth/internal-api.decorator';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
    it('requires the internal API secret while remaining auth-free', () => {
        expect(
            Reflect.getMetadata(IS_PUBLIC_KEY, MetricsController.prototype.metrics),
        ).toBe(true);
        expect(
            Reflect.getMetadata(INTERNAL_API_KEY, MetricsController.prototype.metrics),
        ).toBe(true);
    });
});
