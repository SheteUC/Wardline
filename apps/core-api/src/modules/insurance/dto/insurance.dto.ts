import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsEnum,
    IsDateString,
    IsNumber,
    IsObject,
} from 'class-validator';

export enum EligibilityStatus {
    ELIGIBLE = 'ELIGIBLE',
    NOT_ELIGIBLE = 'NOT_ELIGIBLE',
    PENDING = 'PENDING',
    EXPIRED = 'EXPIRED',
}

export enum InsuranceInquiryType {
    ACCEPTANCE = 'acceptance',
    COVERAGE = 'coverage',
    ELIGIBILITY = 'eligibility',
}

// Insurance Plan DTOs
export class CreateInsurancePlanDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    @IsNotEmpty()
    hospitalId: string;

    @ApiProperty({ description: 'Plan name' })
    @IsString()
    @IsNotEmpty()
    planName: string;

    @ApiProperty({ description: 'Carrier ID' })
    @IsString()
    @IsNotEmpty()
    carrierId: string;

    @ApiProperty({ description: 'Carrier name' })
    @IsString()
    @IsNotEmpty()
    carrierName: string;

    @ApiPropertyOptional({ description: 'Plan type (HMO, PPO, EPO, etc.)' })
    @IsString()
    @IsOptional()
    planType?: string;

    @ApiPropertyOptional({ description: 'Is plan accepted' })
    @IsBoolean()
    @IsOptional()
    isAccepted?: boolean;

    @ApiPropertyOptional({ description: 'Effective date' })
    @IsDateString()
    @IsOptional()
    effectiveDate?: string;

    @ApiPropertyOptional({ description: 'Termination date' })
    @IsDateString()
    @IsOptional()
    terminationDate?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateInsurancePlanDto {
    @ApiPropertyOptional({ description: 'Plan name' })
    @IsString()
    @IsOptional()
    planName?: string;

    @ApiPropertyOptional({ description: 'Carrier ID' })
    @IsString()
    @IsOptional()
    carrierId?: string;

    @ApiPropertyOptional({ description: 'Carrier name' })
    @IsString()
    @IsOptional()
    carrierName?: string;

    @ApiPropertyOptional({ description: 'Plan type' })
    @IsString()
    @IsOptional()
    planType?: string;

    @ApiPropertyOptional({ description: 'Is plan accepted' })
    @IsBoolean()
    @IsOptional()
    isAccepted?: boolean;

    @ApiPropertyOptional({ description: 'Effective date' })
    @IsDateString()
    @IsOptional()
    effectiveDate?: string;

    @ApiPropertyOptional({ description: 'Termination date' })
    @IsDateString()
    @IsOptional()
    terminationDate?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// Insurance Inquiry DTOs
export class CreateInsuranceInquiryDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    @IsNotEmpty()
    hospitalId: string;

    @ApiPropertyOptional({ description: 'Call ID' })
    @IsString()
    @IsOptional()
    callId?: string;

    @ApiPropertyOptional({ description: 'Insurance plan ID' })
    @IsString()
    @IsOptional()
    insurancePlanId?: string;

    @ApiPropertyOptional({ description: 'Patient name' })
    @IsString()
    @IsOptional()
    patientName?: string;

    @ApiPropertyOptional({ description: 'Patient phone' })
    @IsString()
    @IsOptional()
    patientPhone?: string;

    @ApiPropertyOptional({ description: 'Carrier name' })
    @IsString()
    @IsOptional()
    carrierName?: string;

    @ApiPropertyOptional({ description: 'Plan name' })
    @IsString()
    @IsOptional()
    planName?: string;

    @ApiProperty({ description: 'Inquiry type', enum: InsuranceInquiryType })
    @IsEnum(InsuranceInquiryType)
    inquiryType: InsuranceInquiryType;
}

export class UpdateInsuranceInquiryDto {
    @ApiPropertyOptional({ description: 'Insurance plan ID' })
    @IsString()
    @IsOptional()
    insurancePlanId?: string;

    @ApiPropertyOptional({ description: 'Is resolved' })
    @IsBoolean()
    @IsOptional()
    resolved?: boolean;

    @ApiPropertyOptional({ description: 'Outcome' })
    @IsString()
    @IsOptional()
    outcome?: string;
}

