import { Injectable } from '@nestjs/common';

export type SupportedIntegrationCategory =
    | 'SCHEDULING'
    | 'EHR_REFILL'
    | 'BILLING'
    | 'INSURANCE'
    | 'KNOWLEDGE';

export type SupportedRuntimeAction =
    | 'appointment-request'
    | 'refill-request'
    | 'insurance-check'
    | 'billing-request';

export type SupportedIntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface ResolvedBusinessIntegration {
    id?: string;
    businessId: string;
    category: SupportedIntegrationCategory;
    vendor: string;
    status: SupportedIntegrationStatus;
    credentialsRef?: string | null;
    settings: Record<string, unknown>;
    capabilities: Record<string, unknown>;
    lastHealthCheckAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface IntegrationHealthCheckResult {
    ok: boolean;
    status: SupportedIntegrationStatus;
    message: string;
    settings: Record<string, unknown>;
    capabilities: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface IntegrationExecutionRequest {
    businessId: string;
    actionName: SupportedRuntimeAction;
    integration: ResolvedBusinessIntegration;
    payload: Record<string, unknown>;
}

export interface IntegrationExecutionResult {
    ok: boolean;
    handledLive: boolean;
    message: string;
    data?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    fallbackReason?: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface AthenaEndpointMap {
    health: string;
    appointmentRequest?: string;
    refillRequest?: string;
    insuranceCheck?: string;
    billingRequest?: string;
}

interface AthenaSettings {
    baseUrl?: string;
    healthPath: string;
    timeoutMs: number;
    practiceId?: string;
    departmentId?: string;
    methods: Partial<Record<SupportedRuntimeAction, HttpMethod>>;
    endpoints: AthenaEndpointMap;
}

const ALL_CATEGORIES: SupportedIntegrationCategory[] = [
    'SCHEDULING',
    'EHR_REFILL',
    'BILLING',
    'INSURANCE',
    'KNOWLEDGE',
];

const DEFAULT_TIMEOUT_MS = 3500;

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function joinUrl(baseUrl: string | undefined, path: string | undefined): string | undefined {
    if (!path) return undefined;
    if (/^https?:\/\//i.test(path)) return path;
    if (!baseUrl) return undefined;
    return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function summarizePayload(payload: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
    );
}

@Injectable()
export class IntegrationConnectorsService {
    getAllCategories(): SupportedIntegrationCategory[] {
        return [...ALL_CATEGORIES];
    }

    getDefaultVendor(category: SupportedIntegrationCategory): string {
        return category === 'KNOWLEDGE' ? 'wardline' : 'athenahealth';
    }

    buildDisconnectedIntegration(
        businessId: string,
        category: SupportedIntegrationCategory,
    ): ResolvedBusinessIntegration {
        const vendor = this.getDefaultVendor(category);
        const settings = this.normalizeSettings(category, vendor, {});
        return {
            id: `${businessId}:${category}`,
            businessId,
            category,
            vendor,
            status: 'DISCONNECTED',
            settings,
            capabilities: this.buildCapabilities(category, vendor, settings, false),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    normalizeSettings(
        category: SupportedIntegrationCategory,
        vendor: string,
        rawSettings: unknown,
    ): Record<string, unknown> {
        if (vendor === 'wardline') {
            return {
                source: 'wardline',
                category,
                enabled: true,
            };
        }

        const settings = isRecord(rawSettings) ? rawSettings : {};
        const endpointOverrides = isRecord(settings.endpoints) ? settings.endpoints : {};
        const timeoutMs = asNumber(settings.timeoutMs) ?? DEFAULT_TIMEOUT_MS;

        const normalized: AthenaSettings = {
            baseUrl: asString(settings.baseUrl),
            healthPath:
                asString(settings.healthPath) ??
                asString(settings.metadataPath) ??
                '/metadata',
            timeoutMs,
            practiceId: asString(settings.practiceId),
            departmentId: asString(settings.departmentId),
            methods: {
                'appointment-request':
                    (asString(isRecord(settings.methods) ? settings.methods['appointment-request'] : undefined) as HttpMethod | undefined) ??
                    'POST',
                'refill-request':
                    (asString(isRecord(settings.methods) ? settings.methods['refill-request'] : undefined) as HttpMethod | undefined) ??
                    'POST',
                'insurance-check':
                    (asString(isRecord(settings.methods) ? settings.methods['insurance-check'] : undefined) as HttpMethod | undefined) ??
                    'POST',
                'billing-request':
                    (asString(isRecord(settings.methods) ? settings.methods['billing-request'] : undefined) as HttpMethod | undefined) ??
                    'POST',
            },
            endpoints: {
                health:
                    asString(endpointOverrides.health) ??
                    asString(settings.healthPath) ??
                    '/metadata',
                appointmentRequest:
                    asString(endpointOverrides.appointmentRequest) ??
                    asString(settings.appointmentRequestPath),
                refillRequest:
                    asString(endpointOverrides.refillRequest) ??
                    asString(settings.refillRequestPath),
                insuranceCheck:
                    asString(endpointOverrides.insuranceCheck) ??
                    asString(settings.insuranceCheckPath),
                billingRequest:
                    asString(endpointOverrides.billingRequest) ??
                    asString(settings.billingRequestPath),
            },
        };

        if (category === 'SCHEDULING' && !normalized.endpoints.appointmentRequest) {
            normalized.endpoints.appointmentRequest = '/appointments/request';
        }
        if (category === 'EHR_REFILL' && !normalized.endpoints.refillRequest) {
            normalized.endpoints.refillRequest = '/medication-refills';
        }
        if (category === 'INSURANCE' && !normalized.endpoints.insuranceCheck) {
            normalized.endpoints.insuranceCheck = '/coverage/check';
        }
        if (category === 'BILLING' && !normalized.endpoints.billingRequest) {
            normalized.endpoints.billingRequest = '/billing/cases';
        }

        return normalized as unknown as Record<string, unknown>;
    }

    buildCapabilities(
        category: SupportedIntegrationCategory,
        vendor: string,
        normalizedSettings: Record<string, unknown>,
        healthOk: boolean,
    ): Record<string, unknown> {
        if (vendor === 'wardline') {
            return {
                vendor: 'wardline',
                category,
                liveExecution: category === 'KNOWLEDGE',
                canAnswerFaq: category === 'KNOWLEDGE',
                healthChecked: healthOk,
            };
        }

        const settings = normalizedSettings as unknown as AthenaSettings;
        const capabilities = {
            vendor: 'athenahealth',
            category,
            liveExecution: healthOk,
            canHealthCheck: true,
            canRequestAppointment: !!settings.endpoints.appointmentRequest,
            canRequestRefill: !!settings.endpoints.refillRequest,
            canCheckInsurance: !!settings.endpoints.insuranceCheck,
            canCreateBillingCase: !!settings.endpoints.billingRequest,
            practiceScoped: !!settings.practiceId,
            departmentScoped: !!settings.departmentId,
            timeoutMs: settings.timeoutMs,
        };

        return capabilities;
    }

    async testIntegration(integration: ResolvedBusinessIntegration): Promise<IntegrationHealthCheckResult> {
        const normalizedSettings = this.normalizeSettings(
            integration.category,
            integration.vendor,
            integration.settings,
        );

        if (integration.vendor === 'wardline') {
            return {
                ok: true,
                status: 'CONNECTED',
                message: 'Wardline knowledge source is available.',
                settings: normalizedSettings,
                capabilities: this.buildCapabilities(
                    integration.category,
                    integration.vendor,
                    normalizedSettings,
                    true,
                ),
            };
        }

        const authToken = this.resolveCredential(integration.credentialsRef, normalizedSettings);
        const settings = normalizedSettings as unknown as AthenaSettings;
        const baseUrl = asString(settings.baseUrl);
        if (!baseUrl) {
            return {
                ok: false,
                status: 'ERROR',
                message: 'A base URL is required before athenahealth can be tested.',
                settings: normalizedSettings,
                capabilities: this.buildCapabilities(
                    integration.category,
                    integration.vendor,
                    normalizedSettings,
                    false,
                ),
                metadata: { missing: ['baseUrl'] },
            };
        }

        if (!authToken) {
            return {
                ok: false,
                status: 'ERROR',
                message: 'No credential secret was found for this integration.',
                settings: normalizedSettings,
                capabilities: this.buildCapabilities(
                    integration.category,
                    integration.vendor,
                    normalizedSettings,
                    false,
                ),
                metadata: { missing: ['credentialsRef'] },
            };
        }

        const healthUrl = joinUrl(baseUrl, settings.endpoints.health);
        if (!healthUrl) {
            return {
                ok: false,
                status: 'ERROR',
                message: 'No health endpoint is configured for this integration.',
                settings: normalizedSettings,
                capabilities: this.buildCapabilities(
                    integration.category,
                    integration.vendor,
                    normalizedSettings,
                    false,
                ),
                metadata: { missing: ['healthPath'] },
            };
        }

        try {
            const response = await this.request(healthUrl, {
                method: 'GET',
                timeoutMs: settings.timeoutMs,
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    Accept: 'application/json',
                },
            });

            const ok = response.ok;
            const capabilities = this.buildCapabilities(
                integration.category,
                integration.vendor,
                normalizedSettings,
                ok,
            );

            return {
                ok,
                status: ok ? 'CONNECTED' : 'ERROR',
                message: ok
                    ? 'athenahealth connection validated successfully.'
                    : `athenahealth health check failed with status ${response.status}.`,
                settings: normalizedSettings,
                capabilities,
                metadata: {
                    statusCode: response.status,
                    testedUrl: healthUrl,
                    responsePreview: response.bodyPreview,
                },
            };
        } catch (error) {
            return {
                ok: false,
                status: 'ERROR',
                message: error instanceof Error ? error.message : 'athenahealth health check failed.',
                settings: normalizedSettings,
                capabilities: this.buildCapabilities(
                    integration.category,
                    integration.vendor,
                    normalizedSettings,
                    false,
                ),
            };
        }
    }

    async execute(request: IntegrationExecutionRequest): Promise<IntegrationExecutionResult> {
        const normalizedSettings = this.normalizeSettings(
            request.integration.category,
            request.integration.vendor,
            request.integration.settings,
        );

        if (request.integration.vendor === 'wardline') {
            return {
                ok: request.integration.category === 'KNOWLEDGE',
                handledLive: request.integration.category === 'KNOWLEDGE',
                message:
                    request.integration.category === 'KNOWLEDGE'
                        ? 'Knowledge lookups stay on the internal Wardline source.'
                        : 'This integration category is not executed live by Wardline.',
                data: { source: 'wardline' },
                fallbackReason: request.integration.category === 'KNOWLEDGE' ? undefined : 'unsupported_vendor',
            };
        }

        const authToken = this.resolveCredential(request.integration.credentialsRef, normalizedSettings);
        if (!authToken) {
            return {
                ok: false,
                handledLive: false,
                message: 'No credential secret is configured for this integration.',
                fallbackReason: 'missing_credentials',
            };
        }

        const settings = normalizedSettings as unknown as AthenaSettings;
        const endpoint = this.getActionEndpoint(settings, request.actionName);
        const url = joinUrl(settings.baseUrl, endpoint);
        if (!url) {
            return {
                ok: false,
                handledLive: false,
                message: 'This athenahealth action is not configured for live execution.',
                fallbackReason: 'unsupported_capability',
            };
        }

        const requestBody = this.buildActionPayload(request.actionName, settings, request.payload);

        try {
            const response = await this.request(url, {
                method: settings.methods[request.actionName] ?? 'POST',
                timeoutMs: settings.timeoutMs,
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: requestBody,
            });

            if (!response.ok) {
                return {
                    ok: false,
                    handledLive: false,
                    message: `athenahealth returned status ${response.status} for ${request.actionName}.`,
                    fallbackReason: `http_${response.status}`,
                    data: {
                        statusCode: response.status,
                        responsePreview: response.bodyPreview,
                    },
                };
            }

            const parsed = response.parsedBody;
            return {
                ok: true,
                handledLive: true,
                message: this.buildSuccessMessage(request.actionName),
                data: {
                    externalReferenceId:
                        (isRecord(parsed) && asString(parsed.id)) ||
                        (isRecord(parsed) && asString(parsed.referenceId)) ||
                        `${request.actionName}:${Date.now()}`,
                    response: parsed,
                },
                metadata: {
                    requestedUrl: url,
                    actionName: request.actionName,
                },
            };
        } catch (error) {
            return {
                ok: false,
                handledLive: false,
                message: error instanceof Error ? error.message : 'Live integration execution failed.',
                fallbackReason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'request_error',
            };
        }
    }

    private getActionEndpoint(
        settings: AthenaSettings,
        actionName: SupportedRuntimeAction,
    ): string | undefined {
        switch (actionName) {
            case 'appointment-request':
                return settings.endpoints.appointmentRequest;
            case 'refill-request':
                return settings.endpoints.refillRequest;
            case 'insurance-check':
                return settings.endpoints.insuranceCheck;
            case 'billing-request':
                return settings.endpoints.billingRequest;
            default:
                return undefined;
        }
    }

    private buildSuccessMessage(actionName: SupportedRuntimeAction): string {
        switch (actionName) {
            case 'appointment-request':
                return 'Your appointment request was submitted successfully.';
            case 'refill-request':
                return 'Your refill request was submitted successfully.';
            case 'insurance-check':
                return 'I was able to check that insurance information live.';
            case 'billing-request':
                return 'Your billing request was submitted successfully.';
            default:
                return 'The live integration request succeeded.';
        }
    }

    private buildActionPayload(
        actionName: SupportedRuntimeAction,
        settings: AthenaSettings,
        payload: Record<string, unknown>,
    ): Record<string, unknown> {
        return {
            practiceId: settings.practiceId,
            departmentId: settings.departmentId,
            actionName,
            requestedAt: new Date().toISOString(),
            data: summarizePayload(payload),
        };
    }

    private resolveCredential(
        credentialsRef: string | null | undefined,
        normalizedSettings: Record<string, unknown>,
    ): string | undefined {
        const directToken = asString(normalizedSettings.accessToken);
        if (directToken) return directToken;
        if (!credentialsRef) return undefined;
        return asString(process.env[credentialsRef]);
    }

    private async request(
        url: string,
        config: {
            method: HttpMethod;
            timeoutMs: number;
            headers: Record<string, string>;
            body?: Record<string, unknown>;
        },
    ) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

        try {
            const response = await fetch(url, {
                method: config.method,
                headers: config.headers,
                body: config.body ? JSON.stringify(config.body) : undefined,
                signal: controller.signal,
            });
            const rawBody = await response.text();
            let parsedBody: unknown = rawBody;

            if (rawBody) {
                try {
                    parsedBody = JSON.parse(rawBody);
                } catch {
                    parsedBody = rawBody;
                }
            }

            return {
                ok: response.ok,
                status: response.status,
                bodyPreview: rawBody.slice(0, 500),
                parsedBody,
            };
        } finally {
            clearTimeout(timeout);
        }
    }
}
