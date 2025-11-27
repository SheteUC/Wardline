import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsArray,
    IsEmail,
    IsObject,
} from 'class-validator';

export class CreateDepartmentDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    @IsNotEmpty()
    hospitalId: string;

    @ApiProperty({ description: 'Department name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ description: 'Department description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Service types offered', example: ['X-Ray', 'MRI', 'CT Scan'] })
    @IsArray()
    @IsString({ each: true })
    serviceTypes: string[];

    @ApiProperty({ description: 'Phone number' })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @ApiPropertyOptional({ description: 'Extension' })
    @IsString()
    @IsOptional()
    extension?: string;

    @ApiPropertyOptional({ description: 'Email address' })
    @IsEmail()
    @IsOptional()
    emailAddress?: string;

    @ApiPropertyOptional({ description: 'Location (building/floor)' })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiPropertyOptional({ description: 'Hours of operation as JSON' })
    @IsObject()
    @IsOptional()
    hoursOfOperation?: Record<string, any>;
}

export class UpdateDepartmentDto {
    @ApiPropertyOptional({ description: 'Department name' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: 'Department description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Service types offered' })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    serviceTypes?: string[];

    @ApiPropertyOptional({ description: 'Phone number' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Extension' })
    @IsString()
    @IsOptional()
    extension?: string;

    @ApiPropertyOptional({ description: 'Email address' })
    @IsEmail()
    @IsOptional()
    emailAddress?: string;

    @ApiPropertyOptional({ description: 'Location (building/floor)' })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiPropertyOptional({ description: 'Hours of operation as JSON' })
    @IsObject()
    @IsOptional()
    hoursOfOperation?: Record<string, any>;

    @ApiPropertyOptional({ description: 'Is active' })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class CreateDirectoryInquiryDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    @IsNotEmpty()
    hospitalId: string;

    @ApiPropertyOptional({ description: 'Call ID' })
    @IsString()
    @IsOptional()
    callId?: string;

    @ApiPropertyOptional({ description: 'Department ID' })
    @IsString()
    @IsOptional()
    departmentId?: string;

    @ApiProperty({ description: 'Service type requested' })
    @IsString()
    @IsNotEmpty()
    serviceType: string;

    @ApiPropertyOptional({ description: 'Patient name' })
    @IsString()
    @IsOptional()
    patientName?: string;

    @ApiPropertyOptional({ description: 'Patient phone' })
    @IsString()
    @IsOptional()
    patientPhone?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateDirectoryInquiryDto {
    @ApiPropertyOptional({ description: 'Department ID' })
    @IsString()
    @IsOptional()
    departmentId?: string;

    @ApiPropertyOptional({ description: 'Is resolved' })
    @IsBoolean()
    @IsOptional()
    resolved?: boolean;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class DepartmentResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    hospitalId: string;

    @ApiProperty()
    name: string;

    @ApiPropertyOptional()
    description?: string;

    @ApiProperty()
    serviceTypes: string[];

    @ApiProperty()
    phoneNumber: string;

    @ApiPropertyOptional()
    extension?: string;

    @ApiPropertyOptional()
    emailAddress?: string;

    @ApiPropertyOptional()
    location?: string;

    @ApiPropertyOptional()
    hoursOfOperation?: Record<string, any>;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

