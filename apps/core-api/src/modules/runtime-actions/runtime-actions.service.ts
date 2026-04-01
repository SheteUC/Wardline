import { BadRequestException, Injectable } from '@nestjs/common';
import { Logger } from '@wardline/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { FollowUpTasksService } from '../follow-up-tasks/follow-up-tasks.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { CallIngestService } from '../calls/call-ingest.service';
import { runtimeActionsDualWriteLegacyTurns } from '../calls/call-cutover-flags';
import {
    IntegrationConnectorsService,
    ResolvedBusinessIntegration,
    SupportedRuntimeAction,
} from '../integrations/integration-connectors.service';

type RuntimeActionName = SupportedRuntimeAction | 'manual-follow-up';

type RuntimeActionResult = {
    ok: boolean;
    handledLive: boolean;
    fallbackCreated: boolean;
    requiresStaffFollowUp: boolean;
    message: string;
    recordId?: string;
    followUpTaskId?: string;
    integration: {
        category: string;
        vendor?: string;
        status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
        capabilities?: Record<string, unknown>;
    };
    data?: Record<string, unknown>;
};

type WriteActionName = 'appointment-request' | 'refill-request' | 'billing-request';

interface BaseRuntimePayload {
    callId?: string;
    callerName?: string;
    callerPhone?: string;
    confirmed?: boolean;
}

@Injectable()
export class RuntimeActionsService {
    private readonly logger = new Logger(RuntimeActionsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
        private readonly followUpTasksService: FollowUpTasksService,
        private readonly integrationsService: IntegrationsService,
        private readonly integrationConnectors: IntegrationConnectorsService,
        private readonly callIngestService: CallIngestService,
    ) {}

    async requestAppointment(
        businessId: string,
        body: BaseRuntimePayload & {
            callerPhone: string;
            serviceType: string;
            preferredDate?: string;
            preferredTime?: string;
            notes?: string;
        },
    ): Promise<RuntimeActionResult> {
        this.ensureConfirmed('appointment-request', body);

        const integration = await this.integrationsService.findResolvedIntegration(businessId, 'SCHEDULING');
        const execution = await this.integrationConnectors.execute({
            businessId,
            actionName: 'appointment-request',
            integration,
            payload: { ...body },
        });

        let followUpTaskId: string | undefined;
        if (!execution.handledLive) {
            followUpTaskId = await this.createFallbackTask({
                businessId,
                callId: body.callId,
                actionName: 'appointment-request',
                integration,
                fallbackReason: execution.fallbackReason ?? 'live_execution_unavailable',
                type: 'APPOINTMENT_REQUEST',
                priority: integration.status === 'CONNECTED' ? 'HIGH' : 'NORMAL',
                title: `Appointment request: ${body.serviceType}`,
                summary: body.notes
                    ? `${body.notes}\nPreferred date: ${body.preferredDate || 'not provided'}`
                    : `Caller requested ${body.serviceType}. Preferred date: ${body.preferredDate || 'not provided'}.`,
                callerName: body.callerName,
                callerPhone: body.callerPhone,
                metadata: {
                    preferredDate: body.preferredDate,
                    preferredTime: body.preferredTime,
                    liveAttemptMessage: execution.message,
                },
            });
        }

        await this.recordActionOutcome({
            businessId,
            callId: body.callId,
            actionName: 'appointment-request',
            integration,
            handledLive: execution.handledLive,
            followUpTaskId,
            data: execution.data,
            fallbackReason: execution.fallbackReason,
            callerName: body.callerName,
            callerPhone: body.callerPhone,
        });

        return {
            ok: true,
            handledLive: execution.handledLive,
            fallbackCreated: !execution.handledLive,
            requiresStaffFollowUp: !execution.handledLive,
            followUpTaskId,
            integration: this.toPublicIntegration(integration),
            message: execution.handledLive
                ? execution.message
                : 'I have captured your appointment request for staff follow-up.',
            data: execution.data,
        };
    }

