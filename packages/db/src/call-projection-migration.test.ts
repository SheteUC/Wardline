import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildExpectedProjectionRecord,
    compareProjectionRecords,
    normalizeLegacyTurns,
} from './call-projection-migration';

test('normalizeLegacyTurns assigns missing sequences in order', () => {
    const normalized = normalizeLegacyTurns([
        { type: 'session_bootstrap' },
        { type: 'runtime_action_outcome', sequence: 4, actionName: 'billing-request' },
    ]);

    assert.equal(normalized[0]?.sequence, 1);
    assert.equal(normalized[1]?.sequence, 4);
});

test('buildExpectedProjectionRecord returns comparable projection fields', () => {
    const result = buildExpectedProjectionRecord({
        status: 'COMPLETED',
        tag: 'BILLING',
        turnsJson: [
            {
                type: 'runtime_action_outcome',
                sequence: 1,
                actionName: 'billing-request',
                domain: 'billing',
                handledLive: false,
                fallbackReason: 'timeout',
                operatorSummary: 'Billing request ready',
                data: { latencyMs: 1200 },
            },
        ],
        voicemails: [],
        followUpTasks: [{ id: 'task-1', status: 'OPEN', priority: 'HIGH', type: 'BILLING_REQUEST' }],
    });

    assert.equal(result.comparison.lastSequenceApplied, 1);
    assert.equal(result.comparison.latestDomain, 'billing');
    assert.equal(result.comparison.latestRuntimeAction, 'billing-request');
    assert.equal(result.comparison.fallbackReason, 'timeout');
});

test('compareProjectionRecords reports only mismatched fields', () => {
    const expected = {
        lastSequenceApplied: 2,
        latestDomain: 'handoff',
        resolution: 'FOLLOW_UP_REQUIRED',
        resolutionLabel: 'Staff follow-up required',
        operatorNextStep: 'Review the linked follow-up task.',
        latestRuntimeAction: 'manual-follow-up',
        handledLive: false,
        fallbackReason: 'no-answer',
        transportSummaryJson: null,
        intentTimelineJson: [{ intentId: 'intent-1' }],
        operatorSummaryJson: { label: 'Staff follow-up required' },
    };

    const mismatches = compareProjectionRecords(
        {
            ...expected,
            fallbackReason: 'busy',
        },
        expected,
    );

    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0]?.field, 'fallbackReason');
});
