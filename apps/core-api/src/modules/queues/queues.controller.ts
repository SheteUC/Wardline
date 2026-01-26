import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { QueueAssignmentService } from './queue-assignment.service';
import {
    CreateQueueDto,
    UpdateQueueDto,
    AssignCallDto,
    AcceptAssignmentDto,
    QueueQueryDto,
    AssignmentQueryDto,
} from './dto/queue.dto';

@ApiTags('queues')
@Controller('api/hospitals/:hospitalId')
export class QueuesController {
    constructor(
        private readonly queuesService: QueuesService,
        private readonly assignmentService: QueueAssignmentService,
    ) { }

    // ========================================
    // Queue Management
    // ========================================

    @Post('queues')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new call queue' })
    @ApiResponse({ status: 201, description: 'Queue created' })
    async createQueue(
        @Param('hospitalId') hospitalId: string,
        @Body() dto: CreateQueueDto,
    ) {
        return this.queuesService.create(hospitalId, dto);
    }

    @Get('queues')
    @ApiOperation({ summary: 'List all queues for a hospital' })
    @ApiResponse({ status: 200, description: 'Queues retrieved' })
    async findAllQueues(
        @Param('hospitalId') hospitalId: string,
        @Query() query: QueueQueryDto,
    ) {
        return this.queuesService.findAll(hospitalId, query);
    }

    @Get('queues/:id')
    @ApiOperation({ summary: 'Get queue by ID' })
    @ApiResponse({ status: 200, description: 'Queue retrieved' })
    @ApiResponse({ status: 404, description: 'Queue not found' })
    async findOneQueue(@Param('id') id: string) {
        return this.queuesService.findOne(id);
    }

    @Patch('queues/:id')
    @ApiOperation({ summary: 'Update a queue' })
    @ApiResponse({ status: 200, description: 'Queue updated' })
    @ApiResponse({ status: 404, description: 'Queue not found' })
    async updateQueue(
        @Param('id') id: string,
        @Body() dto: UpdateQueueDto,
    ) {
        return this.queuesService.update(id, dto);
    }

    @Delete('queues/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a queue' })
    @ApiResponse({ status: 204, description: 'Queue deleted' })
    @ApiResponse({ status: 404, description: 'Queue not found' })
    async deleteQueue(@Param('id') id: string) {
        await this.queuesService.delete(id);
    }

    @Get('queues/:id/metrics')
    @ApiOperation({ summary: 'Get queue metrics (depth, wait time, SLA)' })
    @ApiResponse({ status: 200, description: 'Metrics retrieved' })
    async getQueueMetrics(
        @Param('id') id: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.queuesService.getMetrics(
            id,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }

    // ========================================
    // Call Assignment
    // ========================================

    @Post('queues/:id/assign')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Assign a call to the queue (or directly to an agent)' })
    @ApiResponse({ status: 201, description: 'Call assigned' })
    async assignCall(
        @Param('id') queueId: string,
        @Body() dto: AssignCallDto,
    ): Promise<any> {
        if (dto.agentId) {
            // Direct assignment to agent
            return this.assignmentService['createAssignment']({
                callId: dto.callId,
                queueId,
                agentId: dto.agentId,
                status: 'ASSIGNED',
                assignedAt: new Date(),
            });
        }

        // Auto-assign using strategy
        return this.assignmentService.assignCallToAgent(
            queueId,
            dto.callId,
            { strategy: 'skill_based', priorityLevel: dto.priority },
        );
    }

    @Get('assignments')
    @ApiOperation({ summary: 'List all assignments (for agent dashboard)' })
    @ApiResponse({ status: 200, description: 'Assignments retrieved' })
    async getAssignments(
        @Param('hospitalId') hospitalId: string,
        @Query() query: AssignmentQueryDto,
    ) {
        return this.queuesService.getAssignments(hospitalId, query);
    }

    @Post('assignments/:id/accept')
    @ApiOperation({ summary: 'Agent accepts an assignment' })
    @ApiResponse({ status: 200, description: 'Assignment accepted' })
    @ApiResponse({ status: 404, description: 'Assignment not found' })
    async acceptAssignment(
        @Param('id') assignmentId: string,
        @Body() dto: AcceptAssignmentDto,
    ): Promise<any> {
        return this.assignmentService.acceptAssignment(assignmentId, dto.agentId);
    }

    @Post('assignments/:id/complete')
    @ApiOperation({ summary: 'Mark assignment as completed' })
    @ApiResponse({ status: 200, description: 'Assignment completed' })
    async completeAssignment(@Param('id') assignmentId: string) {
        return this.assignmentService.completeAssignment(assignmentId);
    }

    @Post('assignments/:id/abandon')
    @ApiOperation({ summary: 'Mark assignment as abandoned (caller hung up)' })
    @ApiResponse({ status: 200, description: 'Assignment abandoned' })
    async abandonAssignment(@Param('id') assignmentId: string) {
        return this.assignmentService.abandonAssignment(assignmentId);
    }
}
