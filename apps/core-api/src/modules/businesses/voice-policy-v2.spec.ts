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
    });
});
