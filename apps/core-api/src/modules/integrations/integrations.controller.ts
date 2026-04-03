import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { UserRole } from '@wardline/types';
import { Permissions } from '../../auth/permissions.decorator';
import { IntegrationUpsertDto } from './dto/integrations.dto';
import { IntegrationsService } from './integrations.service';

@Controller('api/businesses/:businessId/integrations')
export class IntegrationsController {
    constructor(private readonly integrationsService: IntegrationsService) {}

    @Get()
    @Permissions(UserRole.READONLY)
    findAll(@Param('businessId') businessId: string): Promise<any[]> {
        return this.integrationsService.findAll(businessId);
    }

    @Get(':category')
    @Permissions(UserRole.READONLY)
    findOne(
        @Param('businessId') businessId: string,
        @Param('category') category: string,
    ): Promise<any> {
        return this.integrationsService.findOne(businessId, category);
    }

    @Put(':category')
    @Permissions(UserRole.SUPERVISOR)
    upsert(
        @Param('businessId') businessId: string,
        @Param('category') category: string,
        @Body() body: IntegrationUpsertDto,
    ): Promise<any> {
        return this.integrationsService.upsert(businessId, category, body);
    }

    @Post(':category/test')
    @Permissions(UserRole.SUPERVISOR)
    testConnection(
        @Param('businessId') businessId: string,
        @Param('category') category: string,
    ): Promise<any> {
        return this.integrationsService.testConnection(businessId, category);
    }
}
