import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { INTERNAL_API_KEY } from '../../auth/internal-api.decorator';
import { IS_PUBLIC_KEY } from '../../auth/public.decorator';

describe('CallsController', () => {
    let controller: CallsController;
    let service: jest.Mocked<Pick<CallsService, 'findAllByBusiness' | 'bootstrapVoiceSession' | 'getCutoverHealthSummary'>>;

    beforeEach(() => {
        service = {
            findAllByBusiness: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            bootstrapVoiceSession: jest.fn(),
            getCutoverHealthSummary: jest.fn().mockResolvedValue({ ready: true }),
        };
        controller = new CallsController(service as unknown as CallsService);
    });

    it('findAll forwards businessId and query filters', async () => {
        const filters = { page: '2', pageSize: '10' };
        await controller.findAll('biz-1', filters as any);
        expect(service.findAllByBusiness).toHaveBeenCalledWith('biz-1', filters);
    });

    it('marks cutover health as public and internal-secret protected', () => {
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller.getCutoverHealthSummary)).toBe(true);
        expect(Reflect.getMetadata(INTERNAL_API_KEY, controller.getCutoverHealthSummary)).toBe(true);
    });
});