    async requestRefill(
        businessId: string,
        body: BaseRuntimePayload & {
            callerName: string;
            callerPhone: string;
            callerDob?: string;
            medicationName: string;
            prescriberName?: string;
            pharmacyName?: string;
            pharmacyPhone?: string;
            notes?: string;
        },
    ): Promise<RuntimeActionResult> {
        this.ensureConfirmed('refill-request', body);

        const integration = await this.integrationsService.findResolvedIntegration(businessId, 'EHR_REFILL');
        const caller = await this.upsertCaller(businessId, body.callerPhone, body.callerName, body.callerDob);

        const refill = await this.prisma.prescriptionRefill.create({
            data: {
                businessId,
                callId: body.callId,
                callerId: caller.id,
                callerName: body.callerName,
                callerPhone: body.callerPhone,
                callerDOB: body.callerDob ? new Date(body.callerDob) : undefined,
                medicationName: body.medicationName,
                prescriberName: body.prescriberName,
                pharmacyName: body.pharmacyName,
                pharmacyPhone: body.pharmacyPhone,
                notes: body.notes,
            },
        });

        const execution = await this.integrationConnectors.execute({
            businessId,
            actionName: 'refill-request',
            integration,
            payload: {
                ...body,
                refillId: refill.id,
            },
        });

        let followUpTaskId: string | undefined;
        if (!execution.handledLive) {
            followUpTaskId = await this.createFallbackTask({
                businessId,
                callId: body.callId,
                actionName: 'refill-request',
                integration,
                fallbackReason: execution.fallbackReason ?? 'live_execution_unavailable',
                type: 'REFILL_REQUEST',
                priority: 'HIGH',
                title: `Refill request: ${body.medicationName}`,
                summary: `Refill request captured for ${body.medicationName}.`,
                callerName: body.callerName,
                callerPhone: body.callerPhone,
                metadata: {
                    refillId: refill.id,
                    callerDob: body.callerDob,
                    medicationName: body.medicationName,
                    prescriberName: body.prescriberName,
                    pharmacyName: body.pharmacyName,
                    pharmacyPhone: body.pharmacyPhone,
                    liveAttemptMessage: execution.message,
                },
            });
        }

        await this.prisma.prescriptionRefill.update({
            where: { id: refill.id },
            data: {
                notes: this.appendRuntimeNote(body.notes, {
                    handledLive: execution.handledLive,
                    followUpTaskId,
                    fallbackReason: execution.fallbackReason,
                }),
            },
        });

        await this.recordActionOutcome({
            businessId,
            callId: body.callId,
            actionName: 'refill-request',
            integration,
            handledLive: execution.handledLive,
            followUpTaskId,
            data: {
                refillId: refill.id,
                ...execution.data,
            },
            fallbackReason: execution.fallbackReason,
            callerName: body.callerName,
            callerPhone: body.callerPhone,
        });

        return {
            ok: true,
            handledLive: execution.handledLive,
            fallbackCreated: !execution.handledLive,
            requiresStaffFollowUp: !execution.handledLive,
            recordId: refill.id,
            followUpTaskId,
            integration: this.toPublicIntegration(integration),
            message: execution.handledLive
                ? execution.message
                : 'I have captured your refill request for staff follow-up.',
            data: {
                refillId: refill.id,
                ...execution.data,
            },
        };
    }

