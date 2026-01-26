import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AgentType, AgentStatus, AIAgentConfig, HumanAgentProfile } from '@wardline/types';

export class CreateAgentDto {
    @ApiProperty({ enum: AgentType })
    @IsEnum(AgentType)
    type: AgentType;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsObject()
    @IsOptional()
    aiConfig?: AIAgentConfig;

    @ApiProperty({ required: false })
    @IsObject()
    @IsOptional()
    humanProfile?: HumanAgentProfile;
}

export class UpdateAgentDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ enum: AgentStatus, required: false })
    @IsEnum(AgentStatus)
    @IsOptional()
    status?: AgentStatus;

    @ApiProperty({ required: false })
    @IsObject()
    @IsOptional()
    aiConfig?: AIAgentConfig;

    @ApiProperty({ required: false })
    @IsObject()
    @IsOptional()
    humanProfile?: HumanAgentProfile;
}

export class UpdateAgentStatusDto {
    @ApiProperty({ enum: AgentStatus })
    @IsEnum(AgentStatus)
    status: AgentStatus;
}

export class UpdateAgentAvailabilityDto {
    @ApiProperty()
    @IsObject()
    availability: HumanAgentProfile['availability'];
}

export class AgentQueryDto {
    @ApiProperty({ enum: AgentType, required: false })
    @IsEnum(AgentType)
    @IsOptional()
    type?: AgentType;

    @ApiProperty({ enum: AgentStatus, required: false })
    @IsEnum(AgentStatus)
    @IsOptional()
    status?: AgentStatus;

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
