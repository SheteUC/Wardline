import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CallAssignmentStatus } from '@wardline/types';

export class CreateQueueDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    specialization: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    priority?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    maxWaitTime?: number; // in seconds
}

export class UpdateQueueDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    specialization?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    priority?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    maxWaitTime?: number;
}

export class AssignCallDto {
    @ApiProperty()
    @IsUUID()
    callId: string;

    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    agentId?: string; // If provided, assign directly to this agent

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    priority?: number;
}

export class AcceptAssignmentDto {
    @ApiProperty()
    @IsUUID()
    agentId: string;
}

export class QueueQueryDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    specialization?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    page?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    limit?: number;
}

export class AssignmentQueryDto {
    @ApiProperty({ enum: CallAssignmentStatus, required: false })
    @IsEnum(CallAssignmentStatus)
    @IsOptional()
    status?: CallAssignmentStatus;

    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    agentId?: string;

    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    queueId?: string;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    page?: number;

    @ApiProperty({ required: false })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    limit?: number;
}
