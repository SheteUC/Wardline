import { Injectable, NotFoundException } from '@nestjs/common';
import { CallQueue } from '@wardline/db';
import { CreateQueueDto, UpdateQueueDto } from './dto/queue.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QueuesService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new call queue
     */
    async create(hospitalId: string, dto: CreateQueueDto): Promise<CallQueue> {
        return this.prisma.callQueue.create({
            data: {
                hospitalId,
                name: dto.name,
                specialization: dto.specialization,
                priority: dto.priority || 0,
                maxWaitTime: dto.maxWaitTime,
            },
        });
    }

    /**
     * Find all queues for a hospital
     */
    async findAll(
        hospitalId: string,
        filters?: { specialization?: string; page?: number; limit?: number }
    ) {
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const skip = (page - 1) * limit;

        const where = {
            hospitalId,
            ...(filters?.specialization && { specialization: filters.specialization }),
        };

        const [queues, total] = await Promise.all([
            this.prisma.callQueue.findMany({
                where,
                skip,
                take: limit,
                orderBy: { priority: 'desc' },
                include: {
                    _count: {
                        select: {
                            queuedCalls: true,
                        },
                    },
                },
            }),
            this.prisma.callQueue.count({ where }),
        ]);

        return {
            data: queues,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find a specific queue by ID
     */
    async findOne(id: string): Promise<CallQueue> {
        const queue = await this.prisma.callQueue.findUnique({
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
                        queuedCalls: true,
                    },
                },
            },
        });

        if (!queue) {
            throw new NotFoundException(`Queue not found: ${id}`);
        }

        return queue;
    }

    /**
     * Update a queue
     */
    async update(id: string, dto: UpdateQueueDto): Promise<CallQueue> {
        try {
            return await this.prisma.callQueue.update({
                where: { id },
                data: {
                    ...(dto.name && { name: dto.name }),
                    ...(dto.specialization && { specialization: dto.specialization }),
                    ...(dto.priority !== undefined && { priority: dto.priority }),
                    ...(dto.maxWaitTime !== undefined && { maxWaitTime: dto.maxWaitTime }),
                },
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Queue not found: ${id}`);
            }
            throw error;
        }
    }

    /**
     * Delete a queue
     */
    async delete(id: string): Promise<void> {
        try {
            await this.prisma.callQueue.delete({
                where: { id },
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Queue not found: ${id}`);
            }
            throw error;
        }
    }

    /**
     * Get queue metrics (depth, wait time, SLA)
     */
    async getMetrics(id: string, startDate?: Date, endDate?: Date) {
        const queue = await this.findOne(id);

        // Get assignments in queue
        const queuedAssignments = await this.prisma.callAssignment.findMany({
            where: {
                queueId: id,
                status: 'QUEUED',
            },
            include: {
                call: {
                    select: {
                        startedAt: true,
                    },
                },
            },
        });

        // Calculate current queue depth
        const queueDepth = queuedAssignments.length;

        // Calculate average wait time for completed assignments
        const where: any = {
            queueId: id,
            status: 'COMPLETED',
        };

        if (startDate) {
            where.completedAt = { gte: startDate };
        }
        if (endDate) {
            where.completedAt = { ...where.completedAt, lte: endDate };
        }

        const completedAssignments = await this.prisma.callAssignment.findMany({
            where,
        });

        // Calculate average wait time (time from queued to accepted)
        const waitTimes = completedAssignments
            .filter(a => a.acceptedAt && a.createdAt)
            .map(a => {
                const wait = new Date(a.acceptedAt!).getTime() - new Date(a.createdAt).getTime();
                return wait / 1000; // Convert to seconds
            });

        const avgWaitTime = waitTimes.length > 0
            ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
            : 0;

        // Calculate SLA compliance (if maxWaitTime is set)
        let slaCompliance = null;
        if (queue.maxWaitTime) {
            const withinSLA = waitTimes.filter(time => time <= queue.maxWaitTime!).length;
            slaCompliance = (withinSLA / waitTimes.length) * 100;
        }

        // Calculate average handle time (accepted to completed)
        const handleTimes = completedAssignments
            .filter(a => a.acceptedAt && a.completedAt)
            .map(a => {
                const handle = new Date(a.completedAt!).getTime() - new Date(a.acceptedAt!).getTime();
                return handle / 1000;
            });

        const avgHandleTime = handleTimes.length > 0
            ? handleTimes.reduce((sum, time) => sum + time, 0) / handleTimes.length
            : 0;

        return {
            queueId: id,
            queueName: queue.name,
            queueDepth,
            avgWaitTime: Math.round(avgWaitTime),
            avgHandleTime: Math.round(avgHandleTime),
            slaCompliance: slaCompliance ? Math.round(slaCompliance) : null,
            totalCompleted: completedAssignments.length,
            currentWaiting: queuedAssignments,
        };
    }

    /**
     * Get all assignments for a hospital (for agent dashboard)
     */
    async getAssignments(
        hospitalId: string,
        filters?: {
            status?: string;
            agentId?: string;
            queueId?: string;
            page?: number;
            limit?: number;
        }
    ) {
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {
            call: {
                hospitalId,
            },
            ...(filters?.status && { status: filters.status }),
            ...(filters?.agentId && { agentId: filters.agentId }),
            ...(filters?.queueId && { queueId: filters.queueId }),
        };

        const [assignments, total] = await Promise.all([
            this.prisma.callAssignment.findMany({
                where,
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
                    queue: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true,
                        },
                    },
                    agent: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                        },
                    },
                },
            }),
            this.prisma.callAssignment.count({ where }),
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
}
