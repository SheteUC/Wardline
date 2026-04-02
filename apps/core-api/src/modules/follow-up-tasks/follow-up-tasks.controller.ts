import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';
import { FollowUpTasksService } from './follow-up-tasks.service';

@Controller('api/businesses/:businessId/follow-up-tasks')
export class FollowUpTasksController {
    constructor(private readonly followUpTasksService: FollowUpTasksService) {}

    @Get()
    findAll(
        @Param('businessId') businessId: string,
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('priority') priority?: string,
        @Query('search') search?: string,
    ) {
        return this.followUpTasksService.findAllByBusiness(businessId, {
            type,
            status,
            priority,
            search,
        });
    }

    @Post()
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 120, ttl: 60_000 } })
    create(
        @Param('businessId') businessId: string,
        @Body() body: {
            callId?: string;
            voicemailId?: string;
            type: 'URGENT_CALLBACK' | 'VOICEMAIL_REVIEW' | 'MANUAL_REVIEW' | 'APPOINTMENT_REQUEST' | 'REFILL_REQUEST' | 'INSURANCE_CHECK' | 'BILLING_REQUEST';
            status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
            priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
            title: string;
            summary: string;
            callerName?: string;
            callerPhone?: string;
            urgencyKeywords?: string[];
            metadata?: Record<string, unknown>;
            dueAt?: string;
        },
    ) {
        return this.followUpTasksService.create({
            businessId,
            ...body,
            dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        });
    }

    @Patch(':id/status')
    updateStatus(
        @Param('businessId') businessId: string,
        @Param('id') id: string,
        @Body() body: { status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' },
    ) {
        return this.followUpTasksService.updateStatus(id, businessId, body.status);
    }
}
