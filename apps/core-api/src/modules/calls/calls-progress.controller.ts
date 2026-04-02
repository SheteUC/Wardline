import { Controller, Patch, Body, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Logger } from '@wardline/utils';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';

export interface CallProgressUpdate {
    workflow_execution?: {
        workflow_id: string;
        execution_path: string[];
        turn_count: number;
        current_node: string;
        escalated: boolean;
        escalation_reason?: string;
        started_at: string;
        node_data: Record<string, any>;
    };
    current_state?: string;
    sentiment?: {
        frustration: number;
        urgency: number;
    };
}

@ApiTags('calls')
@Controller('api/calls')
export class CallsProgressController {
    private readonly logger = new Logger(CallsProgressController.name);

    @Patch(':callId/progress')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 200, ttl: 60_000 } })
    @ApiOperation({ summary: 'Update call workflow execution progress' })
    @ApiResponse({ status: 200, description: 'Progress updated' })
    async updateProgress(
        @Param('callId') callId: string,
        @Body() progressData: CallProgressUpdate,
    ) {
        this.logger.info(`Progress update for call ${callId}: state=${progressData.current_state}`);

        // In production, update call session in database
        // For now, just log
        return {
            callId,
            updated: true,
            timestamp: new Date().toISOString(),
        };
    }
}