    async checkInsurance(
        businessId: string,
        body: BaseRuntimePayload & {
            carrierName: string;
            planName?: string;
            inquiryType?: string;
            patientName?: string;
            patientDob?: string;
            memberId?: string;
            groupNumber?: string;
            subscriberRelation?: string;
            serviceType?: string;
            callbackPhone?: string;
            notes?: string;
        },
    ): Promise<RuntimeActionResult> {
        const integration = await this.integrationsService.findResolvedIntegration(businessId, 'INSURANCE');
        const inquiryType = body.inquiryType ?? 'acceptance';

        const matchedPlan =
            inquiryType === 'acceptance'
                ? await this.prisma.insurancePlan.findFirst({
                      where: {
                          businessId,
                          carrierName: { contains: body.carrierName, mode: 'insensitive' },
                          ...(body.planName
                              ? { planName: { contains: body.planName, mode: 'insensitive' } }
                              : {}),
                      },
                      orderBy: { updatedAt: 'desc' },
                  })
                : null;

        const inquiry = await this.prisma.insuranceInquiry.create({
            data: {
                businessId,
                callId: body.callId,
                insurancePlanId: matchedPlan?.id,
                callerName: body.callerName,
                callerPhone: body.callbackPhone ?? body.callerPhone,
                carrierName: body.carrierName,
                planName: body.planName,
                inquiryType,
                resolved: !!matchedPlan,
                outcome: matchedPlan
                    ? matchedPlan.isAccepted
                        ? `${matchedPlan.carrierName} is accepted.`
                        : `${matchedPlan.carrierName} is not accepted.`
                    : null,
            },
        });

        if (matchedPlan) {
            await this.recordActionOutcome({
                businessId,
                callId: body.callId,
                actionName: 'insurance-check',
                integration,
                handledLive: true,
                data: {
                    inquiryId: inquiry.id,
                    isAccepted: matchedPlan.isAccepted,
                    planName: matchedPlan.planName,
                    carrierName: matchedPlan.carrierName,
                    source: 'local_plan_lookup',
                    inquiryType,
                    patientName: body.patientName,
                    patientDob: body.patientDob,
                    memberId: body.memberId,
                    groupNumber: body.groupNumber,
                    subscriberRelation: body.subscriberRelation,
                    serviceType: body.serviceType,
                    callbackPhone: body.callbackPhone,
                },
                callerName: body.callerName,
                callerPhone: body.callbackPhone ?? body.callerPhone,
            });

            return {
                ok: true,
                handledLive: true,
                fallbackCreated: false,
                requiresStaffFollowUp: false,
                recordId: inquiry.id,
                integration: this.toPublicIntegration(integration),
                message: matchedPlan.isAccepted
                    ? `${matchedPlan.carrierName} is accepted by the practice.`
                    : `${matchedPlan.carrierName} is not currently accepted by the practice.`,
                data: {
                    inquiryId: inquiry.id,
                    isAccepted: matchedPlan.isAccepted,
                    planName: matchedPlan.planName,
                    carrierName: matchedPlan.carrierName,
                    source: 'local_plan_lookup',
                    inquiryType,
                },
            };
        }

        const execution = await this.integrationConnectors.execute({
            businessId,
            actionName: 'insurance-check',
            integration,
            payload: {
                ...body,
                inquiryId: inquiry.id,
            },
        });

        let verificationId: string | undefined;
        let followUpTaskId: string | undefined;
        if (!execution.handledLive) {
            followUpTaskId = await this.createFallbackTask({
                businessId,
                callId: body.callId,
                actionName: 'insurance-check',
                integration,
                fallbackReason: execution.fallbackReason ?? 'live_execution_unavailable',
                type: 'INSURANCE_CHECK',
                priority: integration.status === 'CONNECTED' ? 'HIGH' : 'NORMAL',
                title: `Insurance check: ${body.carrierName}`,
                summary: `Insurance verification request captured for ${body.carrierName}.`,
                callerName: body.callerName,
                callerPhone: body.callbackPhone ?? body.callerPhone,
                metadata: {
                    inquiryId: inquiry.id,
                    inquiryType,
                    carrierName: body.carrierName,
                    planName: body.planName,
                    patientName: body.patientName,
                    patientDob: body.patientDob,
                    memberId: body.memberId,
                    groupNumber: body.groupNumber,
                    subscriberRelation: body.subscriberRelation,
                    serviceType: body.serviceType,
                    callbackPhone: body.callbackPhone,
                    notes: body.notes,
                    liveAttemptMessage: execution.message,
                },
            });
        } else {
            verificationId = await this.maybeCreateInsuranceVerification({
                businessId,
                body,
                matchedPlanId: matchedPlan?.id,
                executionData: execution.data ?? {},
            });
            await this.prisma.insuranceInquiry.update({
                where: { id: inquiry.id },
                data: {
                    resolved: true,
                    outcome: execution.message,
                },
            });
        }

        await this.recordActionOutcome({
            businessId,
            callId: body.callId,
            actionName: 'insurance-check',
            integration,
            handledLive: execution.handledLive,
            followUpTaskId,
            data: {
                inquiryId: inquiry.id,
                verificationId,
                inquiryType,
                patientName: body.patientName,
                patientDob: body.patientDob,
                memberId: body.memberId,
                groupNumber: body.groupNumber,
                subscriberRelation: body.subscriberRelation,
                serviceType: body.serviceType,
                callbackPhone: body.callbackPhone,
                ...execution.data,
            },
            fallbackReason: execution.fallbackReason,
            callerName: body.callerName,
            callerPhone: body.callbackPhone ?? body.callerPhone,
        });

        return {
            ok: true,
            handledLive: execution.handledLive,
            fallbackCreated: !execution.handledLive,
            requiresStaffFollowUp: !execution.handledLive,
            recordId: inquiry.id,
            followUpTaskId,
            integration: this.toPublicIntegration(integration),
            message: execution.handledLive
                ? execution.message
                : 'I have captured your insurance question and the office will follow up after checking coverage.',
            data: {
                inquiryId: inquiry.id,
                verificationId,
                inquiryType,
                patientName: body.patientName,
                patientDob: body.patientDob,
                memberId: body.memberId,
                groupNumber: body.groupNumber,
                subscriberRelation: body.subscriberRelation,
                serviceType: body.serviceType,
                callbackPhone: body.callbackPhone,
                ...execution.data,
            },
        };
    }

