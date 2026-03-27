import { humanizeFallbackReason, labelRuntimeAction } from './operator-insights';

describe('operator insights helpers', () => {
    it('humanizes common fallback reasons for staff-facing UI', () => {
        expect(humanizeFallbackReason('timeout')).toBe('the connector timed out');
        expect(humanizeFallbackReason('unsupported_capability')).toBe(
            'the configured integration does not support that request live',
        );
        expect(humanizeFallbackReason('http_502')).toBe('the integration returned 502');
    });

    it('humanizes runtime action labels', () => {
        expect(labelRuntimeAction('appointment-request')).toBe('Appointment request');
        expect(labelRuntimeAction('manual-follow-up')).toBe('Manual follow-up');
    });
});
