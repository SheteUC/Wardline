import { CallProjectionService } from './call-projection.service';

describe('CallProjectionService', () => {
    const service = new CallProjectionService();

    it('extractRuntimeActionEvents returns empty for non-array', () => {
        expect(service.extractRuntimeActionEvents(null)).toEqual([]);
        expect(service.extractRuntimeActionEvents({})).toEqual([]);
    });

    it('extractRuntimeActionEvents maps runtime_action_outcome entries', () => {
        const turns = [
            { type: 'noise', actionName: 'x' },
            {
                type: 'runtime_action_outcome',
                actionName: 'appointment-request',
                handledLive: true,
                data: { latencyMs: 12 },
                createdAt: '2026-01-02T00:00:00.000Z',
            },
        ];
        const events = service.extractRuntimeActionEvents(turns);
        expect(events).toHaveLength(1);
        expect(events[0].actionName).toBe('appointment-request');
        expect(events[0].handledLive).toBe(true);
        expect(events[0].latencyMs).toBe(12);
    });
});