    async requestBilling(
        businessId: string,
        body: BaseRuntimePayload & {
            callerName: string;
            callerPhone: string;
            billingTopic: string;
            accountReference?: string;
            notes?: string;
        },
    ): Promise<RuntimeActionResult> {
        this.ensureConfirmed('billing-request', body);

        const integration = await this.integrationsService.findResolvedIntegration(businessId, 'BILLING');
        const execution = await this.integrationConnectors.execute({
            businessId,
            actionName: 'billing-request',
            integration,
            payload: { ...body },
        });

        let followUpTaskId: string | undefined;
        if (!execution.handledLive) {
            followUpTaskId = await this.createFallbackTask({
                businessId,
                callId: body.callId,
                actionName: 'billing-request',
                integration,
                fallbackReason: execution.fallbackReason ?? 'live_execution_unavailable',
                type: 'BILLING_REQUEST',
                priority: integration.status === 'CONNECTED' ? 'HIGH' : 'NORMAL',
                title: `Billing request: ${body.billingTopic}`,
                summary: body.notes
                    ? `${body.notes}\nBilling topic: ${body.billingTopic}`
                    : `Caller needs help with billing: ${body.billingTopic}.`,
                callerName: body.callerName,
                callerPhone: body.callerPhone,
                metadata: {
                    accountReference: body.accountReference,
                    billingTopic: body.billingTopic,
                    liveAttemptMessage: execution.message,
                },
            });
        }

        await this.recordActionOutcome({
            businessId,
            callId: body.callId,
            actionName: 'billing-request',
            integration,
            handledLive: execution.handledLive,
            followUpTaskId,
            data: execution.data,
            fallbackReason: execution.fallbackReason,
            callerName: body.callerName,
            callerPhone: body.callerPhone,
        });

        return {
            ok: true,
            handledLive: execution.handledLive,
            fallbackCreated: !execution.handledLive,
            requiresStaffFollowUp: !execution.handledLive,
            followUpTaskId,
            integration: this.toPublicIntegration(integration),
            message: execution.handledLive
                ? execution.message
                : 'I have captured your billing request for staff follow-up.',
            data: execution.data,
        };
    }

