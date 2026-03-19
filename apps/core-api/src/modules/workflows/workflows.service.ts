import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';

@Injectable()
export class WorkflowsService {
    private readonly logger = new Logger(WorkflowsService.name);

    constructor(private prisma: PrismaService) { }

    async create(hospitalId: string, userId: string, data: any): Promise<any> {
        const workflow = await this.prisma.workflow.create({
            data: {
                ...data,
                hospitalId,
                versions: {
                    create: {
                        versionNumber: 1,
                        graphJson: data.graphJson || { nodes: [], edges: [] },
                        createdByUserId: userId,
                        status: 'DRAFT' as const,
                    },
                },
            },
            include: {
                versions: true,
            },
        });

        this.logger.info('Workflow created', { id: workflow.id });
        return workflow;
    }

    async findAllByHospital(hospitalId: string): Promise<any[]> {
        return this.prisma.workflow.findMany({
            where: { hospitalId },
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

    async createVersion(workflowId: string, userId: string, graphJson: any): Promise<any> {
        const workflow = await this.findOne(workflowId);
        const latestVersion = workflow.versions[0];

        return this.prisma.workflowVersion.create({
            data: {
                workflowId,
                versionNumber: latestVersion.versionNumber + 1,
                graphJson,
                createdByUserId: userId,
                status: 'DRAFT' as const,
            },
        });
    }

    async publishVersion(versionId: string, approverUserId: string): Promise<any> {
        // Set all other versions to not published
        const version = await this.prisma.workflowVersion.findUnique({
            where: { id: versionId },
            include: { workflow: true },
        });

        if (!version) throw new NotFoundException('Version not found');

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
                status: 'PUBLISHED' as const,
                publishedAt: new Date(),
                approvedByUserId: approverUserId,
            },
        });

        this.logger.info('Workflow version published', { versionId });
        return published;
    }

    /**
     * Get the active workflow for a hospital (used by voice orchestrator)
     */
    async getActiveWorkflow(hospitalId: string, phoneNumberId?: string): Promise<any> {
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
                return {
                    id: phoneNumber.workflow.id,
                    name: phoneNumber.workflow.name,
                    description: phoneNumber.workflow.description,
                    version: phoneNumber.workflow.versions[0].versionNumber,
                    graphJson: phoneNumber.workflow.versions[0].graphJson,
                };
            }
        }

        // Otherwise, find the most recently published workflow for hospital
        const workflow = await this.prisma.workflow.findFirst({
            where: { 
                hospitalId,
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
            graphJson: workflow.versions[0].graphJson,
        };
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

        const validationResult = validator.validate(latestVersion.graphJson);

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
        const graph = latestVersion.graphJson;

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
}
