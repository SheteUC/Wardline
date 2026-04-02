import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AuditService } from '../../audit/audit.service';
import { CredentialsCryptoService } from '../../crypto/credentials-crypto.service';
import {
    IntegrationConnectorsService,
    ResolvedBusinessIntegration,
    SupportedIntegrationCategory,
} from './integration-connectors.service';

const ALLOWED_CATEGORIES = new Set([
    'SCHEDULING',
    'EHR_REFILL',
    'BILLING',
    'INSURANCE',
    'KNOWLEDGE',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const DEFAULT_MOCK_CREDENTIALS_REF = () => process.env.MOCK_CREDENTIALS_REF || 'MOCK_ATHENAHEALTH_TOKEN';

/** Merge incoming PUT payload with stored settings so omitted or empty baseUrl does not wipe seeded values. */
function mergeAthenaSettingsPayload(
    existingRow: { settings: unknown } | null,
    incoming: Record<string, unknown> | undefined,
): Record<string, unknown> {
    const prev = existingRow && isRecord(existingRow.settings) ? existingRow.settings : {};
    const inc = incoming && isRecord(incoming) ? incoming : {};
    const merged: Record<string, unknown> = {
        ...prev,
        ...inc,
        endpoints: {
            ...(isRecord(prev.endpoints) ? prev.endpoints : {}),
            ...(isRecord(inc.endpoints) ? inc.endpoints : {}),
        },
    };
    const hasExplicitBaseUrl = Object.prototype.hasOwnProperty.call(inc, 'baseUrl');
    const incBaseUrl = inc.baseUrl;
    const incBaseUrlEmpty =
        !hasExplicitBaseUrl ||
        incBaseUrl === null ||
        incBaseUrl === undefined ||
        String(incBaseUrl).trim() === '';
    if (incBaseUrlEmpty) {
        const prevBase = prev.baseUrl;
        if (prevBase !== undefined && prevBase !== null && String(prevBase).trim() !== '') {
            merged.baseUrl = prevBase;
        } else if (!String(merged.baseUrl ?? '').trim()) {
            merged.baseUrl =
                process.env.STAGING_INTEGRATION_BASE_URL ||
                process.env.MOCK_INTEGRATION_BASE_URL ||
                '';
        }
    }
    return merged;
}

function resolveCredentialsRef(
    category: SupportedIntegrationCategory,
    body: { credentialsRef?: string | null },
    existing?: { credentialsRef: string | null } | null,
): string | null {
    if (category === 'KNOWLEDGE') {
        return null;
    }
    const explicit = Object.prototype.hasOwnProperty.call(body, 'credentialsRef');
    if (explicit) {
        const v = body.credentialsRef;
        if (v === null || v === undefined || String(v).trim() === '') {
            return null;
        }
        return String(v).trim();
    }
    const existingRef = existing?.credentialsRef;
    if (existingRef !== null && existingRef !== undefined && String(existingRef).trim() !== '') {
        return existingRef;
    }
    return DEFAULT_MOCK_CREDENTIALS_REF();
}

@Injectable()
export class IntegrationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
        private readonly auditService: AuditService,
        private readonly integrationConnectors: IntegrationConnectorsService,
        private readonly credentialsCrypto: CredentialsCryptoService,
    ) {}

    async findAll(businessId: string): Promise<any[]> {
        const configured = await this.prisma.businessIntegration.findMany({
            where: { businessId },
            orderBy: { category: 'asc' },
        });

        const configuredByCategory = new Map(configured.map((integration) => [integration.category, integration]));

        return this.integrationConnectors.getAllCategories().map((category) => {
            const existing = configuredByCategory.get(category);
            if (!existing) {
                return this.integrationConnectors.buildDisconnectedIntegration(businessId, category);
            }

            const decrypted = this.decryptIntegrationRow(existing);
            const normalizedSettings = this.integrationConnectors.normalizeSettings(
                category,
                decrypted.vendor,
                decrypted.settings,
            );

            return {
                ...decrypted,
                settings: normalizedSettings,
                capabilities: this.integrationConnectors.buildCapabilities(
                    category,
                    existing.vendor,
                    normalizedSettings,
                    existing.status === 'CONNECTED',
                ),
            };
        });
    }

    async findOne(businessId: string, category: string): Promise<any> {
        const normalizedCategory = this.normalizeCategory(category);
        const integration = await this.prisma.businessIntegration.findUnique({
            where: {
                businessId_category: {
                    businessId,
                    category: normalizedCategory as any,
                },
            },
        });

        if (!integration) {
            throw new NotFoundException(`Integration not configured for ${normalizedCategory}`);
        }

        const decrypted = this.decryptIntegrationRow(integration);
        const normalizedSettings = this.integrationConnectors.normalizeSettings(
            normalizedCategory,
            decrypted.vendor,
            decrypted.settings,
        );

        return {
            ...decrypted,
            settings: normalizedSettings,
            capabilities: this.integrationConnectors.buildCapabilities(
                normalizedCategory,
                integration.vendor,
                normalizedSettings,
                integration.status === 'CONNECTED',
            ),
        };
    }

    async upsert(
        businessId: string,
        category: string,
        body: {
            vendor: string;
            status?: string;
            credentialsRef?: string | null;
            settings?: Record<string, unknown>;
            capabilities?: Record<string, unknown>;
        },
    ): Promise<any> {
        const normalizedCategory = this.normalizeCategory(category);
        const vendor = body.vendor?.trim() || this.integrationConnectors.getDefaultVendor(normalizedCategory);

        const existingRow = await this.prisma.businessIntegration.findUnique({
            where: {
                businessId_category: {
                    businessId,
                    category: normalizedCategory as any,
                },
            },
        });
        const existing = existingRow ? this.decryptIntegrationRow(existingRow) : null;

        const rawSettings =
            vendor === 'wardline'
                ? (body.settings ?? {})
                : mergeAthenaSettingsPayload(existing, body.settings);
        const resolvedCredentialsRef = resolveCredentialsRef(normalizedCategory, body, existing);

        const normalizedSettings = this.integrationConnectors.normalizeSettings(
            normalizedCategory,
            vendor,
            rawSettings,
        );
        const normalizedCapabilities = body.capabilities ?? this.integrationConnectors.buildCapabilities(
            normalizedCategory,
            vendor,
            normalizedSettings,
            false,
        );

        const storedCredentialsRef =
            resolvedCredentialsRef === null || resolvedCredentialsRef === undefined
                ? resolvedCredentialsRef
                : (this.credentialsCrypto.encrypt(resolvedCredentialsRef) ?? resolvedCredentialsRef);
        const storedSettings = this.credentialsCrypto.encryptIntegrationSettingsJson(normalizedSettings);

        const integrationRow = await this.prisma.businessIntegration.upsert({
            where: {
                businessId_category: {
                    businessId,
                    category: normalizedCategory as any,
                },
            },
            update: {
                vendor,
                status: (body.status?.toUpperCase() ?? 'DISCONNECTED') as any,
                credentialsRef: storedCredentialsRef,
                settings: storedSettings as any,
                capabilities: normalizedCapabilities as any,
            },
            create: {
                businessId,
                category: normalizedCategory as any,
                vendor,
                status: (body.status?.toUpperCase() ?? 'DISCONNECTED') as any,
                credentialsRef: storedCredentialsRef,
                settings: storedSettings as any,
                capabilities: normalizedCapabilities as any,
            },
        });
        const integration = this.decryptIntegrationRow(integrationRow);

        await this.auditService.logAction({
            businessId,
            action: 'integration.upserted',
            entityType: 'business_integration',
            entityId: integration.id,
            metadata: {
                category: normalizedCategory,
                vendor,
                credentialsRefRedacted: true,
            },
        });
        await this.invalidate(businessId);
        const outSettings = this.integrationConnectors.normalizeSettings(
            normalizedCategory,
            integration.vendor,
            integration.settings,
        );
        return {
            ...integration,
            settings: outSettings,
            capabilities: this.integrationConnectors.buildCapabilities(
                normalizedCategory,
                integration.vendor,
                outSettings,
                integration.status === 'CONNECTED',
            ),
        };
    }

    async testConnection(businessId: string, category: string): Promise<any> {
        const resolvedIntegration = await this.findResolvedIntegration(businessId, category);
        const healthResult = await this.integrationConnectors.testIntegration(resolvedIntegration);

        const credRef =
            resolvedIntegration.credentialsRef === null || resolvedIntegration.credentialsRef === undefined
                ? resolvedIntegration.credentialsRef
                : (this.credentialsCrypto.encrypt(resolvedIntegration.credentialsRef)
                    ?? resolvedIntegration.credentialsRef);
        const healthSettings = this.credentialsCrypto.encryptIntegrationSettingsJson(healthResult.settings);

        const updatedRow = await this.prisma.businessIntegration.upsert({
            where: {
                businessId_category: {
                    businessId,
                    category: resolvedIntegration.category as any,
                },
            },
            update: {
                vendor: resolvedIntegration.vendor,
                credentialsRef: credRef,
                settings: healthSettings as any,
                capabilities: healthResult.capabilities as any,
                status: healthResult.status as any,
                lastHealthCheckAt: new Date(),
            },
            create: {
                businessId,
                category: resolvedIntegration.category as any,
                vendor: resolvedIntegration.vendor,
                credentialsRef: credRef,
                settings: healthSettings as any,
                capabilities: healthResult.capabilities as any,
                status: healthResult.status as any,
                lastHealthCheckAt: new Date(),
            },
        });
        const updated = this.decryptIntegrationRow(updatedRow);

        await this.auditService.logAction({
            businessId,
            action: healthResult.ok ? 'integration.health_check_passed' : 'integration.health_check_failed',
            entityType: 'business_integration',
            entityId: updated.id,
            metadata: {
                category: resolvedIntegration.category,
                vendor: resolvedIntegration.vendor,
                message: healthResult.message,
                details: healthResult.metadata,
            },
        });
        await this.invalidate(businessId);

        return {
            ok: healthResult.ok,
            message: healthResult.message,
            integration: updated,
            latencyMs:
                typeof healthResult.metadata?.latencyMs === 'number'
                    ? healthResult.metadata.latencyMs
                    : undefined,
        };
    }

    async findResolvedIntegration(
        businessId: string,
        category: string,
    ): Promise<ResolvedBusinessIntegration> {
        const normalizedCategory = this.normalizeCategory(category);
        const integration = await this.prisma.businessIntegration.findUnique({
            where: {
                businessId_category: {
                    businessId,
                    category: normalizedCategory as any,
                },
            },
        });

        if (!integration) {
            return this.integrationConnectors.buildDisconnectedIntegration(businessId, normalizedCategory);
        }

        const decrypted = this.decryptIntegrationRow(integration);
        const normalizedSettings = this.integrationConnectors.normalizeSettings(
            normalizedCategory,
            decrypted.vendor,
            decrypted.settings,
        );
        return {
            ...decrypted,
            settings: normalizedSettings,
            capabilities: this.integrationConnectors.buildCapabilities(
                normalizedCategory,
                decrypted.vendor,
                normalizedSettings,
                decrypted.status === 'CONNECTED',
            ),
        };
    }

    private normalizeCategory(category: string) {
        const normalized = category.toUpperCase();
        if (!ALLOWED_CATEGORIES.has(normalized)) {
            throw new NotFoundException(`Unsupported integration category: ${category}`);
        }
        return normalized as SupportedIntegrationCategory;
    }

    private async invalidate(businessId: string) {
        await this.cache.invalidateByTag(`business:${businessId}`);
        await this.cache.invalidateByPrefix(`follow-up-tasks:${businessId}:`);
    }

    private decryptIntegrationRow<T extends { credentialsRef?: string | null; settings?: unknown }>(
        row: T,
    ): T {
        return {
            ...row,
            credentialsRef: (this.credentialsCrypto.decrypt(row.credentialsRef) ?? row.credentialsRef) as any,
            settings: this.credentialsCrypto.decryptIntegrationSettingsJson(row.settings),
        };
    }
}
