import {
    resolveCompressionThreshold,
    resolveCorsMaxAgeSeconds,
    resolveWorkflowSimulationMaxIterations,
} from './runtime-settings';

describe('runtime settings helpers', () => {
    it('uses defaults when env values are not provided', () => {
        expect(resolveCompressionThreshold(undefined)).toBe(1024);
        expect(resolveCorsMaxAgeSeconds(undefined)).toBe(86_400);
        expect(resolveWorkflowSimulationMaxIterations(undefined)).toBe(50);
    });

    it('parses explicit integer env overrides', () => {
        expect(resolveCompressionThreshold('2048')).toBe(2048);
        expect(resolveCorsMaxAgeSeconds('600')).toBe(600);
        expect(resolveWorkflowSimulationMaxIterations('12')).toBe(12);
    });

    it('rejects invalid values', () => {
        expect(() => resolveCompressionThreshold('abc')).toThrow(
            'CORE_API_COMPRESSION_THRESHOLD_BYTES must be a non-negative integer',
        );
        expect(() => resolveCorsMaxAgeSeconds('-1')).toThrow(
            'CORE_API_CORS_MAX_AGE_SECONDS must be a non-negative integer',
        );
    });

    it('clamps workflow simulation iterations to at least one', () => {
        expect(resolveWorkflowSimulationMaxIterations('0')).toBe(1);
    });
});