    async captureManualFollowUp(
        businessId: string,
        body: BaseRuntimePayload & {
            title: string;
            summary: string;
            priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
            urgencyKeywords?: string[];
            metadata?: Record<string, unknown>;
        },
    ): Promise<RuntimeActionResult> {
        const task = await this.followUpTasksService.create({
            businessId,
            callId: body.callId,
            type: body.priority === 'URGENT' ? 'URGENT_CALLBACK' : 'MANUAL_REVIEW',
            priority: body.priority ?? 'NORMAL',
            title: body.title,
            summary: body.summary,
            callerName: body.callerName,
            callerPhone: body.callerPhone,
            urgencyKeywords: body.urgencyKeywords ?? [],
            metadata: {
                source: 'runtime_action',
                originatingAction: 'manual-follow-up',
                ...body.metadata,
            },
        });

        await this.recordActionOutcome({
            businessId,
            callId: body.callId,
            actionName: 'manual-follow-up',
            integration: this.integrationConnectors.buildDisconnectedIntegration(businessId, 'BILLING'),
            handledLive: false,
            followUpTaskId: task.id,
            data: {
                title: body.title,
                summary: body.summary,
                metadata: body.metadata,
            },
            fallbackReason: 'manual_follow_up',
            callerName: body.callerName,
            callerPhone: body.callerPhone,
        });

        return {
            ok: true,
            handledLive: false,
            fallbackCreated: true,
            requiresStaffFollowUp: true,
            followUpTaskId: task.id,
            integration: {
                category: 'MANUAL',
                vendor: 'wardline',
                status: 'DISCONNECTED',
            },
            message: 'I have captured that for staff follow-up.',
            data: {
                title: body.title,
                summary: body.summary,
                metadata: body.metadata,
            },
        };
    }

    private ensureConfirmed(actionName: WriteActionName, body: BaseRuntimePayload) {
        if (body.confirmed) return;
        throw new BadRequestException(
            `The ${actionName} action requires explicit caller confirmation before it can run.`,
        );
    }

    private async createFallbackTask(input: {
        businessId: string;
        callId?: string;
        actionName: RuntimeActionName;
        integration: ResolvedBusinessIntegration;
        fallbackReason: string;
        type:
            | 'APPOINTMENT_REQUEST'
            | 'REFILL_REQUEST'
            | 'INSURANCE_CHECK'
            | 'BILLING_REQUEST';
        priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
        title: string;
        summary: string;
        callerName?: string;
        callerPhone?: string;
        metadata?: Record<string, unknown>;
    }) {
        const startedAt = Date.now();
        const task = await this.followUpTasksService.create({
            businessId: input.businessId,
            callId: input.callId,
            type: input.type,
            priority: input.priority,
            title: input.title,
            summary: input.summary,
            callerName: input.callerName,
            callerPhone: input.callerPhone,
            metadata: {
                source: 'runtime_action',
                originatingAction: input.actionName,
                fallbackReason: input.fallbackReason,
                integrationCategory: input.integration.category,
                integrationVendor: input.integration.vendor,
                liveHandled: false,
                ...input.metadata,
            },
        });

        this.logger.debug('Created runtime-action fallback task', {
            businessId: input.businessId,
            actionName: input.actionName,
            followUpTaskId: task.id,
            fallbackReason: input.fallbackReason,
            durationMs: Date.now() - startedAt,
        });
        return task.id;
    }

    private async recordActionOutcome(input: {
        businessId: string;
        callId?: string;
        actionName: RuntimeActionName;
        integration: ResolvedBusinessIntegration;
        handledLive: boolean;
        followUpTaskId?: string;
        fallbackReason?: string;
        data?: Record<string, unknown>;
        callerName?: string;
        callerPhone?: string;
    }) {
        await this.auditService.logAction({
            businessId: input.businessId,
            action: input.handledLive ? 'runtime_action.executed_live' : 'runtime_action.downgraded_to_follow_up',
            entityType: 'runtime_action',
            entityId: input.callId,
            metadata: {
                actionName: input.actionName,
                integrationCategory: input.integration.category,
                integrationVendor: input.integration.vendor,
                followUpTaskId: input.followUpTaskId,
                fallbackReason: input.fallbackReason,
                handledLive: input.handledLive,
            },
        });

        if (!input.callId) return;
        await this.callIngestService.appendInternalEvent(
            input.callId,
            {
                type: 'runtime_action_outcome',
                actionName: input.actionName,
                integrationCategory: input.integration.category,
                integrationVendor: input.integration.vendor,
                handledLive: input.handledLive,
                followUpTaskId: input.followUpTaskId,
                fallbackReason: input.fallbackReason,
                callerName: input.callerName,
                callerPhone: input.callerPhone,
                data: (input.data ?? {}) as any,
                createdAt: new Date().toISOString(),
            },
            {
                dualWriteLegacyTurns: runtimeActionsDualWriteLegacyTurns(),
            },
        );
    }

