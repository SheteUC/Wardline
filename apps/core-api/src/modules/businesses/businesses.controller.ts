import { Controller, Get, Post, Put, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { Public } from '../../auth/public.decorator';

@Controller('businesses')
export class BusinessesController {
    constructor(private readonly businessesService: BusinessesService) {}

    @Post()
    create(@Req() request: any, @Body() body: { name: string; slug: string; timeZone?: string }) {
        return this.businessesService.create(body, request.user?.id);
    }

    @Get()
    findAll(
        @Req() request: any,
        @Query('includeSettings') includeSettings?: string,
    ) {
        const scopedBusinessIds = request.user?.businesses?.map((membership: any) => membership.businessId);
        return this.businessesService.findAll(
            includeSettings === 'true',
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
    findOne(
        @Param('id') id: string,
        @Query('includeRelations') includeRelations?: string,
    ) {
        return this.businessesService.findOne(id, includeRelations === 'true');
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() body: Partial<{ name: string; slug: string; timeZone: string }>) {
        return this.businessesService.update(id, body);
    }

    @Patch(':id/settings')
    updateSettings(
        @Param('id') id: string,
        @Body() body: Partial<{
            recordingDefault: string;
            transcriptRetentionDays: number;
            operatingHours: unknown;
            enabledActions: unknown;
            afterHoursPolicy: unknown;
            refillPolicy: unknown;
            billingPolicy: unknown;
            insurancePolicy: unknown;
            knowledgeConfig: unknown;
            escalationConfig: unknown;
            outOfScopeKeywords: string[];
            emergencyKeywords: string[];
        }>,
    ) {
        return this.businessesService.updateSettings(id, body);
    }

    @Patch(':id/suspend')
    suspend(@Param('id') id: string) {
        return this.businessesService.suspend(id);
    }
}
