import * as client from 'prom-client';

export const metricsRegister = new client.Registry();

client.collectDefaultMetrics({
    register: metricsRegister,
    prefix: 'wardline_core_',
});

export const httpRequestDurationSeconds = new client.Histogram({
    name: 'wardline_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegister],
});

export const httpRequestsTotal = new client.Counter({
    name: 'wardline_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [metricsRegister],
});
