import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import {
    WorkflowCreateDto,
    WorkflowPublishDto,
    WorkflowVersionGraphDto,
} from './dto/workflows.dto';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';

@ApiTags('workflows')
@ApiBearerAuth()
@Controller('businesses/:businessId/workflows')
export class WorkflowsController {
    constructor(private readonly workflowsService: WorkflowsService) { }

    @Post()
    @Permissions(UserRole.SUPERVISOR)
    @Auditable('workflow', 'CREATE')
    create(@Param('businessId') businessId: string, @Body() data: WorkflowCreateDto) {
        const { userId, ...rest } = data;
        return this.workflowsService.create(businessId, userId, rest);
    }

    @Get()
    @Permissions(UserRole.READONLY)
    findAll(@Param('businessId') businessId: string) {
        return this.workflowsService.findAllByBusiness(businessId);
    }

    @Get(':id')
    @Permissions(UserRole.READONLY)
    findOne(@Param('id') id: string) {
        return this.workflowsService.findOne(id);
    }

    @Post(':id/versions')
    @Permissions(UserRole.SUPERVISOR)
    @Auditable('workflow', 'CREATE_VERSION')
    createVersion(@Param('id') workflowId: string, @Body() body: WorkflowVersionGraphDto) {
        return this.workflowsService.createVersion(workflowId, body.userId, body.graphJson);
    }

    @Post('versions/:versionId/publish')
    @Permissions(UserRole.ADMIN)
    @Auditable('workflow', 'PUBLISH_VERSION')
    publishVersion(
        @Param('versionId') versionId: string,
        @Body() body: WorkflowPublishDto,
    ) {
        return this.workflowsService.publishVersion(versionId, body.approverUserId);
    }

    @Post(':id/validate')
    @Permissions(UserRole.SUPERVISOR)
    @ApiOperation({ summary: 'Validate workflow configuration' })
    @ApiResponse({ status: 200, description: 'Validation result with errors and warnings' })
    validateWorkflow(@Param('id') workflowId: string) {
        return this.workflowsService.validateWorkflow(workflowId);
    }

    @Post(':id/simulate')
    @Permissions(UserRole.SUPERVISOR)
    @ApiOperation({ summary: 'Simulate workflow execution with test inputs' })
    @ApiResponse({ status: 200, description: 'Simulation results with execution path' })
    @Auditable('workflow', 'SIMULATE')
    simulateWorkflow(@Param('id') workflowId: string, @Body() body: unknown) {
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            throw new BadRequestException('Simulation body must be a JSON object');
        }
        return this.workflowsService.simulateWorkflow(workflowId, body);
    }
}

// New controller for workflow-related endpoints used by voice orchestrator
@ApiTags('workflows-api')
@Controller('workflows')
export class WorkflowsApiController {
    constructor(private readonly workflowsService: WorkflowsService) { }

    @Get('active')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 120, ttl: 60_000 } })
    @ApiOperation({ summary: 'Get active workflow for business (used by voice orchestrator)' })
    @ApiResponse({ status: 200, description: 'Active workflow configuration with graph JSON' })
    getActiveWorkflow(
        @Query('businessId') businessId?: string,
        @Query('phoneNumberId') phoneNumberId?: string,
    ) {
        return this.workflowsService.getActiveWorkflow(businessId || '', phoneNumberId);
    }
}
