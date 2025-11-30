import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
    CreatePrescriptionRefillDto,
    UpdatePrescriptionRefillDto,
    VerifyPatientDto,
    AssignProviderDto,
    UpdateRefillStatusDto,
    RefillStatus,
    VerificationStatus,
} from './dto/prescription.dto';
import { Logger } from '@wardline/utils';

@Injectable()
export class PrescriptionsService {
    private readonly logger = new Logger(PrescriptionsService.name);

    constructor(private prisma: PrismaService) { }

    async createRefillRequest(createDto: CreatePrescriptionRefillDto) {
        this.logger.info('Creating prescription refill request', {
            medicationName: createDto.medicationName,
            patientName: createDto.patientName,
        });

        // Check if patient exists and mark as new patient if not found
        let isNewPatient = true;
        if (createDto.patientId) {
            const patient = await this.prisma.patient.findUnique({
                where: { id: createDto.patientId },
            });
            isNewPatient = !patient;
        } else if (createDto.patientPhone) {
            // Try to find patient by phone number
            const patient = await this.prisma.patient.findFirst({
                where: {
                    hospitalId: createDto.hospitalId,
                    primaryPhone: createDto.patientPhone,
                },
            });
            if (patient) {
                createDto.patientId = patient.id;
                isNewPatient = false;
            }
        }

        const refill = await this.prisma.prescriptionRefill.create({
            data: {
                ...createDto,
                patientDOB: createDto.patientDOB ? new Date(createDto.patientDOB) : null,
                isNewPatient,
            },
            include: {
                patient: true,
                call: {
                    select: { id: true, twilioCallSid: true, startedAt: true },
                },
            },
        });

        this.logger.info('Prescription refill request created', { id: refill.id, isNewPatient });
        return refill;
    }

