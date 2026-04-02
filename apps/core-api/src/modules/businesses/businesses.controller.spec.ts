import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

describe('BusinessesController', () => {
    it('findByPhone delegates to service', async () => {
        const businessesService = {
            findByPhone: jest.fn().mockResolvedValue({ id: 'b1' }),
        };
        const controller = new BusinessesController(businessesService as unknown as BusinessesService);
        await expect(controller.findByPhone('+1555')).resolves.toEqual({ id: 'b1' });
        expect(businessesService.findByPhone).toHaveBeenCalledWith('+1555');
    });
});
