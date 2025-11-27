import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsEnum,
    IsDateString,
} from 'class-validator';

export enum RefillStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    COMPLETED = 'COMPLETED',
}

export enum VerificationStatus {
    UNVERIFIED = 'UNVERIFIED',
    VERIFIED = 'VERIFIED',
    FAILED = 'FAILED',
}

export class CreatePrescriptionRefillDto {
    @ApiProperty({ description: 'Hospital ID' })
    @IsString()
    @IsNotEmpty()
    hospitalId: string;

    @ApiPropertyOptional({ description: 'Call ID' })
    @IsString()
    @IsOptional()
    callId?: string;

    @ApiPropertyOptional({ description: 'Patient ID (if existing patient)' })
    @IsString()
    @IsOptional()
    patientId?: string;

    @ApiProperty({ description: 'Patient name' })
    @IsString()
    @IsNotEmpty()
    patientName: string;

    @ApiProperty({ description: 'Patient phone' })
    @IsString()
    @IsNotEmpty()
    patientPhone: string;

    @ApiPropertyOptional({ description: 'Patient date of birth' })
    @IsDateString()
    @IsOptional()
    patientDOB?: string;

    @ApiProperty({ description: 'Medication name' })
    @IsString()
    @IsNotEmpty()
    medicationName: string;

    @ApiPropertyOptional({ description: 'Prescriber ID' })
    @IsString()
    @IsOptional()
    prescriberId?: string;

    @ApiPropertyOptional({ description: 'Prescriber name' })
    @IsString()
    @IsOptional()
    prescriberName?: string;

    @ApiPropertyOptional({ description: 'Pharmacy name' })
    @IsString()
    @IsOptional()
    pharmacyName?: string;

    @ApiPropertyOptional({ description: 'Pharmacy phone' })
    @IsString()
    @IsOptional()
    pharmacyPhone?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdatePrescriptionRefillDto {
    @ApiPropertyOptional({ description: 'Patient ID' })
    @IsString()
    @IsOptional()
    patientId?: string;

    @ApiPropertyOptional({ description: 'Prescriber ID' })
    @IsString()
    @IsOptional()
    prescriberId?: string;

    @ApiPropertyOptional({ description: 'Prescriber name' })
    @IsString()
    @IsOptional()
    prescriberName?: string;

    @ApiPropertyOptional({ description: 'Pharmacy name' })
    @IsString()
    @IsOptional()
    pharmacyName?: string;

    @ApiPropertyOptional({ description: 'Pharmacy phone' })
    @IsString()
    @IsOptional()
    pharmacyPhone?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class VerifyPatientDto {
    @ApiProperty({ description: 'Patient ID' })
    @IsString()
    @IsNotEmpty()
    patientId: string;

    @ApiProperty({ description: 'Verification status', enum: VerificationStatus })
    @IsEnum(VerificationStatus)
    verificationStatus: VerificationStatus;
}

export class AssignProviderDto {
    @ApiProperty({ description: 'Assigned provider ID' })
    @IsString()
    @IsNotEmpty()
    assignedProviderId: string;

    @ApiPropertyOptional({ description: 'Is new patient' })
    @IsBoolean()
    @IsOptional()
    isNewPatient?: boolean;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateRefillStatusDto {
    @ApiProperty({ description: 'Refill status', enum: RefillStatus })
    @IsEnum(RefillStatus)
    status: RefillStatus;

    @ApiPropertyOptional({ description: 'Rejection reason (if rejecting)' })
    @IsString()
    @IsOptional()
    rejectionReason?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class PrescriptionRefillResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    hospitalId: string;

    @ApiPropertyOptional()
    callId?: string;

    @ApiPropertyOptional()
    patientId?: string;

    @ApiProperty()
    patientName: string;

    @ApiProperty()
    patientPhone: string;

    @ApiPropertyOptional()
    patientDOB?: Date;

    @ApiProperty()
    medicationName: string;

    @ApiPropertyOptional()
    prescriberId?: string;

    @ApiPropertyOptional()
    prescriberName?: string;

    @ApiPropertyOptional()
    pharmacyName?: string;

    @ApiPropertyOptional()
    pharmacyPhone?: string;

    @ApiProperty({ enum: RefillStatus })
    status: RefillStatus;

    @ApiProperty({ enum: VerificationStatus })
    verificationStatus: VerificationStatus;

    @ApiProperty()
    isNewPatient: boolean;

    @ApiPropertyOptional()
    assignedProviderId?: string;

    @ApiPropertyOptional()
    notes?: string;

    @ApiPropertyOptional()
    rejectionReason?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

