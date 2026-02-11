import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HospitalConfigService } from './hospital-config.service';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('hospitals')
@ApiBearerAuth()
@Controller('hospitals/:hospitalId/config')
export class HospitalConfigController {
    constructor(private readonly configService: HospitalConfigService) {}

    @Get()
    @Permissions(UserRole.READONLY)
    @ApiOperation({ summary: 'Get hospital configuration' })
    @ApiResponse({ status: 200, description: 'Hospital configuration returned' })
    getConfig(@Param('hospitalId') hospitalId: string) {
        return this.configService.getConfig(hospitalId);
    }

    @Put()
    @Permissions(UserRole.ADMIN)
    @Auditable('hospital_config', 'UPDATE')
    @ApiOperation({ summary: 'Update hospital configuration' })
    @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
    updateConfig(
        @Param('hospitalId') hospitalId: string,
        @Body() updates: any,
    ) {
        return this.configService.updateConfig(hospitalId, updates);
    }

    @Get('tools')
    @Permissions(UserRole.READONLY)
    @ApiOperation({ summary: 'Get enabled tools for hospital' })
    @ApiResponse({ status: 200, description: 'List of enabled tools' })
    getEnabledTools(@Param('hospitalId') hospitalId: string) {
        return this.configService.getEnabledTools(hospitalId);
    }
}
