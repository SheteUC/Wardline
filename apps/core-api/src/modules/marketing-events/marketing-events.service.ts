import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
    CreateMarketingEventDto,
    UpdateMarketingEventDto,
    CreateEventRegistrationDto,
    UpdateEventRegistrationDto,
    UpdateAttendanceDto,
    TrackConversionDto,
    EventType,
    EventStatus,
    RegistrationStatus,
} from './dto/marketing-event.dto';
import { Logger } from '@wardline/utils';

@Injectable()
export class MarketingEventsService {
    private readonly logger = new Logger(MarketingEventsService.name);

    constructor(private prisma: PrismaService) { }

    // Marketing Event operations
    async createEvent(createDto: CreateMarketingEventDto) {
        this.logger.info('Creating marketing event', { title: createDto.title });

        const event = await this.prisma.marketingEvent.create({
            data: {
                ...createDto,
                scheduledAt: new Date(createDto.scheduledAt),
                registrationDeadline: createDto.registrationDeadline
                    ? new Date(createDto.registrationDeadline)
                    : null,
            },
            include: {
                _count: {
                    select: { registrations: true },
                },
            },
        });

        this.logger.info('Marketing event created', { id: event.id });
        return event;
    }

    async findAllEvents(
        hospitalId: string,
        options?: {
            eventType?: EventType;
            status?: EventStatus;
            specialty?: string;
            upcoming?: boolean;
            limit?: number;
            offset?: number;
        }
    ) {
        const { eventType, status, specialty, upcoming, limit = 50, offset = 0 } = options || {};

        const whereClause: any = {
            hospitalId,
            ...(eventType ? { eventType } : {}),
            ...(status ? { status } : {}),
            ...(specialty ? { specialty: { contains: specialty, mode: 'insensitive' } } : {}),
            ...(upcoming ? { scheduledAt: { gte: new Date() }, status: 'UPCOMING' } : {}),
        };

        const [data, total] = await Promise.all([
            this.prisma.marketingEvent.findMany({
                where: whereClause,
                include: {
                    _count: {
                        select: { registrations: true },
                    },
                },
                orderBy: { scheduledAt: 'asc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.marketingEvent.count({ where: whereClause }),
        ]);

        return { data, total, limit, offset };
    }

    async findEventById(id: string) {
        const event = await this.prisma.marketingEvent.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { registrations: true },
                },
                registrations: {
                    take: 10,
                    orderBy: { registeredAt: 'desc' },
                },
            },
        });

        if (!event) {
            throw new NotFoundException(`Marketing event with ID "${id}" not found`);
        }