    private toPublicIntegration(integration: ResolvedBusinessIntegration) {
        return {
            category: integration.category,
            vendor: integration.vendor,
            status: integration.status,
            capabilities: integration.capabilities,
        };
    }

    private appendRuntimeNote(
        existingNotes: string | undefined,
        details: {
            handledLive: boolean;
            followUpTaskId?: string;
            fallbackReason?: string;
        },
    ) {
        const suffix = details.handledLive
            ? '[Wardline runtime] Executed live via configured integration.'
            : `[Wardline runtime] Follow-up required${details.followUpTaskId ? ` (task ${details.followUpTaskId})` : ''}${details.fallbackReason ? ` because ${details.fallbackReason}` : ''}.`;

        return [existingNotes, suffix].filter(Boolean).join('\n');
    }

    private async maybeCreateInsuranceVerification(input: {
        businessId: string;
        body: {
            callerName?: string;
            callerPhone?: string;
            carrierName: string;
            planName?: string;
            patientName?: string;
            patientDob?: string;
            memberId?: string;
            groupNumber?: string;
        };
        matchedPlanId?: string;
        executionData: Record<string, unknown>;
    }): Promise<string | undefined> {
        const eligibilityStatus =
            typeof input.executionData.eligibilityStatus === 'string'
                ? input.executionData.eligibilityStatus.toUpperCase()
                : undefined;
        const memberNumber =
            typeof input.executionData.memberNumber === 'string'
                ? input.executionData.memberNumber
                : input.body.memberId;

        if (!eligibilityStatus || !memberNumber) {
            return undefined;
        }

        let insurancePlanId = input.matchedPlanId;
        if (!insurancePlanId) {
            const createdPlan = await this.prisma.insurancePlan.create({
                data: {
                    businessId: input.businessId,
                    planName: input.body.planName || 'Eligibility check plan',
                    carrierId: input.body.carrierName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                    carrierName: input.body.carrierName,
                    isAccepted:
                        eligibilityStatus === 'ELIGIBLE' || eligibilityStatus === 'PENDING',
                },
            });
            insurancePlanId = createdPlan.id;
        }

        const caller =
            input.body.callerPhone && (input.body.patientName || input.body.patientDob)
                ? await this.upsertCaller(
                      input.businessId,
                      input.body.callerPhone,
                      input.body.patientName || input.body.callerName,
                      input.body.patientDob,
                  )
                : undefined;

        const verification = await this.prisma.insuranceVerification.create({
            data: {
                businessId: input.businessId,
                insurancePlanId,
                callerId: caller?.id,
                callerName: input.body.patientName || input.body.callerName || 'Caller',
                memberNumber,
                groupNumber:
                    typeof input.executionData.groupNumber === 'string'
                        ? input.executionData.groupNumber
                        : input.body.groupNumber,
                eligibilityStatus: eligibilityStatus as any,
                authorizationRequired: Boolean(input.executionData.authorizationRequired),
                authorizationNumber:
                    typeof input.executionData.authorizationNumber === 'string'
                        ? input.executionData.authorizationNumber
                        : undefined,
                coverageDetails:
                    input.executionData.coverageDetails &&
                    typeof input.executionData.coverageDetails === 'object' &&
                    !Array.isArray(input.executionData.coverageDetails)
                        ? (input.executionData.coverageDetails as any)
                        : undefined,
                copay:
                    typeof input.executionData.copay === 'number'
                        ? input.executionData.copay
                        : undefined,
                deductible:
                    typeof input.executionData.deductible === 'number'
                        ? input.executionData.deductible
                        : undefined,
                deductibleMet:
                    typeof input.executionData.deductibleMet === 'number'
                        ? input.executionData.deductibleMet
                        : undefined,
            },
        });

        return verification.id;
    }

    private async upsertCaller(
        businessId: string,
        phone: string,
        name?: string,
        dob?: string,
    ) {
        return this.prisma.caller.upsert({
            where: {
                businessId_phone: {
                    businessId,
                    phone,
                },
            },
            update: {
                ...(name ? { name } : {}),
                ...(dob ? { dob: new Date(dob) } : {}),
            },
            create: {
                businessId,
                phone,
                name,
                dob: dob ? new Date(dob) : undefined,
            },
        });
    }
}
