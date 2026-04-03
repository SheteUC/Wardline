import {
    IntegrationConnectorsService,
    type ResolvedBusinessIntegration,
} from './integration-connectors.service';

describe('IntegrationConnectorsService', () => {
    const service = new IntegrationConnectorsService();
    const credentialsRef = 'MOCK_TEST_ATHENA_TOKEN';
    let createMockIntegrationServer: (options?: { authToken?: string; timeoutMs?: number }) => {
        start: (port?: number) => Promise<{ baseUrl: string; authToken: string }>;
        stop: () => Promise<void>;
    };
    let mockServer: { start: (port?: number) => Promise<{ baseUrl: string; authToken: string }>; stop: () => Promise<void> };
    let baseUrl: string;

    beforeAll(async () => {
        ({ createMockIntegrationServer } = (await import('../../../../../scripts/mock-integration-server.js')) as {
            createMockIntegrationServer: typeof createMockIntegrationServer;
        });
        mockServer = createMockIntegrationServer({ timeoutMs: 150 });
        const started = await mockServer.start(0);
        baseUrl = started.baseUrl;
        process.env[credentialsRef] = started.authToken;
    });

    afterAll(async () => {
        delete process.env[credentialsRef];
        await mockServer.stop();
    });

    function makeIntegration(
        category: ResolvedBusinessIntegration['category'],
        overrides: Partial<ResolvedBusinessIntegration> = {},
    ): ResolvedBusinessIntegration {
        return {
            businessId: 'business-1',
            category,
            vendor: 'athenahealth',
            status: 'DISCONNECTED',
            credentialsRef,
            settings: {
                baseUrl,
                healthPath: '/scenario/success/metadata',
                timeoutMs: 100,
                endpoints: {
                    health: '/scenario/success/metadata',
                    appointmentRequest: '/scenario/success/appointments/request',
                    refillRequest: '/scenario/success/medication-refills',
                    insuranceCheck: '/scenario/success/coverage/check',
                    billingRequest: '/scenario/success/billing/cases',
                },
            },
            capabilities: {},
            ...overrides,
        };
    }

    it('passes a health check against the mock connector', async () => {
        const result = await service.testIntegration(makeIntegration('SCHEDULING'));

        expect(result.ok).toBe(true);
        expect(result.status).toBe('CONNECTED');
        expect(result.message).toContain('validated successfully');
        expect(result.capabilities).toMatchObject({
            vendor: 'athenahealth',
            category: 'SCHEDULING',
            liveExecution: true,
        });
    });

    it('fails health checks when credentials are missing', async () => {
        const result = await service.testIntegration(
            makeIntegration('SCHEDULING', {
                credentialsRef: undefined,
            }),
        );

        expect(result.ok).toBe(false);
        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('credential secret');
        expect(result.metadata).toMatchObject({ missing: ['credentialsRef'] });
        expect(result.metadata?.latencyMs).toEqual(expect.any(Number));
    });

    it('executes appointment requests live against the mock connector', async () => {
        const result = await service.execute({
            businessId: 'business-1',
            actionName: 'appointment-request',
            integration: makeIntegration('SCHEDULING'),
            payload: {
                callerName: 'Smoke Caller',
                callerPhone: '+15550000001',
                serviceType: 'Annual Physical',
            },
        });

        expect(result.ok).toBe(true);
        expect(result.handledLive).toBe(true);
        expect(result.message).toContain('submitted successfully');
        expect(result.data).toMatchObject({
            externalReferenceId: expect.stringContaining('appt-'),
            latencyMs: expect.any(Number),
        });
    });

    it('returns timeout fallback metadata when the connector is too slow', async () => {
        const result = await service.execute({
            businessId: 'business-1',
            actionName: 'appointment-request',
            integration: makeIntegration('SCHEDULING', {
                settings: {
                    baseUrl,
                    timeoutMs: 10,
                    endpoints: {
                        health: '/scenario/success/metadata',
                        appointmentRequest: '/scenario/timeout/appointments/request',
                    },
                },
            }),
            payload: {
                callerName: 'Slow Caller',
                callerPhone: '+15550000002',
                serviceType: 'Follow-up',
            },
        });

        expect(result.ok).toBe(false);
        expect(result.handledLive).toBe(false);
        expect(result.fallbackReason).toBe('timeout');
    });

    it('returns unsupported capability when the action endpoint is not configured', async () => {
        const result = await service.execute({
            businessId: 'business-1',
            actionName: 'billing-request',
            integration: makeIntegration('SCHEDULING', {
                settings: {
                    baseUrl,
                    timeoutMs: 100,
                    endpoints: {
                        health: '/scenario/success/metadata',
                    },
                },
            }),
            payload: {
                callerName: 'Billing Caller',
                callerPhone: '+15550000003',
                billingTopic: 'Balance question',
            },
        });

        expect(result.ok).toBe(false);
        expect(result.handledLive).toBe(false);
        expect(result.fallbackReason).toBe('unsupported_capability');
    });
});
