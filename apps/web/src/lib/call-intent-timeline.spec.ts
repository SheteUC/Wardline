import { getIntentTimelineCardState, labelIntentStatus, labelTransferStatus } from './call-intent-timeline';

describe('call intent timeline helpers', () => {
    it('hides the card cleanly when no intent timeline exists', () => {
        const state = getIntentTimelineCardState({ intentTimeline: undefined });

        expect(state.show).toBe(false);
        expect(state.items.length).toBe(0);
    });

    it('maps timeline entries into UI labels when present', () => {
        const state = getIntentTimelineCardState({
            intentTimeline: [
                {
                    intentId: 'intent-1',
                    domain: 'billing',
                    summary: 'billing request about statement balance',
                    status: 'resolved',
                    detectedOrder: 1,
                    selectedOrder: 2,
                    actionName: 'billing-request',
                    handledLive: false,
                    fallbackReason: 'timeout',
                    transferStatus: 'callback_requested',
                    transferTargetLabel: 'front desk',
                },
            ],
        });

        expect(state.show).toBe(true);
        expect(state.items[0].domainLabel).toBe('Billing');
        expect(state.items[0].statusLabel).toBe('Resolved');
        expect(state.items[0].transferStatusLabel).toBe('Callback requested');
        expect(state.items[0].summary).toBe('billing request about statement balance');
    });

    it('humanizes unknown statuses without crashing', () => {
        expect(labelIntentStatus('needs_manual_review')).toBe('needs manual review');
    });

    it('humanizes transfer statuses without crashing', () => {
        expect(labelTransferStatus('callback_requested')).toBe('Callback requested');
        expect(labelTransferStatus('handoff_pending')).toBe('handoff pending');
    });
});
