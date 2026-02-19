import { Controller, Get, Post, Patch, Param, Query, Body, HttpCode, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../auth/public.decorator';
import { CallsService } from './calls.service';
import { CreateCallDto, UpdateCallDto, SaveTranscriptDto, CreateHandoffDto } from './dto/calls.dto';
import { QueueAssignmentService } from '../queues/queue-assignment.service';
import { QueuesService } from '../queues/queues.service';

@ApiTags('calls')
@Controller('api')
export class CallsController {
    constructor(
        private readonly callsService: CallsService,
        private readonly queuesService: QueuesService,
        private readonly assignmentService: QueueAssignmentService,
    ) { }

    // ========================================
    // Existing endpoints (hospital-scoped)
    // ========================================

    @Get('hospitals/:hospitalId/calls')
    @ApiOperation({ summary: 'Get all calls for a hospital' })
    findAll(@Param('hospitalId') hospitalId: string, @Query() filters: any) {
        return this.callsService.findAllByHospital(hospitalId, filters);
    }

    @Get('hospitals/:hospitalId/calls/analytics')
    @ApiOperation({ summary: 'Get call analytics for a hospital' })
    getAnalytics(
        @Param('hospitalId') hospitalId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.callsService.getAnalytics(
            hospitalId,
            new Date(startDate),
            new Date(endDate),
        );
    }

    @Get('hospitals/:hospitalId/calls/:id')
    @ApiOperation({ summary: 'Get a specific call by ID' })
    findOne(@Param('id') id: string) {
        return this.callsService.findOne(id);
    }

    // ========================================
    // New endpoints (voice-orchestrator API)
    // ========================================

    @Get('calls')
    @Public() // Allow Voice Orchestrator to query calls
    @ApiOperation({ summary: 'Get calls (optionally by Twilio Call SID)' })
    @ApiResponse({ status: 200, description: 'Calls found' })
    async getCalls(@Query('twilioCallSid') twilioCallSid?: string) {
        if (twilioCallSid) {
            return await this.callsService.findByTwilioSid(twilioCallSid);
        }
        return { data: [], message: 'Please provide twilioCallSid query parameter' };
    }

    @Post('calls')
    @Public() // Allow Voice Orchestrator to create calls
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new call session' })
    @ApiResponse({ status: 201, description: 'Call session created' })
    @ApiResponse({ status: 400, description: 'Bad request - phone number not found' })
    async createCall(@Body() dto: CreateCallDto) {
        try {
            return await this.callsService.create(dto);
        } catch (err: unknown) {
            const error = err as Error & { code?: string };
            if (error.message?.includes('Phone number not found')) {
                throw new BadRequestException(error.message);
            }
            throw err;
        }
    }

    @Patch('calls/:id')
    @Public() // Allow Voice Orchestrator to update calls
    @ApiOperation({ summary: 'Update a call session' })
    @ApiResponse({ status: 200, description: 'Call session updated' })
    @ApiResponse({ status: 404, description: 'Call not found' })
    async updateCall(@Param('id') id: string, @Body() dto: UpdateCallDto) {
        try {
            return await this.callsService.update(id, dto);
        } catch (err: unknown) {
            const error = err as Error & { code?: string };
            if (error.code === 'P2025') {
                throw new NotFoundException(`Call not found: ${id}`);
            }
            throw err;
        }
    }

    @Post('calls/:id/transcript')
    @Public() // Allow Voice Orchestrator to save transcripts
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Save transcript segments for a call' })
    @ApiResponse({ status: 201, description: 'Transcript saved' })
    @ApiResponse({ status: 404, description: 'Call not found' })
    async saveTranscript(@Param('id') id: string, @Body() dto: SaveTranscriptDto) {
        try {
            const segments = dto.segments.map(seg => ({
                speaker: seg.speaker,
                text: seg.text,
                timestamp: new Date(seg.timestamp),
                confidence: seg.confidence,
            }));
            return await this.callsService.saveTranscript(id, segments);
        } catch (err: unknown) {
            const error = err as Error & { code?: string };
            if (error.message?.includes('Call not found')) {
                throw new NotFoundException(error.message);
            }
            throw err;
        }
    }

    @Post('calls/:id/escalate')
    @Public()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Escalate a call to a human agent queue' })
    @ApiResponse({ status: 201, description: 'Escalation created' })
    @ApiResponse({ status: 404, description: 'Call not found' })
    async escalateCall(
        @Param('id') callId: string,
        @Body() body: { reason: string; specialization?: string; hospitalId?: string },
    ) {
        // Find call to get hospitalId if not provided
        const call = await this.callsService.findOne(callId);
        const hospitalId = body.hospitalId || call.hospitalId;
        const specialization = body.specialization || 'general';

        // Find or create queue for this specialization
        const queuesResult = await this.queuesService.findAll(hospitalId, { specialization });
        let queue = queuesResult.data?.[0];

        if (!queue) {
            queue = await this.queuesService.create(hospitalId, {
                name: `${specialization} Queue`,
                specialization,
                priority: 0,
            });
        }

        // Mark call as clinical escalation
        await this.callsService.update(callId, {
            tag: 'CLINICAL_ESCALATION',
            handoffReason: body.reason,
        } as any);

        // Assign call to queue
        const assignment = await this.assignmentService.assignCallToAgent(
            queue.id,
            callId,
            { strategy: 'skill_based' },
        );

        return { id: assignment.id, queueId: queue.id, status: assignment.status };
    }

    @Post('handoffs')
    @Public() // Allow Voice Orchestrator to create handoffs
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a handoff record for call escalation' })
    @ApiResponse({ status: 201, description: 'Handoff created' })
    @ApiResponse({ status: 404, description: 'Call not found' })
    async createHandoff(@Body() dto: CreateHandoffDto) {
        try {
            return await this.callsService.createHandoff(dto);
        } catch (err: unknown) {
            const error = err as Error & { code?: string };
            if (error.code === 'P2025') {
                throw new NotFoundException(`Call not found: ${dto.callId}`);
            }
            throw err;
        }
    }
}
