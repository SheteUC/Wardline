function readBooleanEnv(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw.trim() === '') {
        return defaultValue;
    }

    return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase());
}

export function callsEnableProjectionFallback(): boolean {
    return readBooleanEnv('CALLS_ENABLE_PROJECTION_FALLBACK', true);
}

export function runtimeActionsDualWriteLegacyTurns(): boolean {
    return readBooleanEnv('RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS', true);
}

export function voiceRuntimeLegacyCallSyncEnabled(): boolean {
    return readBooleanEnv('VOICE_RUNTIME_LEGACY_CALL_SYNC', true);
}

export function getCallCutoverFlagSnapshot() {
    return {
        CALLS_ENABLE_PROJECTION_FALLBACK: callsEnableProjectionFallback(),
        VOICE_RUNTIME_LEGACY_CALL_SYNC: voiceRuntimeLegacyCallSyncEnabled(),
        RUNTIME_ACTIONS_DUAL_WRITE_LEGACY_TURNS: runtimeActionsDualWriteLegacyTurns(),
    };
}
