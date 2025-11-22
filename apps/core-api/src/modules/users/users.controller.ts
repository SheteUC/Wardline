import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserRole } from '@wardline/types';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @ApiOperation({ summary: 'Get all users' })
    @Permissions(UserRole.ADMIN)
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get user by ID' })
    @Permissions(UserRole.READONLY)
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Post(':userId/hospitals/:hospitalId')
    @ApiOperation({ summary: 'Add user to hospital' })
    @Permissions(UserRole.ADMIN)
    @Auditable('user', 'ADD_TO_HOSPITAL')
    addUserToHospital(
        @Param('userId') userId: string,
        @Param('hospitalId') hospitalId: string,
        @Body('role') role: UserRole,
    ) {
        return this.usersService.addUserToHospital(userId, hospitalId, role);
    }

    @Patch(':userId/hospitals/:hospitalId/role')
    @ApiOperation({ summary: 'Update user role in hospital' })
    @Permissions(UserRole.ADMIN)
    @Auditable('user', 'UPDATE_ROLE')
    updateUserRole(
        @Param('userId') userId: string,
        @Param('hospitalId') hospitalId: string,
        @Body('role') role: UserRole,
    ) {
        return this.usersService.updateUserRole(userId, hospitalId, role);
    }

    @Delete(':userId/hospitals/:hospitalId')
    @ApiOperation({ summary: 'Remove user from hospital' })
    @Permissions(UserRole.ADMIN)
    @Auditable('user', 'REMOVE_FROM_HOSPITAL')
    removeUserFromHospital(
        @Param('userId') userId: string,
        @Param('hospitalId') hospitalId: string,
    ) {
        return this.usersService.removeUserFromHospital(userId, hospitalId);
    }
}
