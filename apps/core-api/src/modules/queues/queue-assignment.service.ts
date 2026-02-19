import { Injectable, NotFoundException } from '@nestjs/common';
import { CallAssignmentStatus } from '@wardline/db';
import { AssignmentOptions } from '@wardline/types';
import { PrismaService } from '../../prisma/prisma.service';

interface AgentWithAssignments {
    id: string;
    humanProfile: Record<string, any> | null;
    callAssignments: Array<{ id: string }>;
}

@Injectable()
export class QueueAssignmentService {
    /**
     * Round-robin index per queue. Persists across calls within the same
     * service instance lifetime.
     */
    private readonly rrIndex = new Map<string, number>();

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Assign a call to an agent using the specified assignment strategy.
     */
    async assignCallToAgent(
        queueId: string,
        callId: string,
        options: AssignmentOptions = { strategy: 'skill_based' },
    ): Promise<any> {
        const queue = await this.prisma.callQueue.findUnique({
            where: { id: queueId },
        });

        if (!queue) {
            throw new NotFoundException(`Queue not found: ${queueId}`);
        }

        const availableAgents = await this.getAvailableAgents(
            queue.hospitalId,
            queue.specialization,
        );

        if (availableAgents.length === 0) {
            // No agents available – place call in queue
            return this.createAssignment({
                callId,
                queueId,
                status: CallAssignmentStatus.QUEUED,
            });
        }

        const selectedAgent = this.selectAgent(availableAgents, options, queueId);

        return this.createAssignment({
            callId,
            queueId,
            agentId: selectedAgent.id,
            status: CallAssignmentStatus.ASSIGNED,
            assignedAt: new Date(),
        });
    }

    // -------------------------------------------------------------------------
    // Agent availability
    // -------------------------------------------------------------------------

    private async getAvailableAgents(
        hospitalId: string,
        specialization: string,
    ): Promise<AgentWithAssignments[]> {
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
                            where: { status: { in: ['ASSIGNED', 'ACCEPTED'] } },
                        },
                    },
                },
            },
        });

        return activeSessions
            .filter((session) => {
                const profile = session.agent.humanProfile as Record<string, any> | null;
                // Accept if the agent handles this specialization or if they handle 'general'
                const specs: string[] = profile?.specialization ?? ['general'];
                return specs.includes(specialization) || specs.includes('general');
            })
            .filter((session) => {
                const profile = session.agent.humanProfile as Record<string, any> | null;
                const maxConcurrent: number = profile?.maxConcurrentCalls ?? 1;
                return session.agent.callAssignments.length < maxConcurrent;
            })
            .map((session) => ({
                id: session.agent.id,
                humanProfile: session.agent.humanProfile as Record<string, any> | null,
                callAssignments: session.agent.callAssignments,
            }));
    }

    // -------------------------------------------------------------------------
    // Strategy dispatch
    // -------------------------------------------------------------------------

    private selectAgent(
        agents: AgentWithAssignments[],
        options: AssignmentOptions,
        queueId: string,
    ): AgentWithAssignments {
        switch (options.strategy) {
            case 'skill_based':
                return this.selectBySkills(agents, options);
            case 'round_robin':
                return this.selectRoundRobin(agents, queueId);
            case 'least_busy':
                return this.selectLeastBusy(agents);
            case 'priority_based':
                return this.selectByPriority(agents);
            default:
                return agents[0];
        }
    }

    // -------------------------------------------------------------------------
    // Skill-based: score each agent by how many of the required skills they have,
    // break ties by least active calls.
    // -------------------------------------------------------------------------
    private selectBySkills(
        agents: AgentWithAssignments[],
        options: AssignmentOptions,
    ): AgentWithAssignments {
        const required: string[] = (options as any).requiredSkills ?? [];

        if (required.length === 0) {
            return this.selectLeastBusy(agents);
        }

        const scored = agents.map((agent) => {
            const skills: string[] = agent.humanProfile?.skills ?? [];
            const overlap = required.filter((s) => skills.includes(s)).length;
            return { agent, score: overlap, activeCalls: agent.callAssignments.length };
        });

        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.activeCalls - b.activeCalls;
        });

        return scored[0].agent;
    }

    // -------------------------------------------------------------------------
    // Round-robin: cycle through agents in order, one per queue.
    // State survives within the service instance (resets on restart).
    // -------------------------------------------------------------------------
    private selectRoundRobin(
        agents: AgentWithAssignments[],
        queueId: string,
    ): AgentWithAssignments {
        const current = this.rrIndex.get(queueId) ?? 0;
        const next = current % agents.length;
        this.rrIndex.set(queueId, next + 1);
        return agents[next];
    }

    // -------------------------------------------------------------------------
    // Least-busy: agent with fewest active assigned/accepted calls.
    // -------------------------------------------------------------------------
    private selectLeastBusy(agents: AgentWithAssignments[]): AgentWithAssignments {
        return agents.reduce((least, current) =>
            current.callAssignments.length < least.callAssignments.length ? current : least,
        );
    }

    // -------------------------------------------------------------------------
    // Priority-based: agents with the highest `priorityLevel` value go first.
    // Falls back to least-busy on tie.
    // -------------------------------------------------------------------------
    private selectByPriority(agents: AgentWithAssignments[]): AgentWithAssignments {
        const sorted = [...agents].sort((a, b) => {
            const pa: number = a.humanProfile?.priorityLevel ?? 0;
            const pb: number = b.humanProfile?.priorityLevel ?? 0;
            if (pb !== pa) return pb - pa;
            return a.callAssignments.length - b.callAssignments.length;
        });
        return sorted[0];
    }

    // -------------------------------------------------------------------------
    // Persistence helpers
    // -------------------------------------------------------------------------

    private async createAssignment(data: {
        callId: string;
        queueId?: string;
        agentId?: string;
        status: CallAssignmentStatus;
        assignedAt?: Date;
    }) {
        return this.prisma.callAssignment.create({
            data,
            include: { call: true, queue: true, agent: true },
        });
    }

    async acceptAssignment(assignmentId: string, agentId: string): Promise<any> {
        const assignment = await this.prisma.callAssignment.findUnique({
            where: { id: assignmentId },
        });

        if (!assignment) {
            throw new NotFoundException(`Assignment not found: ${assignmentId}`);
        }

        if (assignment.agentId !== agentId) {
            throw new Error('Agent cannot accept an assignment that is not theirs');
        }

        return this.prisma.callAssignment.update({
            where: { id: assignmentId },
            data: { status: CallAssignmentStatus.ACCEPTED, acceptedAt: new Date() },
            include: { call: true, queue: true, agent: true },
        });
    }

    async completeAssignment(assignmentId: string): Promise<any> {
        return this.prisma.callAssignment.update({
            where: { id: assignmentId },
            data: { status: CallAssignmentStatus.COMPLETED, completedAt: new Date() },
        });
    }

    async abandonAssignment(assignmentId: string): Promise<any> {
        return this.prisma.callAssignment.update({
            where: { id: assignmentId },
            data: { status: CallAssignmentStatus.ABANDONED },
        });
    }
}
