import { ConflictException } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

describe('BusinessesService', () => {
    let service: BusinessesService;
    let prisma: any;
    let cache: any;
    let workflowsService: any;

    beforeEach(() => {
        prisma = {
            business: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
        };
        cache = {
            getOrSet: jest.fn(),
            invalidateByTag: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };
        workflowsService = {
            getActiveWorkflow: jest.fn(),
            syncPracticeSetupWorkflow: jest.fn().mockResolvedValue(undefined),
        };

        service = new BusinessesService(prisma, cache, workflowsService);
    });

    it('creates an owner membership when a creator user is provided', async () => {
        prisma.business.findFirst.mockResolvedValue(null);

        const createdBusiness = {
            id: 'business-1',
            name: 'Family Practice',
            slug: 'family-practice',
            settings: {},
        };
        const tx = {
            business: {
                create: jest.fn().mockResolvedValue(createdBusiness),
            },
        };
        prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

        const result = await service.create(
            {
                name: 'Family Practice',
                slug: 'family-practice',
                timeZone: 'America/New_York',
            },
            'user-1',
        );

        expect(result).toEqual(createdBusiness);
        expect(tx.business.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    users: {
                        create: {
                            userId: 'user-1',
                            role: 'OWNER',
                        },
                    },
                }),
            }),
        );
        expect(cache.invalidateByTag).toHaveBeenCalledWith('businesses');
        expect(cache.invalidateByTag).toHaveBeenCalledWith('user:user-1:businesses');
        expect(workflowsService.syncPracticeSetupWorkflow).toHaveBeenCalledWith('business-1', 'user-1');
    });

    it('throws when a business with the same name or slug already exists', async () => {
        prisma.business.findFirst.mockResolvedValue({ id: 'existing-business' });

        await expect(
            service.create({ name: 'Family Practice', slug: 'family-practice' }),
        ).rejects.toThrow(ConflictException);
    });

    it('returns an empty list immediately when the user has no memberships', async () => {
        const result = await service.findAll(true, 'user-1', []);

        expect(result).toEqual([]);
        expect(cache.getOrSet).not.toHaveBeenCalled();
        expect(prisma.business.findMany).not.toHaveBeenCalled();
    });

    it('includes the internal voicePolicyV2 adapter in runtime config', async () => {
        const business = {
            id: 'business-1',
            name: 'Family Practice',
            slug: 'family-practice',
            timeZone: 'America/New_York',
            status: 'ACTIVE',
            settings: {
                recordingDefault: 'ON',
                transcriptRetentionDays: 30,
                operatingHours: [],
                enabledActions: ['appointment-request', 'billing-request'],
                afterHoursPolicy: {
                    mode: 'urgent_voicemail',
                    greeting: 'Leave an urgent voicemail after hours.',
                    sendUrgentToVoicemail: true,
                },
                refillPolicy: {
                    liveEnabled: true,
                    intakeNotes: 'Refill notes',
                    fallbackSummary: 'Refill fallback',
                },
                billingPolicy: {
                    liveEnabled: false,
                    intakeNotes: 'Billing notes',
                    fallbackSummary: 'Billing fallback',
                },
                insurancePolicy: {
                    liveEnabled: true,
                    intakeNotes: 'Insurance notes',
                    fallbackSummary: 'Insurance fallback',
                },
                daytimeHandoffPolicy: {
                    mode: 'hybrid_transfer',
                    transferTargetLabel: 'front desk',
                    transferPhone: '+15551239999',
                    ringTimeoutSeconds: 20,
                    collectReasonFirst: true,
                    fallbackSummary: 'If nobody is available to take the call live, create a same-day callback task for staff.',
                },
                knowledgeConfig: {
                    faqSummary: 'Practice summary',
                    commonQuestions: ['Hours'],
                    servicesSummary: 'Services summary',
                    appointmentSummary: 'Appointments summary',
                    refillSummary: 'Refill summary',
                    insuranceSummary: 'Insurance summary',
                    billingSummary: 'Billing summary',
                    customFaqs: [
                        {
                            question: 'Do you take walk-ins?',
                            answer: 'Walk-ins are limited.',
                            routeTo: 'scheduling',
                        },
                    ],
                },
                escalationConfig: {
                    urgentCallbackWindowMinutes: 30,
                    escalationMessage: 'Escalate urgent calls',
                    notifyStaffImmediately: true,
                },
                outOfScopeKeywords: ['lawsuit'],
                emergencyKeywords: ['stroke'],
            },
            phoneNumbers: [],
            integrations: [
                { id: 'integration-1', category: 'SCHEDULING', vendor: 'athenahealth', status: 'CONNECTED', capabilities: {}, lastHealthCheckAt: null },
                { id: 'integration-2', category: 'BILLING', vendor: 'athenahealth', status: 'ERROR', capabilities: {}, lastHealthCheckAt: null },
            ],
        };

        prisma.business.findUnique.mockResolvedValue(business);
        workflowsService.getActiveWorkflow.mockResolvedValue({
            id: 'workflow-1',
            name: 'Practice Setup Runtime',
            version: 1,
            graphJson: {},
        });
        cache.getOrSet.mockImplementation(async (_key: string, factory: () => Promise<unknown>) => factory());

        const result = await service.getRuntimeConfig('business-1');

        expect(result.voicePolicyV2).toEqual(
            expect.objectContaining({
                version: 'v2',
                runtime: 'internal-multi-agent',
                enabledDomains: expect.arrayContaining(['safety', 'knowledge', 'handoff', 'scheduling', 'billing']),
                connectedCategories: ['SCHEDULING'],
                fallbackRuntimeAction: 'manual-follow-up',
            }),
        );
        expect(result.voicePolicyV2.servicePolicies.billing.liveEnabled).toBe(false);
        expect(result.voicePolicyV2.knowledgeConfig.servicesSummary).toBe('Services summary');
        expect(result.voicePolicyV2.daytimeHandoffPolicy.transferPhone).toBe('+15551239999');
        expect(result.voicePolicyV2.safetyPolicy.emergencyGroups).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ category: 'medical_emergency' }),
                expect.objectContaining({ category: 'mental_health_emergency' }),
            ]),
        );
        expect(result.voicePolicyV2.knowledgeConfig.customFaqs).toEqual([
            {
                question: 'Do you take walk-ins?',
                answer: 'Walk-ins are limited.',
                routeTo: 'scheduling',
            },
        ]);
        expect(result.voicePolicyV2.writeActionsRequiringConfirmation).toEqual([
            'appointment-request',
            'refill-request',
            'billing-request',
        ]);
    });
});
