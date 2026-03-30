import { BadRequestException } from '@nestjs/common';
import { RuntimeActionsService } from './runtime-actions.service';

describe('RuntimeActionsService', () => {
    let service: RuntimeActionsService;
    let prisma: any;
    let auditService: any;
    let followUpTasksService: any;
    let integrationsService: any;
    let integrationConnectors: any;

    beforeEach(() => {
        prisma = {
            prescriptionRefill: {
                create: jest.fn(),
                update: jest.fn(),
            },
            caller: {
                upsert: jest.fn(),
            },
            insurancePlan: {
                findFirst: jest.fn(),
            },
            insuranceInquiry: {
                create: jest.fn(),
                update: jest.fn(),
            },
            callSession: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        };

        auditService = {
            logAction: jest.fn().mockResolvedValue(undefined),
        };

        followUpTasksService = {
            create: jest.fn().mockResolvedValue({ id: 'task-1' }),
        };

        integrationsService = {
            findResolvedIntegration: jest.fn(),
        };

        integrationConnectors = {
            execute: jest.fn(),
            buildDisconnectedIntegration: jest.fn().mockReturnValue({
                businessId: 'business-1',
                category: 'BILLING',
                vendor: 'athenahealth',
                status: 'DISCONNECTED',
                capabilities: {},
                settings: {},
            }),
        };

        service = new RuntimeActionsService(
            prisma,
            auditService,
            followUpTasksService,
            integrationsService,
            integrationConnectors,
        );
    });

    const connectedSchedulingIntegration = {
        businessId: 'business-1',
        category: 'SCHEDULING',
        vendor: 'athenahealth',
        status: 'CONNECTED',
        capabilities: {
            canRequestAppointment: true,
        },
        settings: {},
    };

    it('returns a live appointment result when the connector succeeds', async () => {
        integrationsService.findResolvedIntegration.mockResolvedValue(connectedSchedulingIntegration);
        integrationConnectors.execute.mockResolvedValue({
            ok: true,
            handledLive: true,
            message: 'Your appointment request was submitted successfully.',
            data: {
                externalReferenceId: 'appt-123',
            },
        });

        const result = await service.requestAppointment('business-1', {
            callerPhone: '+15550000001',
            callerName: 'Smoke Caller',
            serviceType: 'Annual Physical',
            confirmed: true,
        });

        expect(result.handledLive).toBe(true);
        expect(result.fallbackCreated).toBe(false);
        expect(result.requiresStaffFollowUp).toBe(false);
        expect(result.integration).toMatchObject({
            category: 'SCHEDULING',
            vendor: 'athenahealth',
            status: 'CONNECTED',
        });
        expect(followUpTasksService.create).not.toHaveBeenCalled();
    });

    it('creates a follow-up task when an appointment request falls back', async () => {
        integrationsService.findResolvedIntegration.mockResolvedValue(connectedSchedulingIntegration);
        integrationConnectors.execute.mockResolvedValue({
            ok: false,
            handledLive: false,
            message: 'athenahealth returned status 500 for appointment-request.',
            fallbackReason: 'http_500',
        });

        const result = await service.requestAppointment('business-1', {
            callerPhone: '+15550000002',
            callerName: 'Fallback Caller',
            serviceType: 'Follow-up',
            preferredDate: '2026-03-25',
            confirmed: true,
        });

        expect(result.handledLive).toBe(false);
        expect(result.fallbackCreated).toBe(true);
        expect(result.requiresStaffFollowUp).toBe(true);
        expect(result.followUpTaskId).toBe('task-1');
        expect(followUpTasksService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                businessId: 'business-1',
                type: 'APPOINTMENT_REQUEST',
                metadata: expect.objectContaining({
                    fallbackReason: 'http_500',
                    integrationCategory: 'SCHEDULING',
                }),
            }),
        );
    });

    it('records refill fallbacks and appends runtime notes', async () => {
        integrationsService.findResolvedIntegration.mockResolvedValue({
            businessId: 'business-1',
            category: 'EHR_REFILL',
            vendor: 'athenahealth',
            status: 'CONNECTED',
            capabilities: {
                canRequestRefill: true,
            },
            settings: {},
        });
        prisma.caller.upsert.mockResolvedValue({ id: 'caller-1' });
        prisma.prescriptionRefill.create.mockResolvedValue({ id: 'refill-1' });
        prisma.prescriptionRefill.update.mockResolvedValue({ id: 'refill-1' });
        integrationConnectors.execute.mockResolvedValue({
            ok: false,
            handledLive: false,
            message: 'No credential secret is configured for this integration.',
            fallbackReason: 'missing_credentials',
        });

        const result = await service.requestRefill('business-1', {
            callerName: 'Refill Caller',
            callerPhone: '+15550000003',
            callerDob: '1980-01-05',
            medicationName: 'Metformin',
            prescriberName: 'Dr. Patel',
            pharmacyName: 'CVS',
            pharmacyPhone: '555-123-4567',
            confirmed: true,
        });

        expect(result.recordId).toBe('refill-1');
        expect(result.fallbackCreated).toBe(true);
        expect(result.followUpTaskId).toBe('task-1');
        expect(followUpTasksService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    callerDob: '1980-01-05',
                    medicationName: 'Metformin',
                    prescriberName: 'Dr. Patel',
                    pharmacyName: 'CVS',
                    pharmacyPhone: '555-123-4567',
                }),
            }),
        );
        expect(prisma.prescriptionRefill.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    notes: expect.stringContaining('Follow-up required'),
                }),
            }),
        );
    });

    it('resolves insurance checks locally when a matching plan exists', async () => {
        integrationsService.findResolvedIntegration.mockResolvedValue({
            businessId: 'business-1',
            category: 'INSURANCE',
            vendor: 'athenahealth',
            status: 'CONNECTED',
            capabilities: {
                canCheckInsurance: true,
            },
            settings: {},
        });
        prisma.insurancePlan.findFirst.mockResolvedValue({
            id: 'plan-1',
            isAccepted: true,
            planName: 'PPO',
            carrierName: 'Blue Cross',
        });
        prisma.insuranceInquiry.create.mockResolvedValue({ id: 'inq-1' });

        const result = await service.checkInsurance('business-1', {
            callerName: 'Insurance Caller',
            callerPhone: '+15550000004',
            carrierName: 'Blue Cross',
            planName: 'PPO',
        });

        expect(result.handledLive).toBe(true);
        expect(result.fallbackCreated).toBe(false);
        expect(result.data).toMatchObject({
            inquiryId: 'inq-1',
            isAccepted: true,
            source: 'local_plan_lookup',
        });
        expect(integrationConnectors.execute).not.toHaveBeenCalled();
    });

    it('requires confirmation before billing requests can run', async () => {
        await expect(
            service.requestBilling('business-1', {
                callerName: 'Billing Caller',
                callerPhone: '+15550000005',
                billingTopic: 'Outstanding balance',
                confirmed: false,
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('passes billing account reference through execution and fallback metadata', async () => {
        integrationsService.findResolvedIntegration.mockResolvedValue({
            businessId: 'business-1',
            category: 'BILLING',
            vendor: 'athenahealth',
            status: 'CONNECTED',
            capabilities: {
                canCreateBillingCase: true,
            },
            settings: {},
        });
        integrationConnectors.execute.mockResolvedValue({
            ok: false,
            handledLive: false,
            message: 'Billing connector timed out.',
            fallbackReason: 'timeout',
        });

        const result = await service.requestBilling('business-1', {
            callerName: 'Billing Caller',
            callerPhone: '+15550000005',
            billingTopic: 'outstanding balance',
            accountReference: 'AB-1234',
            confirmed: true,
        });

        expect(result.fallbackCreated).toBe(true);
        expect(integrationConnectors.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({
                    billingTopic: 'outstanding balance',
                    accountReference: 'AB-1234',
                }),
            }),
        );
        expect(followUpTasksService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    billingTopic: 'outstanding balance',
                    accountReference: 'AB-1234',
                }),
            }),
        );
    });

    it('persists manual follow-up metadata and records it in the action outcome', async () => {
        prisma.callSession.findUnique.mockResolvedValue({ turnsJson: [] });

        const result = await service.captureManualFollowUp('business-1', {
            callId: 'call-1',
            callerName: 'Refill Caller',
            callerPhone: '+15550000003',
            title: 'Refill request needs manual completion',
            summary: 'a refill request for Metformin. Missing pharmacy phone number.',
            priority: 'HIGH',
            metadata: {
                originatingDomain: 'refill',
                missingRequiredFields: ['pharmacyPhone'],
                capturedFields: {
                    medicationName: 'Metformin',
                    callerDob: '1980-01-05',
                    pharmacyName: 'CVS',
                },
            },
        });

        expect(result.followUpTaskId).toBe('task-1');
        expect(followUpTasksService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    source: 'runtime_action',
                    originatingAction: 'manual-follow-up',
                    originatingDomain: 'refill',
                    missingRequiredFields: ['pharmacyPhone'],
                }),
            }),
        );
        expect(prisma.callSession.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    turnsJson: expect.arrayContaining([
                        expect.objectContaining({
                            actionName: 'manual-follow-up',
                            data: expect.objectContaining({
                                metadata: expect.objectContaining({
                                    originatingDomain: 'refill',
                                    missingRequiredFields: ['pharmacyPhone'],
                                }),
                            }),
                        }),
                    ]),
                }),
            }),
        );
    });
});
