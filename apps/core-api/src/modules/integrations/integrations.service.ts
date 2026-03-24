import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AuditService } from '../../audit/audit.service';
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

@Injectable()
export class IntegrationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
        private readonly auditService: AuditService,
        private readonly integrationConnectors: IntegrationConnectorsService,
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

            const normalizedSettings = this.integrationConnectors.normalizeSettings(
                category,
                existing.vendor,
                existing.settings,
            );

            return {
                ...existing,
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

        const normalizedSettings = this.integrationConnectors.normalizeSettings(
            normalizedCategory,
            integration.vendor,
            integration.settings,
        );

        return {
            ...integration,
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
            credentialsRef?: string;
            settings?: Record<string, unknown>;
            capabilities?: Record<string, unknown>;
        },
    ): Promise<any> {
        const normalizedCategory = this.normalizeCategory(category);
        const vendor = body.vendor?.trim() || this.integrationConnectors.getDefaultVendor(normalizedCategory);
        const normalizedSettings = this.integrationConnectors.normalizeSettings(
            normalizedCategory,
            vendor,
            body.settings,
        );
        const normalizedCapabilities = body.capabilities ?? this.integrationConnectors.buildCapabilities(
            normalizedCategory,
            vendor,
            normalizedSettings,
            false,
        );

        const integration = await this.prisma.businessIntegration.upsert({
            where: {
                businessId_category: {
                    businessId,
                    category: normalizedCategory as any,
                },
            },
            update: {
                vendor,
                status: (body.status?.toUpperCase() ?? 'DISCONNECTED') as any,
                credentialsRef: body.credentialsRef,
                settings: normalizedSettings as any,
                capabilities: normalizedCapabilities as any,
            },
            create: {
                businessId,
                category: normalizedCategory as any,
                vendor,
                status: (body.status?.toUpperCase() ?? 'DISCONNECTED') as any,
                credentialsRef: body.credentialsRef,
                settings: normalizedSettings as any,
                capabilities: normalizedCapabilities as any,
            },
        });

        await this.auditService.logAction({
            businessId,
            action: 'integration.upserted',
            entityType: 'business_integration',
            entityId: integration.id,
            metadata: {
                category: normalizedCategory,
                vendor,
                credentialsRef: body.credentialsRef,
            },
        });
        await this.invalidate(businessId);
        return integration;
    }

    async testConnection(businessId: string, category: string): Promise<any> {
        const resolvedIntegration = await this.findResolvedIntegration(businessId, category);
        const healthResult = await this.integrationConnectors.testIntegration(resolvedIntegration);

        const updated = await this.prisma.businessIntegration.upsert({
            where: {
                businessId_category: {
                    businessId,
                    category: resolvedIntegration.category as any,
                },
            },
            update: {
                vendor: resolvedIntegration.vendor,
                credentialsRef: resolvedIntegration.credentialsRef,
                settings: healthResult.settings as any,
                capabilities: healthResult.capabilities as any,
                status: healthResult.status as any,
                lastHealthCheckAt: new Date(),
            },
            create: {
                businessId,
                category: resolvedIntegration.category as any,
                vendor: resolvedIntegration.vendor,
                credentialsRef: resolvedIntegration.credentialsRef,
                settings: healthResult.settings as any,
                capabilities: healthResult.capabilities as any,
                status: healthResult.status as any,
                lastHealthCheckAt: new Date(),
            },
        });

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

        const normalizedSettings = this.integrationConnectors.normalizeSettings(
            normalizedCategory,
            integration.vendor,
            integration.settings,
        );
        return {
            ...integration,
            settings: normalizedSettings,
            capabilities: this.integrationConnectors.buildCapabilities(
                normalizedCategory,
                integration.vendor,
                normalizedSettings,
                integration.status === 'CONNECTED',
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
}
