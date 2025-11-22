import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('workflows')
@ApiBearerAuth()
@Controller('hospitals/:hospitalId/workflows')
export class WorkflowsController {
    constructor(private readonly workflowsService: WorkflowsService) { }

    @Post()
    @Permissions(UserRole.SUPERVISOR)
    @Auditable('workflow', 'CREATE')
    create(
        @Param('hospitalId') hospitalId: string,
        @Body('userId') userId: string,
        @Body() data: any,
    ) {
        return this.workflowsService.create(hospitalId, userId, data);
    }

    @Get()
    @Permissions(UserRole.READONLY)
    findAll(@Param('hospitalId') hospitalId: string) {
        return this.workflowsService.findAllByHospital(hospitalId);
    }

    @Get(':id')
    @Permissions(UserRole.READONLY)
    findOne(@Param('id') id: string) {
        return this.workflowsService.findOne(id);
    }

    @Post(':id/versions')
    @Permissions(UserRole.SUPERVISOR)
    @Auditable('workflow', 'CREATE_VERSION')
    createVersion(
        @Param('id') workflowId: string,
        @Body('userId') userId: string,
        @Body('graphJson') graphJson: any,
    ) {
        return this.workflowsService.createVersion(workflowId, userId, graphJson);
    }

    @Post('versions/:versionId/publish')
    @Permissions(UserRole.ADMIN)
    @Auditable('workflow', 'PUBLISH_VERSION')
    publishVersion(
        @Param('versionId') versionId: string,
        @Body('approverUserId') approverUserId: string,
    ) {
        return this.workflowsService.publishVersion(versionId, approverUserId);
    }
}
