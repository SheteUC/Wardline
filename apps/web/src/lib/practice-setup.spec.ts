import { buildPracticeReadiness, normalizeKnowledgeConfig, normalizePracticeSetup } from './practice-setup';
import { IntegrationCategory, IntegrationStatus } from '@wardline/types';
import type { BusinessSettings } from './api-types';

describe('practice setup helpers', () => {
    it('fills in opinionated defaults when structured policy fields are missing', () => {
        const result = normalizePracticeSetup(undefined);

        expect(result.enabledActions.includes('appointment-request')).toBe(true);
        expect(result.afterHoursPolicy.mode).toBe('urgent_voicemail');
        expect(result.knowledgeConfig.commonQuestions.length > 0).toBe(true);
        expect(result.knowledgeConfig.servicesSummary.length > 0).toBe(true);
        expect(result.knowledgeConfig.customFaqs.length).toBe(0);
        expect(result.daytimeHandoffPolicy.mode).toBe('hybrid_transfer');
    });

    it('hydrates legacy minimal knowledge config into the expanded shape', () => {
        const result = normalizePracticeSetup({
            knowledgeConfig: {
                faqSummary: 'Family medicine',
                commonQuestions: ['Office hours'],
            },
        } as BusinessSettings['settings']);

        expect(result.knowledgeConfig.faqSummary).toBe('Family medicine');
        expect(result.knowledgeConfig.commonQuestions[0]).toBe('Office hours');
        expect(result.knowledgeConfig.servicesSummary).toBe('Family medicine');
        expect(result.knowledgeConfig.appointmentSummary.length > 0).toBe(true);
        expect(result.knowledgeConfig.customFaqs.length).toBe(0);
    });

    it('omits blank custom FAQ rows when normalizing knowledge config for save', () => {
        const result = normalizeKnowledgeConfig({
            faqSummary: 'Family medicine',
            commonQuestions: ['Office hours'],
            servicesSummary: 'We help with routine visits.',
            appointmentSummary: 'Appointments summary',
            refillSummary: 'Refill summary',
            insuranceSummary: 'Insurance summary',
            billingSummary: 'Billing summary',
            customFaqs: [
                { question: 'Do you take walk-ins?', answer: 'Limited walk-ins may be available.', routeTo: 'scheduling' },
                { question: '  ', answer: 'Should be dropped' },
                { question: 'Missing answer', answer: '   ' },
            ],
        });

        expect(result.customFaqs.length).toBe(1);
        expect(result.customFaqs[0].question).toBe('Do you take walk-ins?');
        expect(result.customFaqs[0].answer).toBe('Limited walk-ins may be available.');
        expect(result.customFaqs[0].routeTo).toBe('scheduling');
    });

    it('marks required integrations as ready only when enabled categories are connected', () => {
        const readiness = buildPracticeReadiness({
            businessId: 'business-1',
            settings: {
                recordingDefault: 'ASK',
                transcriptRetentionDays: 7,
                operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
                    dayOfWeek,
                    isClosed: false,
                    startTime: '09:00',
                    endTime: '17:00',
                })),
                enabledActions: ['appointment-request', 'billing-request'],
                afterHoursPolicy: {
                    mode: 'urgent_voicemail',
                    greeting: 'After hours',
                    sendUrgentToVoicemail: true,
                },
                refillPolicy: {
                    liveEnabled: false,
                    intakeNotes: 'refills',
                    fallbackSummary: 'fallback',
                },
                billingPolicy: {
                    liveEnabled: true,
                    intakeNotes: 'billing',
                    fallbackSummary: 'fallback',
                },
                insurancePolicy: {
                    liveEnabled: false,
                    intakeNotes: 'insurance',
                    fallbackSummary: 'fallback',
                },
                daytimeHandoffPolicy: {
                    mode: 'hybrid_transfer',
                    transferTargetLabel: 'front desk',
                    transferPhone: '+15551239999',
                    ringTimeoutSeconds: 20,
                    collectReasonFirst: true,
                    fallbackSummary: 'Create a callback task.',
                },
                knowledgeConfig: {
                    faqSummary: 'Family medicine',
                    commonQuestions: ['Office hours'],
                    servicesSummary: 'Services summary',
                    appointmentSummary: 'Appointments summary',
                    refillSummary: 'Refill summary',
                    insuranceSummary: 'Insurance summary',
                    billingSummary: 'Billing summary',
                    customFaqs: [],
                },
                escalationConfig: {
                    urgentCallbackWindowMinutes: 30,
                    escalationMessage: 'Escalate urgent calls',
                    notifyStaffImmediately: true,
                },
                emergencyKeywords: [],
                outOfScopeKeywords: [],
            },
            integrations: [
                {
                    id: 'integration-1',
                    businessId: 'business-1',
                    category: IntegrationCategory.SCHEDULING,
                    vendor: 'athenahealth',
                    status: IntegrationStatus.CONNECTED,
                    createdAt: '',
                    updatedAt: '',
                },
                {
                    id: 'integration-2',
                    businessId: 'business-1',
                    category: IntegrationCategory.BILLING,
                    vendor: 'athenahealth',
                    status: IntegrationStatus.ERROR,
                    createdAt: '',
                    updatedAt: '',
                },
            ],
        });

        const integrationReadiness = readiness.find((item) => item.key === 'integrations');
        expect(integrationReadiness?.complete).toBe(false);
        expect(readiness.find((item) => item.key === 'services')?.complete).toBe(true);
        expect(readiness.find((item) => item.key === 'policy')?.complete).toBe(true);
    });

    it('normalizes invalid daytime handoff transfer settings safely', () => {
        const result = normalizePracticeSetup({
            daytimeHandoffPolicy: {
                mode: 'transfer_first',
                transferTargetLabel: 'front desk',
                transferPhone: '   ',
                ringTimeoutSeconds: 0,
                collectReasonFirst: true,
                fallbackSummary: '',
            },
        } as BusinessSettings['settings']);

        expect(result.daytimeHandoffPolicy.mode).toBe('transfer_first');
        expect(result.daytimeHandoffPolicy.transferPhone).toBe('');
        expect(result.daytimeHandoffPolicy.ringTimeoutSeconds).toBe(10);
    });
});
