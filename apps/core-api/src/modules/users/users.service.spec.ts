import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
    it('findOne throws when user missing', async () => {
        const prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
        };
        const service = new UsersService(prisma as any);
        await expect(service.findOne('u-unknown')).rejects.toBeInstanceOf(NotFoundException);
    });
});
