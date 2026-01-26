import { Injectable, NotFoundException } from '@nestjs/common';
import { Agent, AgentType, AgentStatus, AgentSessionStatus } from '@wardline/db';
import { CreateAgentDto, UpdateAgentDto } from './dto/agent.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AgentsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new agent (AI or Human)
     */
    async create(hospitalId: string, dto: CreateAgentDto): Promise<Agent> {
        // Validate that AI agents have aiConfig and Human agents have humanProfile
        if (dto.type === AgentType.AI && !dto.aiConfig) {
            throw new Error('AI agents must have aiConfig');
        }
        if (dto.type === AgentType.HUMAN && !dto.humanProfile) {
            throw new Error('Human agents must have humanProfile');
        }

        return this.prisma.agent.create({
            data: {
                hospitalId,
                type: dto.type,
                name: dto.name,
                description: dto.description,
                aiConfig: dto.aiConfig as any,
                humanProfile: dto.humanProfile as any,
                status: AgentStatus.ACTIVE,
            },
        });
    }

    /**
     * Find all agents for a hospital
     */
    async findAll(
        hospitalId: string,
        filters?: { type?: AgentType; status?: AgentStatus; page?: number; limit?: number }
    ): Promise<any> {
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const skip = (page - 1) * limit;

        const where = {
            hospitalId,
            ...(filters?.type && { type: filters.type }),
            ...(filters?.status && { status: filters.status }),
        };

        const [agents, total] = await Promise.all([
            this.prisma.agent.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: {
                            callAssignments: true,
                            agentSessions: true,
                        },
                    },
                },
            }),
            this.prisma.agent.count({ where }),
        ]);

        return {
            data: agents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find a specific agent by ID
     */
    async findOne(id: string): Promise<Agent> {
        const agent = await this.prisma.agent.findUnique({
            where: { id },
            include: {
                hospital: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                _count: {
                    select: {
                        callAssignments: true,
                        agentSessions: true,
                    },
                },
            },
        });

        if (!agent) {
            throw new NotFoundException(`Agent not found: ${id}`);
        }

        return agent;
    }

    /**
     * Update an agent
     */
    async update(id: string, dto: UpdateAgentDto): Promise<Agent> {
        try {
            return await this.prisma.agent.update({
                where: { id },
                data: {
                    ...(dto.name && { name: dto.name }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.status && { status: dto.status }),
                    ...(dto.aiConfig && { aiConfig: dto.aiConfig as any }),
                    ...(dto.humanProfile && { humanProfile: dto.humanProfile as any }),
                },
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Agent not found: ${id}`);
            }
            throw error;
        }
    }

    /**
     * Delete an agent
     */
    async delete(id: string): Promise<void> {
        try {
            await this.prisma.agent.delete({
                where: { id },
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Agent not found: ${id}`);
            }
            throw error;
        }
    }

    /**
     * Update agent status (ACTIVE, INACTIVE, PAUSED)
     */
    async updateStatus(id: string, status: AgentStatus): Promise<Agent> {
        return this.update(id, { status: status as any });
    }

    /**
     * Get agent availability (for human agents)
     */
    async getAvailability(id: string) {
        const agent = await this.findOne(id);

        if (agent.type !== AgentType.HUMAN) {
            throw new Error('Only human agents have availability schedules');
        }

        return (agent.humanProfile as any)?.availability || null;
    }

    /**
     * Update agent availability (for human agents)
     */
    async updateAvailability(id: string, availability: any): Promise<Agent> {
        const agent = await this.findOne(id);

        if (agent.type !== AgentType.HUMAN) {
            throw new Error('Only human agents have availability schedules');
        }

        const humanProfile = agent.humanProfile as any;
        return this.update(id, {
            humanProfile: {
                ...humanProfile,
                availability,
            },
        });
    }

    /**
     * Get agent performance metrics
     */
    async getMetrics(id: string, startDate?: Date, endDate?: Date) {
        const agent = await this.findOne(id);

        const where: any = {
            agentId: id,
            status: 'COMPLETED',
        };

        if (startDate) {
            where.completedAt = { gte: startDate };
        }
        if (endDate) {
            where.completedAt = { ...where.completedAt, lte: endDate };
        }

        const [
            totalCalls,
            completedAssignments,
            sessions,
        ] = await Promise.all([
            // Total calls handled
            this.prisma.callAssignment.count({ where }),

            // Get completed assignments to calculate average handle time
            this.prisma.callAssignment.findMany({
                where,
                select: {
                    acceptedAt: true,
                    completedAt: true,
                },
            }),

            // Agent sessions
            this.prisma.agentSession.findMany({
                where: {
                    agentId: id,
                    ...(startDate && { startedAt: { gte: startDate } }),
                    ...(endDate && { startedAt: { lte: endDate } }),
                },
                orderBy: { startedAt: 'desc' },
                take: 10,
            }),
        ]);

        // Calculate average handle time in seconds
        let avgHandleTimeSeconds = 0;
        if (completedAssignments.length > 0) {
            const totalHandleTime = completedAssignments.reduce((sum, assignment) => {
                if (assignment.acceptedAt && assignment.completedAt) {
                    return sum + (assignment.completedAt.getTime() - assignment.acceptedAt.getTime());
                }
                return sum;
            }, 0);
            avgHandleTimeSeconds = totalHandleTime / completedAssignments.length / 1000;
        }

        return {
            agentId: id,
            agentName: agent.name,
            totalCalls,
            avgHandleTime: avgHandleTimeSeconds,
            sessions,
        };
    }

    /**
     * Get agent call history
     */
    async getCallHistory(id: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [assignments, total] = await Promise.all([
            this.prisma.callAssignment.findMany({
                where: { agentId: id },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    call: {
                        select: {
                            id: true,
                            twilioCallSid: true,
                            direction: true,
                            status: true,
                            startedAt: true,
                            endedAt: true,
                            isEmergency: true,
                            tag: true,
                        },
                    },
                },
            }),
            this.prisma.callAssignment.count({ where: { agentId: id } }),
        ]);

        return {
            data: assignments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get available agents for a queue
     */
    async getAvailableAgents(hospitalId: string, specialization?: string): Promise<any[]> {
        // Get agents that are ACTIVE and have an ONLINE session
        const activeSessions = await this.prisma.agentSession.findMany({
            where: {
                status: AgentSessionStatus.ONLINE,
                agent: {
                    hospitalId,
                    status: AgentStatus.ACTIVE,
                    type: AgentType.HUMAN,
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

        // Filter by specialization if provided
        const availableAgents = activeSessions
            .filter(session => {
                const humanProfile = session.agent.humanProfile as any;
                if (!specialization) return true;
                return humanProfile?.specialization?.includes(specialization);
            })
            .filter(session => {
                // Check if agent is below max concurrent calls
                const humanProfile = session.agent.humanProfile as any;
                const maxConcurrent = humanProfile?.maxConcurrentCalls || 1;
                const activeCalls = session.agent.callAssignments.length;
                return activeCalls < maxConcurrent;
            })
            .map(session => session.agent);

        return availableAgents;
    }

    /**
     * Create or update agent session (for presence tracking)
     */
    async updateAgentSession(agentId: string, status: AgentSessionStatus) {
        // Find active session for this agent
        const activeSession = await this.prisma.agentSession.findFirst({
            where: {
                agentId,
                endedAt: null,
            },
        });

        if (status === AgentSessionStatus.OFFLINE) {
            // End the active session
            if (activeSession) {
                return this.prisma.agentSession.update({
                    where: { id: activeSession.id },
                    data: {
                        status: AgentSessionStatus.OFFLINE,
                        endedAt: new Date(),
                    },
                });
            }
            return null;
        }

        if (activeSession) {
            // Update existing session
            return this.prisma.agentSession.update({
                where: { id: activeSession.id },
                data: { status },
            });
        }

        // Create new session
        return this.prisma.agentSession.create({
            data: {
                agentId,
                status,
            },
        });
    }

    /**
     * Get current agent session
     */
    async getCurrentSession(agentId: string) {
        return this.prisma.agentSession.findFirst({
            where: {
                agentId,
                endedAt: null,
            },
        });
    }
}
