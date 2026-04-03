import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@wardline/types';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';
import { Permissions } from '../../auth/permissions.decorator';
import {
    EscalateEmergencyDto,
    EscalateToHumanDto,
    EscalationsListQueryDto,
} from './dto/escalations.dto';
import { EscalationsService } from './escalations.service';
import { normalizePagination } from '../../common/pagination';

@Controller('api/escalations')
export class EscalationsController {
    constructor(private readonly escalationsService: EscalationsService) {}

    /** Called by voice runtime to escalate a call to human transfer */
    @Post('human-transfer')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 60, ttl: 60_000 } })
    escalateToHuman(@Body() context: EscalateToHumanDto) {
        return this.escalationsService.escalateToHuman(context);
    }

    /** Called by voice runtime to flag a call as emergency */
    @Post('emergency')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 60, ttl: 60_000 } })
    escalateEmergency(@Body() body: EscalateEmergencyDto) {
        return this.escalationsService.escalateEmergency(body);
    }

    /** Recent escalations for a business (dashboard) */
    @Get('businesses/:businessId')
    @Permissions(UserRole.READONLY)
    getRecentEscalations(
        @Param('businessId') businessId: string,
        @Query() query: EscalationsListQueryDto,
    ) {
        return this.escalationsService.getRecentEscalations(
            businessId,
            normalizePagination(query, { pageSize: 20 }),
        );
    }
}
