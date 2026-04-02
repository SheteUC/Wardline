import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class WorkflowCreateDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Initial workflow graph (nodes/edges)' })
    @IsOptional()
    @IsObject()
    graphJson?: Record<string, unknown>;

    @ApiPropertyOptional({ description: 'Acting user id (optional override)' })
    @IsOptional()
    @IsString()
    userId?: string;
}

export class WorkflowVersionGraphDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    graphJson?: Record<string, unknown>;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    userId?: string;
}

export class WorkflowPublishDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    approverUserId?: string;
}
