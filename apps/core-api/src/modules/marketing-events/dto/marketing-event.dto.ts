import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsEnum,
    IsDateString,
    IsNumber,
    IsEmail,
    Min,
} from 'class-validator';

export enum EventType {
    SEMINAR = 'SEMINAR',
    LECTURE = 'LECTURE',
    CLASS = 'CLASS',
    WORKSHOP = 'WORKSHOP',
    HEALTH_FAIR = 'HEALTH_FAIR',
    SCREENING = 'SCREENING',
}

export enum EventStatus {
    UPCOMING = 'UPCOMING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum RegistrationStatus {
    REGISTERED = 'REGISTERED',
    WAITLISTED = 'WAITLISTED',
    CANCELLED = 'CANCELLED',
    NO_SHOW = 'NO_SHOW',
}

// Marketing Event DTOs
export class CreateMarketingEventDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    @IsNotEmpty()
    hospitalId: string;

    @ApiProperty({ description: 'Event title' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ description: 'Event description' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ description: 'Event type', enum: EventType })
    @IsEnum(EventType)
    eventType: EventType;

    @ApiPropertyOptional({ description: 'Medical specialty (e.g., Cardiology)' })
    @IsString()
    @IsOptional()
    specialty?: string;

    @ApiPropertyOptional({ description: 'Presenter name' })
    @IsString()
    @IsOptional()
    presenter?: string;

    @ApiPropertyOptional({ description: 'Event location' })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiPropertyOptional({ description: 'Is virtual event' })
    @IsBoolean()
    @IsOptional()
    isVirtual?: boolean;

    @ApiPropertyOptional({ description: 'Virtual meeting link' })
    @IsString()
    @IsOptional()
    virtualLink?: string;

    @ApiProperty({ description: 'Scheduled date and time' })
    @IsDateString()
    scheduledAt: string;

    @ApiProperty({ description: 'Duration in minutes' })
    @IsNumber()
    @Min(1)
    duration: number;

    @ApiPropertyOptional({ description: 'Maximum capacity' })
    @IsNumber()
    @IsOptional()
    capacity?: number;

    @ApiPropertyOptional({ description: 'Registration deadline' })
    @IsDateString()
    @IsOptional()
    registrationDeadline?: string;

    @ApiPropertyOptional({ description: 'Marketing channel (Newsletter, Social Media, etc.)' })
    @IsString()
    @IsOptional()
    marketingChannel?: string;
}

export class UpdateMarketingEventDto {
    @ApiPropertyOptional({ description: 'Event title' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ description: 'Event description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Event type', enum: EventType })
    @IsEnum(EventType)
    @IsOptional()
    eventType?: EventType;

    @ApiPropertyOptional({ description: 'Medical specialty' })
    @IsString()
    @IsOptional()
    specialty?: string;

    @ApiPropertyOptional({ description: 'Presenter name' })
    @IsString()
    @IsOptional()
    presenter?: string;

    @ApiPropertyOptional({ description: 'Event location' })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiPropertyOptional({ description: 'Is virtual event' })
    @IsBoolean()
    @IsOptional()
    isVirtual?: boolean;

    @ApiPropertyOptional({ description: 'Virtual meeting link' })
    @IsString()
    @IsOptional()
    virtualLink?: string;

    @ApiPropertyOptional({ description: 'Scheduled date and time' })
    @IsDateString()
    @IsOptional()
    scheduledAt?: string;

    @ApiPropertyOptional({ description: 'Duration in minutes' })
    @IsNumber()
    @IsOptional()
    duration?: number;

    @ApiPropertyOptional({ description: 'Maximum capacity' })
    @IsNumber()
    @IsOptional()
    capacity?: number;

    @ApiPropertyOptional({ description: 'Registration deadline' })
    @IsDateString()
    @IsOptional()
    registrationDeadline?: string;

    @ApiPropertyOptional({ description: 'Event status', enum: EventStatus })
    @IsEnum(EventStatus)
    @IsOptional()
    status?: EventStatus;

    @ApiPropertyOptional({ description: 'Marketing channel' })
    @IsString()
    @IsOptional()
    marketingChannel?: string;
}

// Event Registration DTOs
export class CreateEventRegistrationDto {
    @ApiProperty({ description: 'Event ID' })
    @IsString()
    @IsNotEmpty()
    eventId: string;

    @ApiPropertyOptional({ description: 'Call ID' })
    @IsString()
    @IsOptional()
    callId?: string;

    @ApiPropertyOptional({ description: 'Patient ID' })
    @IsString()
    @IsOptional()
    patientId?: string;

    @ApiProperty({ description: 'Attendee name' })
    @IsString()
    @IsNotEmpty()
    attendeeName: string;

    @ApiProperty({ description: 'Attendee phone' })
    @IsString()
    @IsNotEmpty()
    attendeePhone: string;

    @ApiPropertyOptional({ description: 'Attendee email' })
    @IsEmail()
    @IsOptional()
    attendeeEmail?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateEventRegistrationDto {
    @ApiPropertyOptional({ description: 'Registration status', enum: RegistrationStatus })
    @IsEnum(RegistrationStatus)
    @IsOptional()
    status?: RegistrationStatus;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateAttendanceDto {
    @ApiProperty({ description: 'Did the registrant attend' })
    @IsBoolean()
    attended: boolean;
}

export class TrackConversionDto {
    @ApiProperty({ description: 'Did the attendee become a patient' })
    @IsBoolean()
    becamePatient: boolean;

    @ApiPropertyOptional({ description: 'First appointment date if became patient' })
    @IsDateString()
    @IsOptional()
    firstAppointmentDate?: string;

    @ApiPropertyOptional({ description: 'Patient ID' })
    @IsString()
    @IsOptional()
    patientId?: string;
}

// Response DTOs
export class MarketingEventResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    hospitalId: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty({ enum: EventType })
    eventType: EventType;

    @ApiPropertyOptional()
    specialty?: string;

    @ApiPropertyOptional()
    presenter?: string;

    @ApiPropertyOptional()
    location?: string;

    @ApiProperty()
    isVirtual: boolean;

    @ApiPropertyOptional()
    virtualLink?: string;

    @ApiProperty()
    scheduledAt: Date;

    @ApiProperty()
    duration: number;

    @ApiPropertyOptional()
    capacity?: number;

    @ApiPropertyOptional()
    registrationDeadline?: Date;

    @ApiProperty({ enum: EventStatus })
    status: EventStatus;

    @ApiPropertyOptional()
    marketingChannel?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class EventRegistrationResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    eventId: string;

    @ApiPropertyOptional()
    callId?: string;

    @ApiPropertyOptional()
    patientId?: string;

    @ApiProperty()
    attendeeName: string;

    @ApiProperty()
    attendeePhone: string;

    @ApiPropertyOptional()
    attendeeEmail?: string;

    @ApiProperty({ enum: RegistrationStatus })
    status: RegistrationStatus;

    @ApiPropertyOptional()
    attended?: boolean;

    @ApiProperty()
    becamePatient: boolean;

    @ApiPropertyOptional()
    firstAppointmentDate?: Date;

    @ApiPropertyOptional()
    notes?: string;

    @ApiProperty()
    registeredAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

