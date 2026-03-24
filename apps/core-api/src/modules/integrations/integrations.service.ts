import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ALLOWED_CATEGORIES = new Set([
    'SCHEDULING',
    'EHR_REFILL',
    'BILLING',
    'INSURANCE',
    'KNOWLEDGE',
]);

@Injectable()
export class IntegrationsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(businessId: string): Promise<any[]> {
        return this.prisma.businessIntegration.findMany({
            where: { businessId },
            orderBy: { category: 'asc' },
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

        return integration;
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

        return this.prisma.businessIntegration.upsert({
            where: {
                businessId_category: {
                    businessId,
                    category: normalizedCategory as any,
                },
            },
            update: {
                vendor: body.vendor,
                status: (body.status?.toUpperCase() ?? 'CONNECTED') as any,
                credentialsRef: body.credentialsRef,
                settings: body.settings as any,
                capabilities: body.capabilities as any,
                lastHealthCheckAt: new Date(),
            },
            create: {
                businessId,
                category: normalizedCategory as any,
                vendor: body.vendor,
                status: (body.status?.toUpperCase() ?? 'CONNECTED') as any,
                credentialsRef: body.credentialsRef,
                settings: body.settings as any,
                capabilities: body.capabilities as any,
                lastHealthCheckAt: new Date(),
            },
        });
    }

    async testConnection(businessId: string, category: string): Promise<any> {
        const integration = await this.findOne(businessId, category);

        const updated = await this.prisma.businessIntegration.update({
            where: { id: integration.id },
            data: {
                status: integration.vendor ? 'CONNECTED' : 'ERROR',
                lastHealthCheckAt: new Date(),
            },
        });

        return {
            ok: updated.status === 'CONNECTED',
            integration: updated,
        };
    }

    private normalizeCategory(category: string) {
        const normalized = category.toUpperCase();
        if (!ALLOWED_CATEGORIES.has(normalized)) {
            throw new NotFoundException(`Unsupported integration category: ${category}`);
        }
        return normalized;
    }
}
