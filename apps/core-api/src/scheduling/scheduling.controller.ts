import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { SchedulingService, CreateAppointmentDto, RescheduleAppointmentDto, CancelAppointmentDto, AppointmentStatus } from './scheduling.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('scheduling')
@UseGuards(AuthGuard)
export class SchedulingController {
    constructor(private readonly schedulingService: SchedulingService) { }

    /**
     * Get appointments for hospital
     */
    @Get('appointments')
    async getAppointments(
        @Query('hospitalId') hospitalId: string,
        @Query('status') status?: AppointmentStatus,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<any> {
        const filters: any = {};

        if (status) {
            filters.status = status;
        }

        if (startDate) {
            filters.startDate = new Date(startDate);
        }

        if (endDate) {
            filters.endDate = new Date(endDate);
        }

        return this.schedulingService.getAppointments(hospitalId, filters);
    }

    /**
     * Get appointment by ID
     */
    @Get('appointments/:id')
    async getAppointment(@Param('id') id: string): Promise<any> {
        return this.schedulingService.getAppointment(id);
    }

    /**
     * Create new appointment
     */
    @Post('appointments')
    @HttpCode(HttpStatus.CREATED)
    async createAppointment(
        @Query('hospitalId') hospitalId: string,
        @Body() dto: Omit<CreateAppointmentDto, 'hospitalId'>,
    ): Promise<any> {
        return this.schedulingService.createAppointment({
            ...dto,
            hospitalId,
            scheduledAt: new Date(dto.scheduledAt),
        });
    }

    /**
     * Reschedule appointment
     */
    @Patch('appointments/:id/reschedule')
    async rescheduleAppointment(
        @Param('id') id: string,
        @Body() dto: RescheduleAppointmentDto,
    ): Promise<any> {
        return this.schedulingService.rescheduleAppointment(id, {
            ...dto,
            scheduledAt: new Date(dto.scheduledAt),
        });
    }

    /**
     * Cancel appointment
     */
    @Delete('appointments/:id')
    async cancelAppointment(
        @Param('id') id: string,
        @Body() dto: CancelAppointmentDto,
    ): Promise<any> {
        return this.schedulingService.cancelAppointment(id, dto);
    }

    /**
     * Mark appointment as completed
     */
    @Patch('appointments/:id/complete')
    async completeAppointment(@Param('id') id: string): Promise<any> {
        return this.schedulingService.completeAppointment(id);
    }

    /**
     * Mark appointment as no-show
     */
    @Patch('appointments/:id/no-show')
    async markNoShow(@Param('id') id: string): Promise<any> {
        return this.schedulingService.markNoShow(id);
    }

    /**
     * Get scheduling integration
     */
    @Get('integrations/:provider')
    async getIntegration(
        @Query('hospitalId') hospitalId: string,
        @Param('provider') provider: string,
    ): Promise<any> {
        return this.schedulingService.getIntegration(hospitalId, provider);
    }
}
