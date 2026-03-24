import { Controller, Get, Post, Put, Patch, Body, Param, Query } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

@Controller('businesses')
export class BusinessesController {
    constructor(private readonly businessesService: BusinessesService) {}

    @Post()
    create(@Body() body: { name: string; slug: string; timeZone?: string }) {
        return this.businessesService.create(body);
    }

    @Get()
    findAll(
        @Query('includeSettings') includeSettings?: string,
    ) {
        return this.businessesService.findAll(includeSettings === 'true');
    }

    @Get('by-slug/:slug')
    findBySlug(@Param('slug') slug: string) {
        return this.businessesService.findBySlug(slug);
    }

    @Get('by-phone')
    findByPhone(@Query('phoneNumber') phoneNumber: string) {
        return this.businessesService.findByPhone(phoneNumber);
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
