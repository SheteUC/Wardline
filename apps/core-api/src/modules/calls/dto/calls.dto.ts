import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    IsArray,
    ValidateNested,
    IsDateString,
    IsBoolean,
} from 'class-validator';
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
    BILLING = 'BILLING',
    INSURANCE = 'INSURANCE',
    FAQ = 'FAQ',
    PRESCRIPTION_REFILL = 'PRESCRIPTION_REFILL',
    HUMAN_TRANSFER = 'HUMAN_TRANSFER',
    EMERGENCY = 'EMERGENCY',
    VOICEMAIL = 'VOICEMAIL',
}

export enum Speaker {
    CALLER = 'CALLER',
    AGENT = 'AGENT',
    SYSTEM = 'SYSTEM',
}

// DTO for creating a new call session
export class CreateCallDto {
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

    @ApiPropertyOptional({ description: 'Is emergency call' })
    @IsOptional()
    @IsBoolean()
    isEmergency?: boolean;

    @ApiPropertyOptional({ enum: CallTag, description: 'Call tag' })
    @IsOptional()
    @IsEnum(CallTag)
    tag?: CallTag;

    @ApiPropertyOptional({ description: 'Call end timestamp' })
    @IsOptional()
    @IsDateString()
    endedAt?: string;

    @ApiPropertyOptional({ description: 'Recording URL' })
    @IsOptional()
    @IsString()
    recordingUrl?: string;

    @ApiPropertyOptional({ description: 'Sentiment score' })
    @IsOptional()
    @IsNumber()
    sentimentScore?: number;

    @ApiPropertyOptional({ description: 'Turn count' })
    @IsOptional()
    @IsNumber()
    turnCount?: number;

    @ApiPropertyOptional({ description: 'Structured runtime session events' })
    @IsOptional()
    @IsArray()
    turnsJson?: Array<Record<string, unknown>>;

    @ApiPropertyOptional({ description: 'Caller id' })
    @IsOptional()
    @IsString()
    callerId?: string;

    @ApiPropertyOptional({ description: 'Detected intent/domain key' })
    @IsOptional()
    @IsString()
    detectedIntent?: string;
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

    @ApiPropertyOptional({ description: 'Segment start time in milliseconds' })
    @IsOptional()
    @IsNumber()
    startTimeMs?: number;

    @ApiPropertyOptional({ description: 'Segment end time in milliseconds' })
    @IsOptional()
    @IsNumber()
    endTimeMs?: number;
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

    @ApiProperty({ description: 'Business ID' })
    @IsString()
    businessId: string;

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
