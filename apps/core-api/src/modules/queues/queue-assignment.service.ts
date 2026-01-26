import { Injectable, NotFoundException } from '@nestjs/common';
import { CallAssignmentStatus } from '@wardline/db';
import { AssignmentOptions } from '@wardline/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QueueAssignmentService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Assign a call to an agent using assignment strategy
     */
    async assignCallToAgent(
        queueId: string,
        callId: string,
        options: AssignmentOptions = { strategy: 'skill_based' }
    ): Promise<any> {
        // 1. Get queue details
        const queue = await this.prisma.callQueue.findUnique({
            where: { id: queueId },
        });

        if (!queue) {
            throw new NotFoundException(`Queue not found: ${queueId}`);
        }

        // 2. Get available agents for this queue
        const availableAgents = await this.getAvailableAgents(
            queue.hospitalId,
            queue.specialization
        );

        if (availableAgents.length === 0) {
            // No agents available - keep in queue
            return this.createAssignment({
                callId,
                queueId,
                status: CallAssignmentStatus.QUEUED,
            });
        }

        // 3. Select agent based on strategy
        const selectedAgent = this.selectAgent(availableAgents, options);

        // 4. Create assignment
        return this.createAssignment({
            callId,
            queueId,
            agentId: selectedAgent.id,
            status: CallAssignmentStatus.ASSIGNED,
            assignedAt: new Date(),
        });
    }

    /**
     * Get available agents for a specialization
     */
    private async getAvailableAgents(hospitalId: string, specialization: string): Promise<any[]> {
        const activeSessions = await this.prisma.agentSession.findMany({
            where: {
                status: 'ONLINE',
                agent: {
                    hospitalId,
                    status: 'ACTIVE',
                    type: 'HUMAN',
                },
            },
            include: {
                agent: {
                    include: {
                        callAssignments: {
                            where: {
                                status: {
                                    in: ['ASSIGNED', 'ACCEPTED'],
                                },
                            },
                        },
                    },
                },
            },
        });

        // Filter by specialization and capacity
        return activeSessions
            .filter(session => {
                const humanProfile = session.agent.humanProfile as any;
                return humanProfile?.specialization?.includes(specialization);
            })
            .filter(session => {
                const humanProfile = session.agent.humanProfile as any;
                const maxConcurrent = humanProfile?.maxConcurrentCalls || 1;
                const activeCalls = session.agent.callAssignments.length;
                return activeCalls < maxConcurrent;
            })
            .map(session => session.agent);
    }

    /**
     * Select agent based on assignment strategy
     */
    private selectAgent(agents: any[], options: AssignmentOptions): any {
        switch (options.strategy) {
            case 'skill_based':
                return this.selectBySkills(agents);
            case 'round_robin':
                return this.selectRoundRobin(agents);
            case 'least_busy':
                return this.selectLeastBusy(agents);
            case 'priority_based':
                return this.selectByPriority(agents);
            default:
                return agents[0]; // Default to first available
        }
    }

    /**
     * Select agent by skills (best match)
     */
    private selectBySkills(agents: any[]): any {
        // For now, return the first agent
        // In production, you would match agent skills with call requirements
        return agents[0];
    }

    /**
     * Select agent using round-robin
     */
    private selectRoundRobin(agents: any[]): any {
        // Simple round-robin - can be improved with state tracking
        return agents[Math.floor(Math.random() * agents.length)];
    }

    /**
     * Select least busy agent
     */
    private selectLeastBusy(agents: any[]): any {
        return agents.reduce((least, current) => {
            const leastCalls = (least as any).callAssignments?.length || 0;
            const currentCalls = (current as any).callAssignments?.length || 0;
            return currentCalls < leastCalls ? current : least;
        });
    }

    /**
     * Select agent by priority/seniority
     */
    private selectByPriority(agents: any[]): any {
        // For now, return the first agent
        // In production, agents would have priority/seniority levels
        return agents[0];
    }

    /**
     * Create a call assignment
     */
    private async createAssignment(data: {
        callId: string;
        queueId?: string;
        agentId?: string;
        status: CallAssignmentStatus;
        assignedAt?: Date;
    }) {
        return this.prisma.callAssignment.create({
            data,
            include: {
                call: true,
                queue: true,
                agent: true,
            },
        });
    }

    /**
     * Accept an assignment
     */
    async acceptAssignment(assignmentId: string, agentId: string): Promise<any> {
        const assignment = await this.prisma.callAssignment.findUnique({
            where: { id: assignmentId },
        });

        if (!assignment) {
            throw new NotFoundException(`Assignment not found: ${assignmentId}`);
        }

        if (assignment.agentId !== agentId) {
            throw new Error('Agent cannot accept assignment that is not assigned to them');
        }

        return this.prisma.callAssignment.update({
            where: { id: assignmentId },
            data: {
                status: CallAssignmentStatus.ACCEPTED,
                acceptedAt: new Date(),
            },
            include: {
                call: true,
                queue: true,
                agent: true,
            },
        });
    }

    /**
     * Complete an assignment
     */
    async completeAssignment(assignmentId: string) {
        return this.prisma.callAssignment.update({
            where: { id: assignmentId },
            data: {
                status: CallAssignmentStatus.COMPLETED,
                completedAt: new Date(),
            },
        });
    }

    /**
     * Abandon an assignment (caller hung up)
     */
    async abandonAssignment(assignmentId: string) {
        return this.prisma.callAssignment.update({
            where: { id: assignmentId },
            data: {
                status: CallAssignmentStatus.ABANDONED,
            },
        });
    }
}
