import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';
import {
    CreateFollowUpTaskDto,
    FollowUpTaskListQueryDto,
    FollowUpTaskStatusUpdateDto,
} from './dto/follow-up-tasks.dto';
import { FollowUpTasksService } from './follow-up-tasks.service';

@Controller('api/businesses/:businessId/follow-up-tasks')
export class FollowUpTasksController {
    constructor(private readonly followUpTasksService: FollowUpTasksService) {}

    @Get()
    findAll(@Param('businessId') businessId: string, @Query() query: FollowUpTaskListQueryDto) {
        return this.followUpTasksService.findAllByBusiness(businessId, {
            type: query.type,
            status: query.status,
            priority: query.priority,
            search: query.search,
        });
    }

    @Post()
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 120, ttl: 60_000 } })
    create(@Param('businessId') businessId: string, @Body() body: CreateFollowUpTaskDto) {
        const { dueAt, ...rest } = body;
        return this.followUpTasksService.create({
            businessId,
            ...rest,
            dueAt: dueAt ? new Date(dueAt) : undefined,
        });
    }

    @Patch(':id/status')
    updateStatus(
        @Param('businessId') businessId: string,
        @Param('id') id: string,
        @Body() body: FollowUpTaskStatusUpdateDto,
    ) {
        return this.followUpTasksService.updateStatus(id, businessId, body.status);
    }
}