        return event;
    }

    async updateEvent(id: string, updateDto: UpdateMarketingEventDto) {
        this.logger.info('Updating marketing event', { id });

        await this.findEventById(id);

        const event = await this.prisma.marketingEvent.update({
            where: { id },
            data: {
                ...updateDto,
                scheduledAt: updateDto.scheduledAt ? new Date(updateDto.scheduledAt) : undefined,
                registrationDeadline: updateDto.registrationDeadline
                    ? new Date(updateDto.registrationDeadline)
                    : undefined,
            },
            include: {
                _count: {
                    select: { registrations: true },
                },
            },
        });

        this.logger.info('Marketing event updated', { id });
        return event;
    }

    async cancelEvent(id: string) {
        this.logger.warn('Cancelling marketing event', { id });

        const event = await this.findEventById(id);

        if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
            throw new BadRequestException(`Cannot cancel event with status ${event.status}`);
        }

        const updated = await this.prisma.marketingEvent.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });

        this.logger.warn('Marketing event cancelled', { id });
        return updated;
    }

    // Event Registration operations
    async registerAttendee(createDto: CreateEventRegistrationDto) {
        this.logger.info('Registering attendee for event', {
            eventId: createDto.eventId,
            attendeeName: createDto.attendeeName,
        });

        const event = await this.findEventById(createDto.eventId);

        // Check capacity
        let registrationStatus: 'REGISTERED' | 'WAITLISTED' = 'REGISTERED';
        if (event.capacity) {
            const currentRegistrations = await this.prisma.eventRegistration.count({
                where: {
                    eventId: createDto.eventId,
                    status: 'REGISTERED',
                },
            });

            if (currentRegistrations >= event.capacity) {
                registrationStatus = 'WAITLISTED';
            }
        }

        // Check registration deadline
        if (event.registrationDeadline && new Date() > event.registrationDeadline) {
            throw new BadRequestException('Registration deadline has passed');
        }

        const registration = await this.prisma.eventRegistration.create({
            data: {
                ...createDto,
                status: registrationStatus,
            },
            include: {
                event: true,
            },
        });

        this.logger.info('Attendee registered', {
            id: registration.id,
            status: registrationStatus,
        });
        return registration;
    }

    async findEventRegistrations(
        eventId: string,
        options?: {
            status?: RegistrationStatus;
            limit?: number;
            offset?: number;
        }
    ) {
        const { status, limit = 100, offset = 0 } = options || {};

        const [data, total] = await Promise.all([
            this.prisma.eventRegistration.findMany({
                where: {
                    eventId,
                    ...(status ? { status } : {}),
                },
                include: {
                    patient: true,
                    call: {
                        select: { id: true, twilioCallSid: true },
                    },
                },
                orderBy: { registeredAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.eventRegistration.count({
                where: {
                    eventId,
                    ...(status ? { status } : {}),
                },
            }),
        ]);

        return { data, total, limit, offset };
    }

    async updateRegistration(id: string, updateDto: UpdateEventRegistrationDto) {
        this.logger.info('Updating event registration', { id });

        const registration = await this.prisma.eventRegistration.update({
            where: { id },
            data: updateDto,
            include: {
                event: true,
            },
        });

        this.logger.info('Event registration updated', { id });
        return registration;
    }

    async markAttendance(id: string, attendanceDto: UpdateAttendanceDto) {
        this.logger.info('Marking attendance', { id, attended: attendanceDto.attended });

        const registration = await this.prisma.eventRegistration.update({
            where: { id },
            data: {
                attended: attendanceDto.attended,
                status: attendanceDto.attended ? 'REGISTERED' : 'NO_SHOW',
            },
        });

        this.logger.info('Attendance marked', { id });
        return registration;
    }

    async trackConversion(id: string, conversionDto: TrackConversionDto) {
        this.logger.info('Tracking conversion', { id, becamePatient: conversionDto.becamePatient });

        const registration = await this.prisma.eventRegistration.update({
            where: { id },
            data: {
                becamePatient: conversionDto.becamePatient,
                firstAppointmentDate: conversionDto.firstAppointmentDate
                    ? new Date(conversionDto.firstAppointmentDate)
                    : null,
                patientId: conversionDto.patientId,
            },
            include: {
                patient: true,
            },
        });

        this.logger.info('Conversion tracked', { id });
        return registration;
    }

    // Analytics - Marketing ROI and effectiveness
    async getEventAnalytics(hospitalId: string, startDate?: Date, endDate?: Date) {
        const dateFilter = {
            ...(startDate && endDate
                ? { scheduledAt: { gte: startDate, lte: endDate } }
                : {}),
        };

        const [
            totalEvents,
            byEventType,
            byStatus,
            byChannel,
            totalRegistrations,
            attendanceStats,
            conversionStats,
        ] = await Promise.all([
            this.prisma.marketingEvent.count({ where: { hospitalId, ...dateFilter } }),
            this.prisma.marketingEvent.groupBy({
                by: ['eventType'],
                where: { hospitalId, ...dateFilter },
                _count: { eventType: true },
            }),
            this.prisma.marketingEvent.groupBy({
                by: ['status'],
                where: { hospitalId, ...dateFilter },
                _count: { status: true },
            }),
            this.prisma.marketingEvent.groupBy({
                by: ['marketingChannel'],
                where: { hospitalId, ...dateFilter },
                _count: { marketingChannel: true },
            }),
            this.prisma.eventRegistration.count({
                where: {
                    event: { hospitalId, ...dateFilter },
                },
            }),
            this.prisma.eventRegistration.aggregate({
                where: {
                    event: { hospitalId, ...dateFilter },
                    attended: true,
                },
                _count: true,
            }),
            this.prisma.eventRegistration.aggregate({
                where: {
                    event: { hospitalId, ...dateFilter },
                    becamePatient: true,
                },
                _count: true,
            }),
        ]);

        const attendedCount = attendanceStats._count || 0;
        const convertedCount = conversionStats._count || 0;

        return {
            totalEvents,
            byEventType: byEventType.map((e) => ({
                type: e.eventType,
                count: e._count.eventType,
            })),
            byStatus: byStatus.map((s) => ({
                status: s.status,
                count: s._count.status,
            })),
            byMarketingChannel: byChannel.map((c) => ({
                channel: c.marketingChannel || 'Unknown',
                count: c._count.marketingChannel,
            })),
            totalRegistrations,
            attendedCount,
            attendanceRate: totalRegistrations > 0
                ? (attendedCount / totalRegistrations) * 100
                : 0,
            convertedCount,
            conversionRate: attendedCount > 0
                ? (convertedCount / attendedCount) * 100
                : 0,
            overallConversionRate: totalRegistrations > 0
                ? (convertedCount / totalRegistrations) * 100
                : 0,
            roi: {
                newPatientsAcquired: convertedCount,
                description: `${convertedCount} new patients acquired through marketing events`,
            },
        };
    }

    async getEventROI(eventId: string) {
        const event = await this.findEventById(eventId);

        const [registrationStats, attendanceStats, conversionStats] = await Promise.all([
            this.prisma.eventRegistration.count({
                where: { eventId },
            }),
            this.prisma.eventRegistration.count({
                where: { eventId, attended: true },
            }),
            this.prisma.eventRegistration.count({
                where: { eventId, becamePatient: true },
            }),
        ]);

        return {
            event: {
                id: event.id,
                title: event.title,
                eventType: event.eventType,
                scheduledAt: event.scheduledAt,
                capacity: event.capacity,
                marketingChannel: event.marketingChannel,
            },
            metrics: {
                totalRegistrations: registrationStats,
                attended: attendanceStats,
                attendanceRate: registrationStats > 0
                    ? (attendanceStats / registrationStats) * 100
                    : 0,
                newPatients: conversionStats,
                conversionRate: attendanceStats > 0
                    ? (conversionStats / attendanceStats) * 100
                    : 0,
                capacityUtilization: event.capacity
                    ? (registrationStats / event.capacity) * 100
                    : null,
            },
        };
    }
}

