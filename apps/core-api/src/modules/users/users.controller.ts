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

    @Post(':userId/businesses/:businessId')
    @ApiOperation({ summary: 'Add user to business' })
    @Permissions(UserRole.ADMIN)
    @Auditable('user', 'ADD_TO_BUSINESS')
    addUserToBusiness(
        @Param('userId') userId: string,
        @Param('businessId') businessId: string,
        @Body('role') role: UserRole,
    ) {
        return this.usersService.addUserToBusiness(userId, businessId, role);
    }

    @Patch(':userId/businesses/:businessId/role')
    @ApiOperation({ summary: 'Update user role in business' })
    @Permissions(UserRole.ADMIN)
    @Auditable('user', 'UPDATE_ROLE')
    updateUserRole(
        @Param('userId') userId: string,
        @Param('businessId') businessId: string,
        @Body('role') role: UserRole,
    ) {
        return this.usersService.updateUserRole(userId, businessId, role);
    }

    @Delete(':userId/businesses/:businessId')
    @ApiOperation({ summary: 'Remove user from business' })
    @Permissions(UserRole.ADMIN)
    @Auditable('user', 'REMOVE_FROM_BUSINESS')
    removeUserFromBusiness(
        @Param('userId') userId: string,
        @Param('businessId') businessId: string,
    ) {
        return this.usersService.removeUserFromBusiness(userId, businessId);
    }
}
