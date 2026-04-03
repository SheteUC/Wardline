function parsePositiveInteger(
    value: string | undefined,
    fallback: number,
    variableName: string,
): number {
    if (!value?.trim()) {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${variableName} must be a non-negative integer`);
    }

    return parsed;
}

export function resolveCompressionThreshold(value: string | undefined): number {
    return parsePositiveInteger(value, 1024, 'CORE_API_COMPRESSION_THRESHOLD_BYTES');
}

export function resolveCorsMaxAgeSeconds(value: string | undefined): number {
    return parsePositiveInteger(value, 86_400, 'CORE_API_CORS_MAX_AGE_SECONDS');
}

export function resolveWorkflowSimulationMaxIterations(value: string | undefined): number {
    const parsed = parsePositiveInteger(value, 50, 'WORKFLOW_SIMULATION_MAX_ITERATIONS');
    return Math.max(parsed, 1);
}