// Insurance Verification DTOs
export class CreateInsuranceVerificationDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    @IsNotEmpty()
    hospitalId: string;

    @ApiProperty({ description: 'Insurance plan ID' })
    @IsString()
    @IsNotEmpty()
    insurancePlanId: string;

    @ApiPropertyOptional({ description: 'Patient ID' })
    @IsString()
    @IsOptional()
    patientId?: string;

    @ApiProperty({ description: 'Patient name' })
    @IsString()
    @IsNotEmpty()
    patientName: string;

    @ApiProperty({ description: 'Member number' })
    @IsString()
    @IsNotEmpty()
    memberNumber: string;

    @ApiPropertyOptional({ description: 'Group number' })
    @IsString()
    @IsOptional()
    groupNumber?: string;

    @ApiProperty({ description: 'Eligibility status', enum: EligibilityStatus })
    @IsEnum(EligibilityStatus)
    eligibilityStatus: EligibilityStatus;

    @ApiPropertyOptional({ description: 'Authorization required' })
    @IsBoolean()
    @IsOptional()
    authorizationRequired?: boolean;

    @ApiPropertyOptional({ description: 'Authorization number' })
    @IsString()
    @IsOptional()
    authorizationNumber?: string;

    @ApiPropertyOptional({ description: 'Coverage details' })
    @IsObject()
    @IsOptional()
    coverageDetails?: Record<string, any>;

    @ApiPropertyOptional({ description: 'Copay amount' })
    @IsNumber()
    @IsOptional()
    copay?: number;

    @ApiPropertyOptional({ description: 'Deductible amount' })
    @IsNumber()
    @IsOptional()
    deductible?: number;

    @ApiPropertyOptional({ description: 'Deductible amount met' })
    @IsNumber()
    @IsOptional()
    deductibleMet?: number;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateInsuranceVerificationDto {
    @ApiPropertyOptional({ description: 'Eligibility status', enum: EligibilityStatus })
    @IsEnum(EligibilityStatus)
    @IsOptional()
    eligibilityStatus?: EligibilityStatus;

    @ApiPropertyOptional({ description: 'Authorization required' })
    @IsBoolean()
    @IsOptional()
    authorizationRequired?: boolean;

    @ApiPropertyOptional({ description: 'Authorization number' })
    @IsString()
    @IsOptional()
    authorizationNumber?: string;

    @ApiPropertyOptional({ description: 'Coverage details' })
    @IsObject()
    @IsOptional()
    coverageDetails?: Record<string, any>;

    @ApiPropertyOptional({ description: 'Copay amount' })
    @IsNumber()
    @IsOptional()
    copay?: number;

    @ApiPropertyOptional({ description: 'Deductible amount' })
    @IsNumber()
    @IsOptional()
    deductible?: number;

    @ApiPropertyOptional({ description: 'Deductible amount met' })
    @IsNumber()
    @IsOptional()
    deductibleMet?: number;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// Response DTOs
export class InsurancePlanResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    hospitalId: string;

    @ApiProperty()
    planName: string;

    @ApiProperty()
    carrierId: string;

    @ApiProperty()
    carrierName: string;

    @ApiPropertyOptional()
    planType?: string;

    @ApiProperty()
    isAccepted: boolean;

    @ApiPropertyOptional()
    effectiveDate?: Date;

    @ApiPropertyOptional()
    terminationDate?: Date;

    @ApiPropertyOptional()
    notes?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class InsuranceVerificationResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    hospitalId: string;

    @ApiProperty()
    insurancePlanId: string;

    @ApiPropertyOptional()
    patientId?: string;

    @ApiProperty()
    patientName: string;

    @ApiProperty()
    memberNumber: string;

    @ApiPropertyOptional()
    groupNumber?: string;

    @ApiProperty()
    verificationDate: Date;

    @ApiProperty({ enum: EligibilityStatus })
    eligibilityStatus: EligibilityStatus;

    @ApiProperty()
    authorizationRequired: boolean;

    @ApiPropertyOptional()
    authorizationNumber?: string;

    @ApiPropertyOptional()
    coverageDetails?: Record<string, any>;

    @ApiPropertyOptional()
    copay?: number;

    @ApiPropertyOptional()
    deductible?: number;

    @ApiPropertyOptional()
    deductibleMet?: number;

    @ApiPropertyOptional()
    notes?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

