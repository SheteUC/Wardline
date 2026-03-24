import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';
import { UserRole } from '@wardline/types';

@Injectable()
export class WorkflowsService {
    private readonly logger = new Logger(WorkflowsService.name);

    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
    ) { }

    async create(businessId: string, userId: string | undefined, data: any): Promise<any> {
        const actorUserId = await this.resolveActorUserId(businessId, userId);
        const compiledGraph = this.compileGraph(data.graphJson || { nodes: [], edges: [] });

        const workflow = await this.prisma.workflow.create({
            data: {
                name: data.name,
                description: data.description ?? '',
                businessId,
                versions: {
                    create: {
                        versionNumber: 1,
                        graphJson: compiledGraph,
                        createdByUserId: actorUserId,
                        status: 'DRAFT' as const,
                    },
                },
            },
            include: {
                versions: true,
            },
        });

        this.logger.info('Workflow created', { id: workflow.id });
        await this.invalidateWorkflowCache(businessId);
        return workflow;
    }

    async findAllByBusiness(businessId: string): Promise<any[]> {
        return this.prisma.workflow.findMany({
            where: { businessId },
            include: {
                versions: {
                    where: { status: 'PUBLISHED' },
                    take: 1,
                    orderBy: { publishedAt: 'desc' },
                },
            },
        });
    }

    async findOne(id: string): Promise<any> {
        const workflow = await this.prisma.workflow.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { versionNumber: 'desc' },
                },
            },
        });

        if (!workflow) throw new NotFoundException(`Workflow with ID "${id}" not found`);
        return workflow;
    }

    async createVersion(workflowId: string, userId: string | undefined, graphJson: any): Promise<any> {
        const workflow = await this.findOne(workflowId);
        const latestVersion = workflow.versions[0];
        const actorUserId = await this.resolveActorUserId(workflow.businessId, userId);
        const version = await this.prisma.workflowVersion.create({
            data: {
                workflowId,
                versionNumber: latestVersion.versionNumber + 1,
                graphJson: this.compileGraph(graphJson),
                createdByUserId: actorUserId,
                status: 'DRAFT' as const,
            },
        });

        await this.invalidateWorkflowCache(workflow.businessId);
        return version;
    }

    async publishVersion(versionId: string, approverUserId?: string): Promise<any> {
        // Set all other versions to not published
        const version = await this.prisma.workflowVersion.findUnique({
            where: { id: versionId },
            include: { workflow: true },
        });

        if (!version) throw new NotFoundException('Version not found');
        const actorUserId = await this.resolveActorUserId(version.workflow.businessId, approverUserId);
        const compiledGraph = this.compileGraph(version.graphJson);

        // Unpublish all other versions
        await this.prisma.workflowVersion.updateMany({
            where: {
                workflowId: version.workflowId,
                status: 'PUBLISHED',
            },
            data: {
                status: 'APPROVED' as const,
            },
        });

        // Publish this version
        const published = await this.prisma.workflowVersion.update({
            where: { id: versionId },
            data: {
                graphJson: compiledGraph,
                status: 'PUBLISHED' as const,
                publishedAt: new Date(),
                approvedByUserId: actorUserId,
            },
        });

        await this.prisma.workflow.update({
            where: { id: version.workflowId },
            data: { status: 'PUBLISHED' as const },
        });

        this.logger.info('Workflow version published', { versionId });
        await this.invalidateWorkflowCache(version.workflow.businessId);
        return published;
    }

    /**
     * Get the active workflow for a business (used by voice orchestrator)
     */
    async getActiveWorkflow(businessId: string, phoneNumberId?: string): Promise<any> {
        if (!businessId) return null;
        const cacheKey = `workflows:active:${businessId}:${phoneNumberId || 'default'}`;

        return this.cache.getOrSet(
            cacheKey,
            async () => {
                // If phone number provided, check if it has a specific workflow
                if (phoneNumberId) {
                    const phoneNumber = await this.prisma.phoneNumber.findUnique({
                        where: { id: phoneNumberId },
                        include: {
                            workflow: {
                                include: {
                                    versions: {
                                        where: { status: 'PUBLISHED' },
                                        take: 1,
                                        orderBy: { publishedAt: 'desc' },
                                    },
                                },
                            },
                        },
                    });

                    if (phoneNumber?.workflow && phoneNumber.workflow.versions.length > 0) {
                        const version = phoneNumber.workflow.versions[0];
                        return {
                            id: phoneNumber.workflow.id,
                            name: phoneNumber.workflow.name,
                            description: phoneNumber.workflow.description,
                            version: version.versionNumber,
                            graphJson: this.compileGraph(version.graphJson),
                        };
                    }
                }

                // Otherwise, find the most recently published workflow for business
                const workflow = await this.prisma.workflow.findFirst({
                    where: {
                        businessId,
                        status: 'PUBLISHED',
                    },
                    include: {
                        versions: {
                            where: { status: 'PUBLISHED' },
                            take: 1,
                            orderBy: { publishedAt: 'desc' },
                        },
                    },
                    orderBy: { updatedAt: 'desc' },
                });

                if (!workflow || workflow.versions.length === 0) {
                    return null;
                }

                return {
                    id: workflow.id,
                    name: workflow.name,
                    description: workflow.description,
                    version: workflow.versions[0].versionNumber,
                    graphJson: this.compileGraph(workflow.versions[0].graphJson),
                };
            },
            {
                ttl: CacheTTL.MEDIUM,
                tags: [`business:${businessId}`, 'workflows:active'],
            },
        );
    }

    /**
     * Validate a workflow configuration
     */
    async validateWorkflow(workflowId: string): Promise<any> {
        const workflow = await this.findOne(workflowId);
        const latestVersion = workflow.versions[0];

        // Import validator
        const { WorkflowValidatorService } = await import('./services/workflow-validator.service');
        const validator = new WorkflowValidatorService();

        const validationResult = validator.validate(this.compileGraph(latestVersion.graphJson));

        return {
            workflowId,
            versionNumber: latestVersion.versionNumber,
            ...validationResult,
        };
    }

    /**
     * Simulate workflow execution with test inputs
     */
    async simulateWorkflow(workflowId: string, testInputs: any): Promise<any> {
        const workflow = await this.findOne(workflowId);
        const latestVersion = workflow.versions[0];
        const graph = this.compileGraph(latestVersion.graphJson) as any;

        this.logger.info(`Simulating workflow ${workflowId} with inputs:`, testInputs);

        // Simple simulation: trace through nodes
        const executionPath: string[] = [];
        const nodeResults: Record<string, any> = {};
        
        let currentNodeId = graph.nodes.find((n: any) => n.type === 'start')?.id;
        let iterations = 0;
        const maxIterations = 50; // Prevent infinite loops

        while (currentNodeId && iterations < maxIterations) {
            executionPath.push(currentNodeId);
            const currentNode = graph.nodes.find((n: any) => n.id === currentNodeId);

            if (!currentNode) break;

            // Simulate node execution
            nodeResults[currentNodeId] = {
                type: currentNode.type,
                executed: true,
                timestamp: new Date().toISOString(),
            };

            // Find next node
            if (currentNode.type === 'end') {
                break;
            }

            // For conditional nodes, use test input to determine path
            if (currentNode.type === 'conditional') {
                const edges = graph.edges.filter((e: any) => e.fromNodeId === currentNodeId);
                
                // Simple condition evaluation based on test inputs
                const matchedEdge = edges.find((e: any) => {
                    if (!e.condition) return true;
                    // Simplified: just take the first edge for simulation
                    return true;
                });

                currentNodeId = matchedEdge?.toNodeId;
            } else {
                // Follow the first outgoing edge
                const nextEdge = graph.edges.find((e: any) => e.fromNodeId === currentNodeId);
                currentNodeId = nextEdge?.toNodeId;
            }

            iterations++;
        }

        return {
            workflowId,
            executionPath,
            nodeResults,
            completed: currentNodeId === undefined || 
                      graph.nodes.find((n: any) => n.id === currentNodeId)?.type === 'end',
            iterations,
        };
    }

    private async resolveActorUserId(businessId: string, requestedUserId?: string): Promise<string> {
        if (requestedUserId) {
            const existingUser = await this.prisma.user.findUnique({ where: { id: requestedUserId } });
            if (existingUser) return existingUser.id;
        }

        const membership = await this.prisma.businessUser.findFirst({
            where: { businessId },
            orderBy: { createdAt: 'asc' },
            select: { userId: true },
        });
        if (membership) return membership.userId;

        const existingUser = await this.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
        if (existingUser) {
            await this.prisma.businessUser.upsert({
                where: {
                    businessId_userId: {
                        businessId,
                        userId: existingUser.id,
                    },
                },
                create: {
                    businessId,
                    userId: existingUser.id,
                    role: UserRole.OWNER as any,
                },
                update: {},
            });
            return existingUser.id;
        }

        const systemUser = await this.prisma.user.create({
            data: {
                clerkUserId: `system-${businessId}`,
                email: `system+${businessId}@wardline.local`,
                fullName: 'Wardline System',
            },
        });

        await this.prisma.businessUser.create({
            data: {
                businessId,
                userId: systemUser.id,
                role: UserRole.OWNER as any,
            },
        });

        return systemUser.id;
    }

    private compileGraph(graphJson: any): any {
        const normalizedNodes = Array.isArray(graphJson?.nodes)
            ? graphJson.nodes.map((node: any) => ({
                id: node.id,
                type: node.type,
                position: node.position ?? { x: 0, y: 0 },
                config: this.normalizeNodeConfig(node.type, node.config ?? node.data ?? {}),
            }))
            : [];

        const normalizedEdges = Array.isArray(graphJson?.edges)
            ? graphJson.edges.map((edge: any) => ({
                id: edge.id ?? `edge-${edge.source ?? edge.fromNodeId}-${edge.target ?? edge.toNodeId}`,
                fromNodeId: edge.fromNodeId ?? edge.source,
                toNodeId: edge.toNodeId ?? edge.target,
                condition: edge.condition ?? edge.label,
            }))
            : [];

        const startNode = normalizedNodes.find((node: any) => node.type === 'start');
        const adjacency = normalizedEdges.reduce((acc: Record<string, string[]>, edge: any) => {
            if (!edge.fromNodeId || !edge.toNodeId) return acc;
            acc[edge.fromNodeId] = [...(acc[edge.fromNodeId] || []), edge.toNodeId];
            return acc;
        }, {});

        return {
            nodes: normalizedNodes,
            edges: normalizedEdges,
            __runtime: {
                compiledAt: new Date().toISOString(),
                startNodeId: startNode?.id ?? null,
                nodeIds: normalizedNodes.map((node: any) => node.id),
                endNodeIds: normalizedNodes
                    .filter((node: any) => node.type === 'end')
                    .map((node: any) => node.id),
                nodeCount: normalizedNodes.length,
                edgeCount: normalizedEdges.length,
                hasEmergencyScreen: normalizedNodes.some((node: any) => node.type === 'emergency-screen'),
                hasSafetyCheck: normalizedNodes.some((node: any) => node.type === 'safety-check'),
                adjacency,
            },
        };
    }

    private normalizeNodeConfig(nodeType: string, config: Record<string, unknown>) {
        if (nodeType !== 'integration') {
            return config;
        }

        return this.normalizeIntegrationNodeConfig(config);
    }

    private normalizeIntegrationNodeConfig(config: Record<string, unknown>) {
        const runtimeActionFromCategory: Record<string, { actionName: string; category: string }> = {
            appointment_scheduling: {
                actionName: 'appointment-request',
                category: 'SCHEDULING',
            },
            scheduling: {
                actionName: 'appointment-request',
                category: 'SCHEDULING',
            },
            prescription_refill: {
                actionName: 'refill-request',
                category: 'EHR_REFILL',
            },
            ehr_lookup: {
                actionName: 'refill-request',
                category: 'EHR_REFILL',
            },
            insurance_verification: {
                actionName: 'insurance-check',
                category: 'INSURANCE',
            },
            billing_request: {
                actionName: 'billing-request',
                category: 'BILLING',
            },
        };

        const runtimeAction = typeof config.runtimeAction === 'string' ? config.runtimeAction : undefined;
        const integrationCategory =
            typeof config.integrationCategory === 'string' ? config.integrationCategory : undefined;
        const legacyKey =
            (typeof config.integrationType === 'string' && config.integrationType) ||
            (typeof config.integration === 'string' && config.integration) ||
            (typeof config.preset === 'string' && config.preset) ||
            (typeof config.action === 'string' && config.action);
        const translated = legacyKey ? runtimeActionFromCategory[legacyKey] : undefined;

        return {
            label: config.label ?? 'Runtime Action',
            mode: 'runtime_action',
            runtimeAction: runtimeAction ?? translated?.actionName ?? 'manual-follow-up',
            integrationCategory: integrationCategory ?? translated?.category ?? 'MANUAL',
            requiresConfirmation:
                typeof config.requiresConfirmation === 'boolean'
                    ? config.requiresConfirmation
                    : !['insurance-check', 'manual-follow-up'].includes(
                        runtimeAction ?? translated?.actionName ?? 'manual-follow-up',
                    ),
            fallbackBehavior:
                typeof config.fallbackBehavior === 'string' ? config.fallbackBehavior : 'create_follow_up',
            prompt:
                typeof config.prompt === 'string'
                    ? config.prompt
                    : typeof config.description === 'string'
                        ? config.description
                        : '',
            __legacySource:
                legacyKey && !runtimeAction
                    ? {
                        integrationType: config.integrationType,
                        integration: config.integration,
                        action: config.action,
                        endpointUrl: config.endpointUrl,
                    }
                    : undefined,
        };
    }

    private async invalidateWorkflowCache(businessId: string): Promise<void> {
        await this.cache.invalidateByTag(`business:${businessId}`);
        await this.cache.invalidateByTag('workflows:active');
        await this.cache.invalidateByPrefix(`workflows:active:${businessId}:`);
    }
}
