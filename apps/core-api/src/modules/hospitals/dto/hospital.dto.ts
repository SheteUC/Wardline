import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { HospitalStatus } from '@wardline/types';

export class CreateHospitalDto {
    @ApiProperty({ description: 'Hospital name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'URL-friendly slug' })
    @IsString()
    @IsNotEmpty()
    slug: string;

    @ApiProperty({ description: 'Time zone', example: 'America/New_York', required: false })
    @IsString()
    @IsOptional()
    timeZone?: string;
}

export class UpdateHospitalDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    timeZone?: string;

    @ApiProperty({ enum: HospitalStatus, required: false })
    @IsEnum(HospitalStatus)
    @IsOptional()
    status?: HospitalStatus;
}

export class HospitalResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    slug: string;

    @ApiProperty()
    timeZone: string;

    @ApiProperty({ enum: HospitalStatus })
    status: HospitalStatus;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
