import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';
import { AGENT_CATALOG } from '@wardline/db/src/seed-agents';

@Injectable()
export class AgentsService {
    private readonly logger = new Logger(AgentsService.name);

    constructor(private readonly prisma: PrismaService) {}

    // -------------------------------------------------------------------------
    // Catalog (read-only templates)
    // -------------------------------------------------------------------------

    getCatalog() {
        return AGENT_CATALOG.map(item => ({
            catalogId: item.catalogId,
            name: item.name,
            description: item.description,
            scopeBoundary: item.scopeBoundary,
            icon: item.icon,
            color: item.color,
            tags: item.tags,
            toolConfigSchema: item.toolConfigSchema,
        }));
    }

    getCatalogItem(catalogId: string) {
        const item = AGENT_CATALOG.find(a => a.catalogId === catalogId);
        if (!item) throw new NotFoundException(`Catalog agent "${catalogId}" not found`);
        return item;
    }

    // -------------------------------------------------------------------------
    // Deployed Agents (per-business instances)
    // -------------------------------------------------------------------------

    async findAll(businessId: string): Promise<any[]> {
        return this.prisma.agent.findMany({
            where: { businessId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async findOne(id: string): Promise<any> {
        const agent = await this.prisma.agent.findUnique({ where: { id } });
        if (!agent) throw new NotFoundException(`Agent "${id}" not found`);
        return agent;
    }

    async findByCatalogId(businessId: string, catalogId: string): Promise<any> {
        const agent = await this.prisma.agent.findFirst({ where: { businessId, catalogId } });
        if (!agent) throw new NotFoundException(`Agent "${catalogId}" not deployed for this business`);
        return agent;
    }

    /**
     * Deploy a catalog agent for a business (creates the deployed instance).
     */
    async deploy(businessId: string, catalogId: string): Promise<any> {
        const catalogItem = this.getCatalogItem(catalogId);

        const existing = await this.prisma.agent.findFirst({ where: { businessId, catalogId } });
        if (existing) throw new ConflictException(`Agent "${catalogId}" is already deployed`);

        return this.prisma.agent.create({
            data: {
                businessId,
                catalogId,
                name: catalogItem.name,
                description: catalogItem.description,
                status: 'ACTIVE',
                nodeGraph: catalogItem.defaultNodeGraph as any,
                toolConfig: {},
                agentConfig: {
                    scopeBoundary: catalogItem.scopeBoundary,
                    icon: catalogItem.icon,
                    color: catalogItem.color,
                    tags: catalogItem.tags,
                    toolConfigSchema: catalogItem.toolConfigSchema,
                },
            },
        });
    }

    /**
     * Update agent status (activate / pause / deactivate)
     */
    async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'PAUSED'): Promise<any> {
        return this.prisma.agent.update({ where: { id }, data: { status } });
    }

    /**
     * Update the tool credentials for a deployed agent
     */
    async updateToolConfig(id: string, toolConfig: Record<string, unknown>): Promise<any> {
        this.logger.info('Updating tool config', { agentId: id });
        return this.prisma.agent.update({ where: { id }, data: { toolConfig: toolConfig as any } });
    }

    /**
     * Update agent-level config (greeting scripts, thresholds, etc.)
     */
    async updateAgentConfig(id: string, agentConfig: Record<string, unknown>): Promise<any> {
        return this.prisma.agent.update({ where: { id }, data: { agentConfig: agentConfig as any } });
    }

    /**
     * Update the node graph for a deployed agent
     */
    async updateNodeGraph(id: string, nodeGraph: Record<string, unknown>): Promise<any> {
        return this.prisma.agent.update({ where: { id }, data: { nodeGraph: nodeGraph as any } });
    }

    /**
     * Call stats for a deployed agent — derived from call session tags
     */
    async getStats(id: string, businessId: string): Promise<any> {
        const agent = await this.findOne(id);

        const tagMap: Record<string, string> = {
            scheduling: 'SCHEDULING',
            billing: 'BILLING',
            insurance: 'INSURANCE',
            faq: 'FAQ',
            'prescription-refill': 'PRESCRIPTION_REFILL',
        };

        const tag = tagMap[agent.catalogId];
        if (!tag) return { totalCalls: 0, escalatedCalls: 0, voicemailCalls: 0, resolutionRate: 0 };

        const [totalCalls, escalatedCalls, voicemailCalls] = await Promise.all([
            this.prisma.callSession.count({ where: { businessId, tag: tag as any } }),
            this.prisma.callSession.count({ where: { businessId, tag: tag as any, handoffs: { some: {} } } }),
            this.prisma.callSession.count({ where: { businessId, tag: 'VOICEMAIL' as any } }),
        ]);

        const resolvedCalls = totalCalls - escalatedCalls - voicemailCalls;
        const resolutionRate = totalCalls > 0 ? Math.round((resolvedCalls / totalCalls) * 100) : 0;

        return { totalCalls, resolvedCalls, escalatedCalls, voicemailCalls, resolutionRate };
    }

    /**
     * Remove a deployed agent from the business
     */
    async undeploy(id: string): Promise<void> {
        try {
            await this.prisma.agent.delete({ where: { id } });
        } catch (err: any) {
            if (err.code === 'P2025') throw new NotFoundException(`Agent "${id}" not found`);
            throw err;
        }
    }
}