    async findAllRefills(
        hospitalId: string,
        options?: {
            status?: RefillStatus;
            verificationStatus?: VerificationStatus;
            isNewPatient?: boolean;
            limit?: number;
            offset?: number;
        }
    ) {
        const { status, verificationStatus, isNewPatient, limit = 50, offset = 0 } = options || {};

        const [data, total] = await Promise.all([
            this.prisma.prescriptionRefill.findMany({
                where: {
                    hospitalId,
                    ...(status ? { status } : {}),
                    ...(verificationStatus ? { verificationStatus } : {}),
                    ...(isNewPatient !== undefined ? { isNewPatient } : {}),
                },
                include: {
                    patient: true,
                    call: {
                        select: { id: true, twilioCallSid: true, startedAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.prescriptionRefill.count({
                where: {
                    hospitalId,
                    ...(status ? { status } : {}),
                    ...(verificationStatus ? { verificationStatus } : {}),
                    ...(isNewPatient !== undefined ? { isNewPatient } : {}),
                },
            }),
        ]);

        return { data, total, limit, offset };
    }

    async findRefillById(id: string) {
        const refill = await this.prisma.prescriptionRefill.findUnique({
            where: { id },
            include: {
                patient: true,
                call: {
                    select: { id: true, twilioCallSid: true, startedAt: true },
                },
            },
        });

        if (!refill) {
            throw new NotFoundException(`Prescription refill with ID "${id}" not found`);
        }

        return refill;
    }

    async updateRefill(id: string, updateDto: UpdatePrescriptionRefillDto) {
        this.logger.info('Updating prescription refill', { id });

        await this.findRefillById(id);

        const refill = await this.prisma.prescriptionRefill.update({
            where: { id },
            data: updateDto,
            include: {
                patient: true,
            },
        });

        this.logger.info('Prescription refill updated', { id });
        return refill;
    }

    async verifyPatient(id: string, verifyDto: VerifyPatientDto) {
        this.logger.info('Verifying patient for refill', { id, patientId: verifyDto.patientId });

        await this.findRefillById(id);

        // If verifying, update the patient link
        const updateData: any = {
            verificationStatus: verifyDto.verificationStatus,
        };

        if (verifyDto.verificationStatus === 'VERIFIED') {
            updateData.patientId = verifyDto.patientId;
            updateData.isNewPatient = false;
        } else if (verifyDto.verificationStatus === 'FAILED') {
            updateData.isNewPatient = true;
        }

        const updated = await this.prisma.prescriptionRefill.update({
            where: { id },
            data: updateData,
            include: {
                patient: true,
            },
        });

        this.logger.info('Patient verification updated', { id, status: verifyDto.verificationStatus });
        return updated;
    }

    async assignProvider(id: string, assignDto: AssignProviderDto) {
        this.logger.info('Assigning provider for refill', { id, providerId: assignDto.assignedProviderId });

        await this.findRefillById(id);

        const refill = await this.prisma.prescriptionRefill.update({
            where: { id },
            data: {
                assignedProviderId: assignDto.assignedProviderId,
                isNewPatient: assignDto.isNewPatient ?? true,
                notes: assignDto.notes,
            },
            include: {
                patient: true,
            },
        });

        this.logger.info('Provider assigned for refill', { id });
        return refill;
    }

    async updateRefillStatus(id: string, statusDto: UpdateRefillStatusDto) {
        this.logger.info('Updating refill status', { id, status: statusDto.status });

        const refill = await this.findRefillById(id);

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
            PENDING: ['APPROVED', 'REJECTED'],
            APPROVED: ['COMPLETED', 'REJECTED'],
            REJECTED: [],
            COMPLETED: [],
        };

        if (!validTransitions[refill.status as RefillStatus]?.includes(statusDto.status)) {
            throw new BadRequestException(
                `Cannot transition from ${refill.status} to ${statusDto.status}`
            );
        }

        const updateData: any = {
            status: statusDto.status,
            notes: statusDto.notes,
        };

        if (statusDto.status === 'REJECTED' && statusDto.rejectionReason) {
            updateData.rejectionReason = statusDto.rejectionReason;
        }

        const updated = await this.prisma.prescriptionRefill.update({
            where: { id },
            data: updateData,
            include: {
                patient: true,
            },
        });

        this.logger.info('Refill status updated', { id, status: statusDto.status });
        return updated;
    }

    async getRefillStats(hospitalId: string, startDate?: Date, endDate?: Date) {
        const dateFilter = {
            ...(startDate && endDate
                ? { createdAt: { gte: startDate, lte: endDate } }
                : {}),
        };

        const [
            totalRequests,
            byStatus,
            byVerification,
            newPatientCount,
            existingPatientCount,
        ] = await Promise.all([
            this.prisma.prescriptionRefill.count({
                where: { hospitalId, ...dateFilter },
            }),
            this.prisma.prescriptionRefill.groupBy({
                by: ['status'],
                where: { hospitalId, ...dateFilter },
                _count: { status: true },
            }),
            this.prisma.prescriptionRefill.groupBy({
                by: ['verificationStatus'],
                where: { hospitalId, ...dateFilter },
                _count: { verificationStatus: true },
            }),
            this.prisma.prescriptionRefill.count({
                where: { hospitalId, isNewPatient: true, ...dateFilter },
            }),
            this.prisma.prescriptionRefill.count({
                where: { hospitalId, isNewPatient: false, ...dateFilter },
            }),
        ]);

        const statusMap = byStatus.reduce((acc, s) => {
            acc[s.status] = s._count.status;
            return acc;
        }, {} as Record<string, number>);

        const verificationMap = byVerification.reduce((acc, v) => {
            acc[v.verificationStatus] = v._count.verificationStatus;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalRequests,
            pendingCount: statusMap['PENDING'] || 0,
            approvedCount: statusMap['APPROVED'] || 0,
            rejectedCount: statusMap['REJECTED'] || 0,
            completedCount: statusMap['COMPLETED'] || 0,
            verifiedCount: verificationMap['VERIFIED'] || 0,
            unverifiedCount: verificationMap['UNVERIFIED'] || 0,
            verificationFailedCount: verificationMap['FAILED'] || 0,
            newPatientCount,
            existingPatientCount,
            newPatientConversionOpportunity: newPatientCount, // Potential new patients to onboard
            approvalRate: totalRequests > 0
                ? ((statusMap['APPROVED'] || 0) + (statusMap['COMPLETED'] || 0)) / totalRequests * 100
                : 0,
        };
    }
}

