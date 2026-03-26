import { buildPracticeReadiness, normalizePracticeSetup } from './practice-setup';
import { IntegrationCategory, IntegrationStatus } from '@wardline/types';

describe('practice setup helpers', () => {
    it('fills in opinionated defaults when structured policy fields are missing', () => {
        const result = normalizePracticeSetup(undefined);

        expect(result.enabledActions.includes('appointment-request')).toBe(true);
        expect(result.afterHoursPolicy.mode).toBe('urgent_voicemail');
        expect(result.knowledgeConfig.commonQuestions.length > 0).toBe(true);
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
                knowledgeConfig: {
                    faqSummary: 'Family medicine',
                    commonQuestions: ['Office hours'],
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
    });
});
