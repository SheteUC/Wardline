import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class RuntimeAppointmentRequestDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerName?: string;

    @ApiProperty()
    @IsString()
    callerPhone!: string;

    @ApiProperty()
    @IsString()
    serviceType!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    preferredDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    preferredTime?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    confirmed?: boolean;
}

export class RuntimeRefillRequestDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callId?: string;

    @ApiProperty()
    @IsString()
    callerName!: string;

    @ApiProperty()
    @IsString()
    callerPhone!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerDob?: string;

    @ApiProperty()
    @IsString()
    medicationName!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    prescriberName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    pharmacyName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    pharmacyPhone?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    confirmed?: boolean;
}

export class RuntimeInsuranceCheckDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerPhone?: string;

    @ApiProperty()
    @IsString()
    carrierName!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    planName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    inquiryType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    patientName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    patientDob?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    memberId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    groupNumber?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    subscriberRelation?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    serviceType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callbackPhone?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;
}

export class RuntimeBillingRequestDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callId?: string;

    @ApiProperty()
    @IsString()
    callerName!: string;

    @ApiProperty()
    @IsString()
    callerPhone!: string;

    @ApiProperty()
    @IsString()
    billingTopic!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    accountReference?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    confirmed?: boolean;
}

export class RuntimeManualFollowUpDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerPhone?: string;

    @ApiProperty()
    @IsString()
    title!: string;

    @ApiProperty()
    @IsString()
    summary!: string;

    @ApiPropertyOptional({ enum: PRIORITIES })
    @IsOptional()
    @IsIn(PRIORITIES)
    priority?: (typeof PRIORITIES)[number];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    urgencyKeywords?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
