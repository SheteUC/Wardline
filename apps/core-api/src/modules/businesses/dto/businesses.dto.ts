import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateBusinessDto {
    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    slug!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    timeZone?: string;
}

export class UpdateBusinessDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    slug?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    timeZone?: string;
}

export class BusinessListQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    includeSettings?: string;
}

export class BusinessFindOneQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    includeRelations?: string;
}

export class BusinessSettingsPatchDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    recordingDefault?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    transcriptRetentionDays?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    operatingHours?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    enabledActions?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    afterHoursPolicy?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    refillPolicy?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    billingPolicy?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    insurancePolicy?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    daytimeHandoffPolicy?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    knowledgeConfig?: unknown;

    @ApiPropertyOptional()
    @IsOptional()
    @Allow()
    escalationConfig?: unknown;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    outOfScopeKeywords?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    emergencyKeywords?: string[];
}
