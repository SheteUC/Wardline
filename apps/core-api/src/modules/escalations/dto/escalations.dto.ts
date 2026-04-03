import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsObject,
    IsOptional,
    IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination';

const ATTEMPT_MODES = ['hybrid_transfer', 'callback_only', 'transfer_first'] as const;

export class EscalateToHumanDto {
    @ApiProperty()
    @IsString()
    callId!: string;

    @ApiProperty()
    @IsString()
    businessId!: string;

    @ApiProperty()
    @IsString()
    callerPhone!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callerName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    intentKey?: string;

    @ApiProperty()
    @IsBoolean()
    isEmergency!: boolean;

    @ApiProperty()
    @IsString()
    transcript!: string;

    @ApiProperty()
    @IsObject()
    collectedFields!: Record<string, unknown>;

    @ApiProperty({ type: [Object] })
    @IsArray()
    resolvedTurns!: unknown[];

    @ApiProperty()
    @IsString()
    escalationReason!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    transferTargetLabel?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    transferPhone?: string;

    @ApiPropertyOptional({ enum: ATTEMPT_MODES })
    @IsOptional()
    @IsIn(ATTEMPT_MODES)
    attemptMode?: (typeof ATTEMPT_MODES)[number];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reasonCategory?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    callbackPhone?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    pendingIssues?: string[];

    @ApiPropertyOptional({ type: [Object] })
    @IsOptional()
    @IsArray()
    queueSnapshot?: Array<Record<string, unknown>>;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    handoffSummary?: string;
}

export class EscalateEmergencyDto {
    @ApiProperty()
    @IsString()
    callId!: string;

    @ApiProperty()
    @IsString()
    businessId!: string;

    @ApiProperty()
    @IsString()
    callerPhone!: string;

    @ApiProperty()
    @IsString()
    transcript!: string;
}

export class EscalationsListQueryDto extends PaginationQueryDto {}
