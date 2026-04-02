import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class IntegrationUpsertDto {
    @ApiProperty()
    @IsString()
    vendor!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    credentialsRef?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    settings?: Record<string, unknown>;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    capabilities?: Record<string, unknown>;
}
