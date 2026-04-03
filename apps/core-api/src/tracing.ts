/**
 * Load before any instrumented modules (import from main.ts first).
 * Enables OTLP traces when OTEL_EXPORTER_OTLP_ENDPOINT is set (or OTEL_TRACES_EXPORTER=otlp).
 */
const g = globalThis as typeof globalThis & { __wardlineOtelStarted?: boolean };

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const tracesOtlp =
    Boolean(endpoint) ||
    (process.env.OTEL_TRACES_EXPORTER || '').toLowerCase() === 'otlp';

if (tracesOtlp && process.env.NODE_ENV !== 'test' && !g.__wardlineOtelStarted) {
    g.__wardlineOtelStarted = true;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NodeSDK } = require('@opentelemetry/sdk-node');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

        const sdk = new NodeSDK({
            serviceName: process.env.OTEL_SERVICE_NAME || 'wardline-core-api',
            traceExporter: new OTLPTraceExporter(),
            instrumentations: [
                getNodeAutoInstrumentations({
                    '@opentelemetry/instrumentation-fs': { enabled: false },
                }),
            ],
        });
        sdk.start();
        const shutdown = () => {
            sdk.shutdown().catch(() => undefined);
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (e) {
        console.warn('[wardline] OpenTelemetry SDK failed to start:', e);
    }
}
