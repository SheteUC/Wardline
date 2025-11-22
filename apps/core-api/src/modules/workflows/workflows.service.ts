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
}
