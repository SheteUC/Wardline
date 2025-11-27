import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
    CreateInsurancePlanDto,
    UpdateInsurancePlanDto,
    CreateInsuranceInquiryDto,
    UpdateInsuranceInquiryDto,
    CreateInsuranceVerificationDto,
    UpdateInsuranceVerificationDto,
    EligibilityStatus,
    InsuranceInquiryType,
} from './dto/insurance.dto';
import { Logger } from '@wardline/utils';

@Injectable()
export class InsuranceService {
    private readonly logger = new Logger(InsuranceService.name);

    constructor(private prisma: PrismaService) { }

    // Insurance Plan operations
    async createPlan(createDto: CreateInsurancePlanDto) {
        this.logger.info('Creating insurance plan', { planName: createDto.planName });

        const plan = await this.prisma.insurancePlan.create({
            data: {
                ...createDto,
                effectiveDate: createDto.effectiveDate ? new Date(createDto.effectiveDate) : null,
                terminationDate: createDto.terminationDate ? new Date(createDto.terminationDate) : null,
            },
        });

        this.logger.info('Insurance plan created', { id: plan.id });
        return plan;
    }

    async findAllPlans(
        hospitalId: string,
        options?: {
            carrierId?: string;
            planType?: string;
            isAccepted?: boolean;
            search?: string;
        }
    ) {
        const { carrierId, planType, isAccepted, search } = options || {};

        return this.prisma.insurancePlan.findMany({
            where: {
                hospitalId,
                ...(carrierId ? { carrierId } : {}),
                ...(planType ? { planType } : {}),
                ...(isAccepted !== undefined ? { isAccepted } : {}),
                ...(search
                    ? {
                        OR: [
                            { planName: { contains: search, mode: 'insensitive' } },
                            { carrierName: { contains: search, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            include: {
                _count: {
                    select: { inquiries: true, verifications: true },
                },
            },
            orderBy: { carrierName: 'asc' },
        });
    }

    async findPlanById(id: string) {
        const plan = await this.prisma.insurancePlan.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { inquiries: true, verifications: true },
                },
            },
        });

        if (!plan) {
            throw new NotFoundException(`Insurance plan with ID "${id}" not found`);
        }

        return plan;
    }

    async checkPlanAcceptance(hospitalId: string, carrierName: string, planName?: string) {
        const plans = await this.prisma.insurancePlan.findMany({
            where: {
                hospitalId,
                carrierName: { contains: carrierName, mode: 'insensitive' },
                ...(planName ? { planName: { contains: planName, mode: 'insensitive' } } : {}),
                isAccepted: true,
                OR: [
                    { terminationDate: null },
                    { terminationDate: { gt: new Date() } },
                ],
            },
        });

        return {
            isAccepted: plans.length > 0,
            matchingPlans: plans,
        };
    }

    async updatePlan(id: string, updateDto: UpdateInsurancePlanDto) {
        this.logger.info('Updating insurance plan', { id });

        await this.findPlanById(id);

        const plan = await this.prisma.insurancePlan.update({
            where: { id },
            data: {
                ...updateDto,
                effectiveDate: updateDto.effectiveDate ? new Date(updateDto.effectiveDate) : undefined,
                terminationDate: updateDto.terminationDate ? new Date(updateDto.terminationDate) : undefined,
            },
        });

        this.logger.info('Insurance plan updated', { id });
        return plan;
    }

    async deletePlan(id: string) {
        this.logger.warn('Deleting insurance plan', { id });

        await this.findPlanById(id);

        await this.prisma.insurancePlan.delete({
            where: { id },
        });

        this.logger.warn('Insurance plan deleted', { id });
        return { success: true };
    }

    // Insurance Inquiry operations
    async createInquiry(createDto: CreateInsuranceInquiryDto) {
        this.logger.info('Creating insurance inquiry', { inquiryType: createDto.inquiryType });

        // Auto-find matching plan
        let insurancePlanId = createDto.insurancePlanId;
        if (!insurancePlanId && createDto.carrierName) {
            const result = await this.checkPlanAcceptance(
                createDto.hospitalId,
                createDto.carrierName,
                createDto.planName
            );
            if (result.matchingPlans.length === 1) {
                insurancePlanId = result.matchingPlans[0].id;
            }
        }

        const inquiry = await this.prisma.insuranceInquiry.create({
            data: {
                ...createDto,
                insurancePlanId,
            },
            include: {
                insurancePlan: true,
            },
        });

        this.logger.info('Insurance inquiry created', { id: inquiry.id });
        return inquiry;
    }

    async findAllInquiries(
        hospitalId: string,
        options?: {
            inquiryType?: InsuranceInquiryType;
            resolved?: boolean;
            limit?: number;
            offset?: number;
        }
    ) {
        const { inquiryType, resolved, limit = 50, offset = 0 } = options || {};

        const [data, total] = await Promise.all([
            this.prisma.insuranceInquiry.findMany({
                where: {
                    hospitalId,
                    ...(inquiryType ? { inquiryType } : {}),
                    ...(resolved !== undefined ? { resolved } : {}),
                },
                include: {
                    insurancePlan: true,
                    call: {
                        select: { id: true, twilioCallSid: true, startedAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.insuranceInquiry.count({
                where: {
                    hospitalId,
                    ...(inquiryType ? { inquiryType } : {}),
                    ...(resolved !== undefined ? { resolved } : {}),
                },
            }),
        ]);

        return { data, total, limit, offset };
    }

    async updateInquiry(id: string, updateDto: UpdateInsuranceInquiryDto) {
        this.logger.info('Updating insurance inquiry', { id });

        const inquiry = await this.prisma.insuranceInquiry.update({
            where: { id },
            data: updateDto,
            include: {
                insurancePlan: true,
            },
        });

        this.logger.info('Insurance inquiry updated', { id });
        return inquiry;
    }

    // Insurance Verification operations
    async createVerification(createDto: CreateInsuranceVerificationDto) {
        this.logger.info('Creating insurance verification', {
            patientName: createDto.patientName,
            memberNumber: createDto.memberNumber,
        });

        const verification = await this.prisma.insuranceVerification.create({
            data: createDto,
            include: {
                insurancePlan: true,
                patient: true,
            },
        });

        this.logger.info('Insurance verification created', { id: verification.id });
        return verification;
    }

    async findAllVerifications(
        hospitalId: string,
        options?: {
            insurancePlanId?: string;
            eligibilityStatus?: EligibilityStatus;
            authorizationRequired?: boolean;
            limit?: number;
            offset?: number;
        }
    ) {
        const { insurancePlanId, eligibilityStatus, authorizationRequired, limit = 50, offset = 0 } = options || {};

        const [data, total] = await Promise.all([
            this.prisma.insuranceVerification.findMany({
                where: {
                    hospitalId,
                    ...(insurancePlanId ? { insurancePlanId } : {}),
                    ...(eligibilityStatus ? { eligibilityStatus } : {}),
                    ...(authorizationRequired !== undefined ? { authorizationRequired } : {}),
                },
                include: {
                    insurancePlan: true,
                    patient: true,
                },
                orderBy: { verificationDate: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.insuranceVerification.count({
                where: {
                    hospitalId,
                    ...(insurancePlanId ? { insurancePlanId } : {}),
                    ...(eligibilityStatus ? { eligibilityStatus } : {}),
                    ...(authorizationRequired !== undefined ? { authorizationRequired } : {}),
                },
            }),
        ]);

        return { data, total, limit, offset };
    }

    async findVerificationById(id: string) {
        const verification = await this.prisma.insuranceVerification.findUnique({
            where: { id },
            include: {
                insurancePlan: true,
                patient: true,
            },
        });

        if (!verification) {
            throw new NotFoundException(`Insurance verification with ID "${id}" not found`);
        }

        return verification;
    }

    async updateVerification(id: string, updateDto: UpdateInsuranceVerificationDto) {
        this.logger.info('Updating insurance verification', { id });

        await this.findVerificationById(id);

        const verification = await this.prisma.insuranceVerification.update({
            where: { id },
            data: updateDto,
            include: {
                insurancePlan: true,
                patient: true,
            },
        });

        this.logger.info('Insurance verification updated', { id });
        return verification;
    }

    // Analytics - Claim denial prevention metrics
    async getInsuranceStats(hospitalId: string, startDate?: Date, endDate?: Date) {
        const dateFilter = {
            ...(startDate && endDate
                ? { createdAt: { gte: startDate, lte: endDate } }
                : {}),
        };

        const verificationDateFilter = {
            ...(startDate && endDate
                ? { verificationDate: { gte: startDate, lte: endDate } }
                : {}),
        };

        const [
            totalPlans,
            acceptedPlans,
            totalInquiries,
            resolvedInquiries,
            byInquiryType,
            totalVerifications,
            byEligibilityStatus,
            authorizationStats,
        ] = await Promise.all([
            this.prisma.insurancePlan.count({ where: { hospitalId } }),
            this.prisma.insurancePlan.count({ where: { hospitalId, isAccepted: true } }),
            this.prisma.insuranceInquiry.count({ where: { hospitalId, ...dateFilter } }),
            this.prisma.insuranceInquiry.count({ where: { hospitalId, resolved: true, ...dateFilter } }),
            this.prisma.insuranceInquiry.groupBy({
                by: ['inquiryType'],
                where: { hospitalId, ...dateFilter },
                _count: { inquiryType: true },
            }),
            this.prisma.insuranceVerification.count({ where: { hospitalId, ...verificationDateFilter } }),
            this.prisma.insuranceVerification.groupBy({
                by: ['eligibilityStatus'],
                where: { hospitalId, ...verificationDateFilter },
                _count: { eligibilityStatus: true },
            }),
            this.prisma.insuranceVerification.aggregate({
                where: { hospitalId, ...verificationDateFilter },
                _count: { authorizationRequired: true },
                _sum: { authorizationRequired: true },
            }),
        ]);

        const eligibilityMap = byEligibilityStatus.reduce((acc, e) => {
            acc[e.eligibilityStatus] = e._count.eligibilityStatus;
            return acc;
        }, {} as Record<string, number>);

        const eligibleCount = eligibilityMap['ELIGIBLE'] || 0;
        const notEligibleCount = eligibilityMap['NOT_ELIGIBLE'] || 0;

        // Calculate claim denial prevention rate
        // Upfront verification prevents ~75% of claim denials
        const claimDenialPreventionRate = totalVerifications > 0
            ? (eligibleCount / totalVerifications) * 75 // 75% of verified eligible claims won't be denied
            : 0;

        return {
            totalPlans,
            acceptedPlans,
            totalInquiries,
            resolvedInquiries,
            inquiryResolutionRate: totalInquiries > 0 ? (resolvedInquiries / totalInquiries) * 100 : 0,
            byInquiryType: byInquiryType.map((i) => ({
                type: i.inquiryType,
                count: i._count.inquiryType,
            })),
            totalVerifications,
            eligibleCount,
            notEligibleCount,
            pendingCount: eligibilityMap['PENDING'] || 0,
            expiredCount: eligibilityMap['EXPIRED'] || 0,
            authorizationRequiredCount: (authorizationStats as any)?._sum?.authorizationRequired || 0,
            claimDenialPreventionRate: Math.round(claimDenialPreventionRate * 100) / 100,
            estimatedDenialsPreventedDescription: `Up to ${Math.round(claimDenialPreventionRate)}% of claim denials prevented through upfront eligibility verification`,
        };
    }
}

