import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { EscalationsService, EscalationContext } from './escalations.service';

@Controller('api/escalations')
export class EscalationsController {
    constructor(private readonly escalationsService: EscalationsService) {}

    /** Called by voice orchestrator to escalate a call to human transfer */
    @Post('human-transfer')
    @Public()
    escalateToHuman(@Body() context: EscalationContext) {
        return this.escalationsService.escalateToHuman(context);
    }

    /** Called by voice orchestrator to flag a call as emergency */
    @Post('emergency')
    @Public()
    escalateEmergency(@Body() body: {
        callId: string;
        businessId: string;
        callerPhone: string;
        transcript: string;
    }) {
        return this.escalationsService.escalateEmergency(body);
    }

    /** Recent escalations for a business (dashboard) */
    @Get('businesses/:businessId')
    getRecentEscalations(
        @Param('businessId') businessId: string,
        @Query('limit') limit?: string,
    ) {
        return this.escalationsService.getRecentEscalations(businessId, limit ? parseInt(limit) : 20);
    }
}
