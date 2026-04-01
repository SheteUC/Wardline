const DEFAULT_BATCH_SIZE = 100;

export function parseBatchSize(value: string | undefined, defaultValue = DEFAULT_BATCH_SIZE) {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return defaultValue;
    }
    return parsed;
}
