import { buildVoicePolicyV2 } from './voice-policy-v2';

describe('buildVoicePolicyV2', () => {
    it('only marks service policies as live-enabled when the integration is connected', () => {
        const result = buildVoicePolicyV2({
            settings: {
                enabledActions: ['appointment-request', 'refill-request', 'insurance-check', 'billing-request'],
                refillPolicy: { liveEnabled: true, intakeNotes: 'Refill notes', fallbackSummary: 'Refill fallback' },
                insurancePolicy: { liveEnabled: true, intakeNotes: 'Insurance notes', fallbackSummary: 'Insurance fallback' },
                billingPolicy: { liveEnabled: true, intakeNotes: 'Billing notes', fallbackSummary: 'Billing fallback' },
            },
            integrations: [
                { category: 'SCHEDULING', status: 'CONNECTED' },
                { category: 'EHR_REFILL', status: 'ERROR' },
                { category: 'INSURANCE', status: 'CONNECTED' },
                { category: 'BILLING', status: 'DISCONNECTED' },
            ],
        });

        expect(result.connectedCategories).toEqual(['SCHEDULING', 'INSURANCE']);
        expect(result.servicePolicies.scheduling.liveEnabled).toBe(true);
        expect(result.servicePolicies.refill.liveEnabled).toBe(false);
        expect(result.servicePolicies.insurance.liveEnabled).toBe(true);
        expect(result.servicePolicies.billing.liveEnabled).toBe(false);
        expect(result.dialoguePolicies.scheduling.slotPrompts.visitType).toContain('What kind of appointment');
        expect(result.dialoguePolicies.refill.slotPrompts.callerDob).toContain("date of birth");
        expect(result.dialoguePolicies.refill.slotPrompts.pharmacyPhone).toContain("phone number");
        expect(result.dialoguePolicies.billing.slotPrompts.accountReference).toContain("account or statement reference");
        expect(result.dialoguePolicies.scheduling.confirmationTemplate).toContain('Should I send that to the practice');
    });

    it('uses strict refill and billing defaults when practice settings do not override them', () => {
        const result = buildVoicePolicyV2({
            settings: {
                enabledActions: ['refill-request', 'billing-request'],
            },
            integrations: [],
        });

        expect(result.servicePolicies.refill.intakeNotes).toContain('pharmacy phone');
        expect(result.servicePolicies.billing.intakeNotes).toContain('account reference');
    });

    it('normalizes legacy minimal knowledge config into the expanded runtime knowledge shape', () => {
        const result = buildVoicePolicyV2({
            settings: {
                knowledgeConfig: {
                    faqSummary: 'Family medicine',
                    commonQuestions: ['Office hours'],
                },
            },
            integrations: [],
        });

        expect(result.knowledgeConfig.faqSummary).toBe('Family medicine');
        expect(result.knowledgeConfig.commonQuestions).toEqual(['Office hours']);
        expect(result.knowledgeConfig.servicesSummary).toBe('Family medicine');
        expect(result.knowledgeConfig.appointmentSummary).toContain('routine appointments');
        expect(result.knowledgeConfig.refillSummary).toContain('pharmacy phone number');
        expect(result.knowledgeConfig.customFaqs).toEqual([]);
    });

    it('includes expanded knowledge summaries and custom FAQs in voicePolicyV2', () => {
        const result = buildVoicePolicyV2({
            settings: {
                knowledgeConfig: {
                    faqSummary: 'Practice summary',
                    commonQuestions: ['Office hours'],
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
            },
            integrations: [],
        });

        expect(result.knowledgeConfig.servicesSummary).toBe('Services summary');
        expect(result.knowledgeConfig.appointmentSummary).toBe('Appointments summary');
        expect(result.knowledgeConfig.billingSummary).toBe('Billing summary');
        expect(result.knowledgeConfig.customFaqs).toEqual([
            {
                question: 'Do you take walk-ins?',
                answer: 'Walk-ins are limited.',
                routeTo: 'scheduling',
            },
        ]);
    });
});
