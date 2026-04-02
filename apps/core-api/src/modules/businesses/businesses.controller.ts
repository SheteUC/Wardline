import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@wardline/types';
import { Public } from '../../auth/public.decorator';
import { Permissions } from '../../auth/permissions.decorator';
import {
    BusinessFindOneQueryDto,
    BusinessListQueryDto,
    BusinessSettingsPatchDto,
    CreateBusinessDto,
    UpdateBusinessDto,
} from './dto/businesses.dto';
import { BusinessesService } from './businesses.service';

@Controller('businesses')
export class BusinessesController {
    constructor(private readonly businessesService: BusinessesService) {}

    @Post()
    create(@Req() request: Request, @Body() body: CreateBusinessDto) {
        return this.businessesService.create(body, request.user?.id);
    }

    @Get()
    findAll(@Req() request: Request, @Query() query: BusinessListQueryDto) {
        const scopedBusinessIds = request.user?.businesses?.map((m) => m.businessId);
        return this.businessesService.findAll(
            query.includeSettings === 'true',
            request.user?.id,
            scopedBusinessIds,
        );
    }

    @Get('by-slug/:slug')
    findBySlug(@Param('slug') slug: string) {
        return this.businessesService.findBySlug(slug);
    }

    @Get('by-phone')
    @Public()
    findByPhone(@Query('phoneNumber') phoneNumber: string) {
        return this.businessesService.findByPhone(phoneNumber);
    }

    @Get(':id/runtime-config')
    @Public()
    getRuntimeConfig(@Param('id') id: string) {
        return this.businessesService.getRuntimeConfig(id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Query() query: BusinessFindOneQueryDto) {
        return this.businessesService.findOne(id, query.includeRelations === 'true');
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() body: UpdateBusinessDto) {
        return this.businessesService.update(id, body);
    }

    @Patch(':id/settings')
    updateSettings(@Param('id') id: string, @Body() body: BusinessSettingsPatchDto) {
        return this.businessesService.updateSettings(id, body);
    }

    @Patch(':id/suspend')
    suspend(@Param('id') id: string) {
        return this.businessesService.suspend(id);
    }

    @Delete(':id')
    @Permissions(UserRole.OWNER)
    archive(@Param('id') id: string, @Req() request: Request) {
        return this.businessesService.archive(id, request.user?.id);
    }
}
