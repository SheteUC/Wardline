import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsDateString,
    IsIn,
    IsObject,
    IsOptional,
    IsString,
} from 'class-validator';

const FOLLOW_UP_TYPES = [
    'URGENT_CALLBACK',
    'VOICEMAIL_REVIEW',
    'MANUAL_REVIEW',
    'APPOINTMENT_REQUEST',
    'REFILL_REQUEST',
    'INSURANCE_CHECK',
    'BILLING_REQUEST',
] as const;

const FOLLOW_UP_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const FOLLOW_UP_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class FollowUpTaskListQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;
}

export class CreateFollowUpTaskDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    voicemailId?: string;

    @ApiProperty({ enum: FOLLOW_UP_TYPES })
    @IsIn(FOLLOW_UP_TYPES)
    type!: (typeof FOLLOW_UP_TYPES)[number];

    @ApiPropertyOptional({ enum: FOLLOW_UP_STATUSES })
    @IsOptional()
    @IsIn(FOLLOW_UP_STATUSES)
    status?: (typeof FOLLOW_UP_STATUSES)[number];

    @ApiPropertyOptional({ enum: FOLLOW_UP_PRIORITIES })
    @IsOptional()
    @IsIn(FOLLOW_UP_PRIORITIES)
    priority?: (typeof FOLLOW_UP_PRIORITIES)[number];

    @ApiProperty()
    @IsString()
    title!: string;

    @ApiProperty()
    @IsString()
    summary!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerPhone?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    urgencyKeywords?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    dueAt?: string;
}

export class FollowUpTaskStatusUpdateDto {
    @ApiProperty({ enum: FOLLOW_UP_STATUSES })
    @IsIn(FOLLOW_UP_STATUSES)
    status!: (typeof FOLLOW_UP_STATUSES)[number];
}
