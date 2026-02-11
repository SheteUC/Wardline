import { Controller, Post, Get, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EscalationsService, EscalationContext } from './escalations.service';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('escalations')
@ApiBearerAuth()
@Controller('escalations')
export class EscalationsController {
    constructor(private readonly escalationsService: EscalationsService) {}

    @Post()
    @ApiOperation({ summary: 'Create escalation request from AI to human' })
    @ApiResponse({ status: 201, description: 'Escalation created successfully' })
    @Auditable('escalation', 'CREATE')
    createEscalation(@Body() context: EscalationContext) {
        return this.escalationsService.createEscalation(context);
    }

    @Get(':id')
    @Permissions(UserRole.READONLY)
    @ApiOperation({ summary: 'Get escalation by ID' })
    @ApiResponse({ status: 200, description: 'Escalation details' })
    getEscalation(@Param('id') escalationId: string) {
        return this.escalationsService.getEscalation(escalationId);
    }

    @Put(':id/accept')
    @Permissions(UserRole.AGENT)
    @ApiOperation({ summary: 'Accept escalation (agent accepts call)' })
    @ApiResponse({ status: 200, description: 'Escalation accepted' })
    @Auditable('escalation', 'ACCEPT')
    acceptEscalation(
        @Param('id') escalationId: string,
        @Body('agentId') agentId: string,
    ) {
        return this.escalationsService.acceptEscalation(escalationId, agentId);
    }

    @Put(':id/complete')
    @Permissions(UserRole.AGENT)
    @ApiOperation({ summary: 'Complete escalation' })
    @ApiResponse({ status: 200, description: 'Escalation completed' })
    @Auditable('escalation', 'COMPLETE')
    completeEscalation(
        @Param('id') escalationId: string,
        @Body('outcome') outcome: 'resolved' | 'escalated_further' | 'abandoned',
        @Body('notes') notes?: string,
    ) {
        return this.escalationsService.completeEscalation(escalationId, outcome, notes);
    }

    @Get()
    @Permissions(UserRole.READONLY)
    @ApiOperation({ summary: 'Get pending escalations for a queue' })
    @ApiResponse({ status: 200, description: 'List of pending escalations' })
    getPendingEscalations(@Query('queueId') queueId: string) {
        return this.escalationsService.getPendingEscalations(queueId);
    }
}
