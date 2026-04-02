import { UserRole } from '@wardline/types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
    it('findOne delegates to service', async () => {
        const usersService = { findOne: jest.fn().mockResolvedValue({ id: 'u1' }) };
        const controller = new UsersController(usersService as unknown as UsersService);
        await expect(controller.findOne('u1')).resolves.toEqual({ id: 'u1' });
        expect(usersService.findOne).toHaveBeenCalledWith('u1');
    });

    it('addUserToBusiness passes role', async () => {
        const usersService = { addUserToBusiness: jest.fn().mockResolvedValue({}) };
        const controller = new UsersController(usersService as unknown as UsersService);
        await controller.addUserToBusiness('u1', 'b1', UserRole.READONLY);
        expect(usersService.addUserToBusiness).toHaveBeenCalledWith('u1', 'b1', UserRole.READONLY);
    });
});
