import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// Enums matching Prisma schema
export enum CallDirection {
    INBOUND = 'INBOUND',
    OUTBOUND = 'OUTBOUND',
}

export enum CallStatus {
    INITIATED = 'INITIATED',
    ONGOING = 'ONGOING',
    COMPLETED = 'COMPLETED',
    ABANDONED = 'ABANDONED',
    FAILED = 'FAILED',
}

export enum RecordingConsent {
    IMPLICIT = 'IMPLICIT',
    EXPLICIT = 'EXPLICIT',
    DECLINED = 'DECLINED',
}

export enum CallTag {
    SCHEDULING = 'SCHEDULING',
    BILLING_INSURANCE = 'BILLING_INSURANCE',
    RECORDS_FORMS = 'RECORDS_FORMS',
    REFILL_PRIOR_AUTH = 'REFILL_PRIOR_AUTH',
    CLINICAL_ESCALATION = 'CLINICAL_ESCALATION',
}

export enum Speaker {
    CALLER = 'CALLER',
    AGENT = 'AGENT',
    SYSTEM = 'SYSTEM',
}

// DTO for creating a new call session
export class CreateCallDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    hospitalId: string;

    @ApiProperty({ enum: CallDirection, description: 'Call direction' })
    @IsEnum(CallDirection)
    direction: CallDirection;

    @ApiProperty({ description: 'Caller phone number' })
    @IsString()
    fromNumber: string;

    @ApiProperty({ description: 'Called phone number (Twilio number)' })
    @IsString()
    toNumber: string;

    @ApiProperty({ description: 'Twilio Call SID' })
    @IsString()
    twilioCallSid: string;
}

// DTO for updating a call session
export class UpdateCallDto {
    @ApiPropertyOptional({ enum: CallStatus, description: 'Call status' })
    @IsOptional()
    @IsEnum(CallStatus)
    status?: CallStatus;

    @ApiPropertyOptional({ description: 'Call duration in seconds' })
    @IsOptional()
    @IsNumber()
    duration?: number;

    @ApiPropertyOptional({ enum: RecordingConsent, description: 'Recording consent' })
    @IsOptional()
    @IsEnum(RecordingConsent)
    recordingConsent?: RecordingConsent;

    @ApiPropertyOptional({ description: 'Detected intent key' })
    @IsOptional()
    @IsString()
    detectedIntent?: string;

    @ApiPropertyOptional({ description: 'Is emergency call' })
    @IsOptional()
    isEmergency?: boolean;

    @ApiPropertyOptional({ enum: CallTag, description: 'Call tag' })
    @IsOptional()
    @IsEnum(CallTag)
    tag?: CallTag;
}

// DTO for a single transcript segment
export class TranscriptSegmentDto {
    @ApiProperty({ enum: Speaker, description: 'Speaker type' })
    @IsEnum(Speaker)
    speaker: Speaker;

    @ApiProperty({ description: 'Transcript text' })
    @IsString()
    text: string;

    @ApiProperty({ description: 'Timestamp of the segment' })
    @IsDateString()
    timestamp: string;

    @ApiPropertyOptional({ description: 'Confidence score (0-1)' })
    @IsOptional()
    @IsNumber()
    confidence?: number;
}

// DTO for saving transcript
export class SaveTranscriptDto {
    @ApiProperty({ type: [TranscriptSegmentDto], description: 'Transcript segments' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TranscriptSegmentDto)
    segments: TranscriptSegmentDto[];
}

// DTO for creating a handoff
export class CreateHandoffDto {
    @ApiProperty({ description: 'Call ID' })
    @IsString()
    callId: string;

    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    hospitalId: string;

    @ApiProperty({ description: 'Intent key' })
    @IsString()
    intentKey: string;

    @ApiProperty({ description: 'Call tag' })
    @IsString()
    tag: string;

    @ApiProperty({ description: 'Summary of the handoff' })
    @IsString()
    summary: string;

    @ApiProperty({ description: 'Extracted fields from the call' })
    fields: Record<string, any>;
}
