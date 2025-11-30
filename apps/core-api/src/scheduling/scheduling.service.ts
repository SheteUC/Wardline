import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Define AppointmentStatus locally to avoid import issues
export enum AppointmentStatus {
    SCHEDULED = 'SCHEDULED',
    CONFIRMED = 'CONFIRMED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    NO_SHOW = 'NO_SHOW',
    RESCHEDULED = 'RESCHEDULED',
}

export interface CreateAppointmentDto {
    hospitalId: string;
    callId?: string;
    patientName: string;
    patientPhone: string;
    patientEmail?: string;
    providerName?: string;
    serviceType?: string;
    scheduledAt: Date;
    duration: number;
    notes?: string;
}

export interface RescheduleAppointmentDto {
    scheduledAt: Date;
    notes?: string;
}

export interface CancelAppointmentDto {
    reason: string;
}

export interface AvailableSlot {
    startTime: Date;
    endTime: Date;
    providerId?: string;
    providerName?: string;
}

@Injectable()
export class SchedulingService {
    private readonly logger = new Logger(SchedulingService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Get scheduling integration for hospital
     */
    async getIntegration(hospitalId: string, provider: string): Promise<any> {
        return this.prisma.schedulingIntegration.findFirst({
            where: {
                hospitalId,
                provider,
                isActive: true,
            },
        });
    }

    /**
     * Create a new appointment
     */
    async createAppointment(dto: CreateAppointmentDto): Promise<any> {
        this.logger.log(
            `Creating appointment for ${dto.patientName} at ${dto.scheduledAt}`,
        );

        return this.prisma.appointment.create({
            data: {
                hospitalId: dto.hospitalId,
                callId: dto.callId,
                provider: 'manual', // Will be overridden by provider-specific services
                patientName: dto.patientName,
                patientPhone: dto.patientPhone,
                patientEmail: dto.patientEmail,
                providerName: dto.providerName,
                serviceType: dto.serviceType,
                scheduledAt: dto.scheduledAt,
                duration: dto.duration,
                notes: dto.notes,
                status: AppointmentStatus.SCHEDULED,
            },
        });
    }

    /**
     * Reschedule an existing appointment
     */
    async rescheduleAppointment(
        appointmentId: string,
        dto: RescheduleAppointmentDto,
    ): Promise<any> {
        this.logger.log(`Rescheduling appointment ${appointmentId}`);

        return this.prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                scheduledAt: dto.scheduledAt,
                notes: dto.notes
                    ? dto.notes
                    : `Rescheduled to ${dto.scheduledAt.toISOString()}`,
                status: AppointmentStatus.RESCHEDULED,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Cancel an appointment
     */
    async cancelAppointment(
        appointmentId: string,
        dto: CancelAppointmentDto,
    ): Promise<any> {
        this.logger.log(`Cancelling appointment ${appointmentId}`);

        return this.prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: AppointmentStatus.CANCELLED,
                cancelReason: dto.reason,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Get appointment by ID
     */
    async getAppointment(appointmentId: string): Promise<any> {
        return this.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: {
                hospital: true,
                call: true,
            },
        });
    }

    /**
     * Get appointments for a hospital
     */
    async getAppointments(
        hospitalId: string,
        filters?: {
            status?: AppointmentStatus;
            startDate?: Date;
            endDate?: Date;
        },
    ): Promise<any[]> {
        const where: any = { hospitalId };

        if (filters?.status) {
            where.status = filters.status;
        }

        if (filters?.startDate || filters?.endDate) {
            where.scheduledAt = {};
            if (filters.startDate) {
                where.scheduledAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.scheduledAt.lte = filters.endDate;
            }
        }

        return this.prisma.appointment.findMany({
            where,
            orderBy: { scheduledAt: 'asc' },
            include: {
                hospital: true,
                call: true,
            },
        });
    }

    /**
     * Mark appointment as completed
     */
    async completeAppointment(appointmentId: string): Promise<any> {
        return this.prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: AppointmentStatus.COMPLETED,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Mark appointment as no-show
     */
    async markNoShow(appointmentId: string): Promise<any> {
        return this.prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: AppointmentStatus.NO_SHOW,
                updatedAt: new Date(),
            },
        });
    }
}
