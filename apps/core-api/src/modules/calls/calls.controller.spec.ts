import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

describe('CallsController', () => {
    let controller: CallsController;
    let service: jest.Mocked<Pick<CallsService, 'findAllByBusiness' | 'bootstrapVoiceSession'>>;

    beforeEach(() => {
        service = {
            findAllByBusiness: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            bootstrapVoiceSession: jest.fn(),
        };
        controller = new CallsController(service as unknown as CallsService);
    });

    it('findAll forwards businessId and query filters', async () => {
        const filters = { page: '2', pageSize: '10' };
        await controller.findAll('biz-1', filters as any);
        expect(service.findAllByBusiness).toHaveBeenCalledWith('biz-1', filters);
    });
});
