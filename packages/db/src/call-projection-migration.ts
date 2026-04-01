import { CallProjectionService } from '../../../apps/core-api/src/modules/calls/call-projection.service';

export type LegacyTurn = Record<string, unknown> & {
    type?: unknown;
    sequence?: unknown;
    domain?: unknown;
    actionName?: unknown;
    createdAt?: unknown;
};

export type ProjectionComparisonRecord = {
    lastSequenceApplied: number;
    latestDomain: string | null;
    resolution: string | null;
    resolutionLabel: string | null;
    operatorNextStep: string | null;
    latestRuntimeAction: string | null;
    handledLive: boolean | null;
    fallbackReason: string | null;
    transportSummaryJson: unknown;
    intentTimelineJson: unknown;
    operatorSummaryJson: unknown;
};

export function normalizeLegacyTurns(turnsJson: unknown): LegacyTurn[] {
    if (!Array.isArray(turnsJson)) {
        return [];
    }

    let nextSequence = 1;

    return turnsJson
        .filter((entry): entry is LegacyTurn => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        .filter((entry) => typeof entry.type === 'string' && entry.type.length > 0)
        .map((entry) => {
            const sequence =
                typeof entry.sequence === 'number' && Number.isInteger(entry.sequence) && entry.sequence > 0
                    ? entry.sequence
                    : nextSequence;
            nextSequence = Math.max(nextSequence + 1, sequence + 1);

            return {
                ...entry,
                sequence,
            };
        })
        .sort((left, right) => Number(left.sequence) - Number(right.sequence));
}

export function toStableJson(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => toStableJson(entry));
    }

    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((accumulator, key) => {
                accumulator[key] = toStableJson((value as Record<string, unknown>)[key]);
                return accumulator;
            }, {});
    }

    return value ?? null;
}

export function buildExpectedProjectionRecord(
    input: {
        status?: string | null;
        tag?: string | null;
        isEmergency?: boolean;
        turnsJson?: unknown;
        voicemails?: Array<unknown>;
        followUpTasks?: Array<{
            id: string;
            status: string;
            priority: string;
            type: string;
        }>;
    },
    projectionService = new CallProjectionService(),
): {
    normalizedTurns: LegacyTurn[];
    comparison: ProjectionComparisonRecord;
} {
    const normalizedTurns = normalizeLegacyTurns(input.turnsJson);
    const snapshot = projectionService.buildProjection(
        {
            status: input.status,
            tag: input.tag,
            isEmergency: input.isEmergency,
            voicemails: input.voicemails,
            followUpTasks: input.followUpTasks,
        },
        normalizedTurns,
    );

    return {
        normalizedTurns,
        comparison: {
            lastSequenceApplied:
                normalizedTurns.length > 0
                    ? Number(normalizedTurns[normalizedTurns.length - 1]?.sequence ?? 0)
                    : 0,
            latestDomain: snapshot.latestDomain ?? null,
            resolution: snapshot.operatorSummary.resolution ?? null,
            resolutionLabel: snapshot.operatorSummary.label ?? null,
            operatorNextStep: snapshot.operatorSummary.nextStep ?? null,
            latestRuntimeAction: snapshot.latestRuntimeAction?.actionName ?? null,
            handledLive: snapshot.latestRuntimeAction?.handledLive ?? null,
            fallbackReason: snapshot.latestRuntimeAction?.fallbackReason ?? null,
            transportSummaryJson: toStableJson(snapshot.transportSummary),
            intentTimelineJson: toStableJson(snapshot.intentTimeline),
            operatorSummaryJson: toStableJson(snapshot.operatorSummary),
        },
    };
}

export function compareProjectionRecords(
    actual: Partial<ProjectionComparisonRecord> | null | undefined,
    expected: ProjectionComparisonRecord,
) {
    const mismatches: Array<{
        field: keyof ProjectionComparisonRecord;
        expected: unknown;
        actual: unknown;
    }> = [];

    const comparableActual: ProjectionComparisonRecord = {
        lastSequenceApplied: actual?.lastSequenceApplied ?? 0,
        latestDomain: actual?.latestDomain ?? null,
        resolution: actual?.resolution ?? null,
        resolutionLabel: actual?.resolutionLabel ?? null,
        operatorNextStep: actual?.operatorNextStep ?? null,
        latestRuntimeAction: actual?.latestRuntimeAction ?? null,
        handledLive: actual?.handledLive ?? null,
        fallbackReason: actual?.fallbackReason ?? null,
        transportSummaryJson: toStableJson(actual?.transportSummaryJson),
        intentTimelineJson: toStableJson(actual?.intentTimelineJson),
        operatorSummaryJson: toStableJson(actual?.operatorSummaryJson),
    };

    (Object.keys(expected) as Array<keyof ProjectionComparisonRecord>).forEach((field) => {
        const actualValue = comparableActual[field];
        const expectedValue = expected[field];

        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
            mismatches.push({
                field,
                expected: expectedValue,
                actual: actualValue,
            });
        }
    });

    return mismatches;
}
