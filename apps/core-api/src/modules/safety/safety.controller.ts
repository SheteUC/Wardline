import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Permissions } from '../../auth/permissions.decorator';
import { UserRole } from '@wardline/types';
import { Logger } from '@wardline/utils';

export interface SafetyEvent {
    call_id: string;
    hospital_id: string;
    keyword: string;
    category: string;
    severity: string;
    context: string;
    action_taken: string;
    timestamp: string;
    is_emergency: boolean;
}

@ApiTags('safety')
@ApiBearerAuth()
@Controller('safety')
export class SafetyController {
    private readonly logger = new Logger(SafetyController.name);

    @Post('events')
    @ApiOperation({ summary: 'Create safety event record' })
    @ApiResponse({ status: 201, description: 'Safety event logged' })
    async createSafetyEvent(@Body() event: SafetyEvent) {
        this.logger.warn(
            `Safety event: ${event.severity} - ${event.keyword} ` +
            `(call: ${event.call_id}, action: ${event.action_taken})`
        );

        // In production, this would save to database
        // For now, just log and return
        return {
            id: `safety-${Date.now()}`,
            ...event,
            createdAt: new Date().toISOString(),
        };
    }

    @Get('events')
    @Permissions(UserRole.SUPERVISOR)
    @ApiOperation({ summary: 'Get safety events for a hospital' })
    @ApiResponse({ status: 200, description: 'List of safety events' })
    getSafetyEvents(
        @Query('hospitalId') hospitalId: string,
        @Query('severity') severity?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        // In production, query from database
        this.logger.log(`Fetching safety events for hospital ${hospitalId}`);
        return {
            data: [],
            filters: { severity, startDate, endDate },
        };
    }

    @Get('events/:callId')
    @Permissions(UserRole.READONLY)
    @ApiOperation({ summary: 'Get safety events for a specific call' })
    @ApiResponse({ status: 200, description: 'Safety events for call' })
    getSafetyEventsForCall(@Param('callId') callId: string) {
        this.logger.log(`Fetching safety events for call ${callId}`);
        return {
            callId,
            events: [],
        };
    }
}
