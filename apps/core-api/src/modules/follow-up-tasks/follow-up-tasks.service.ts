import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';

type FollowUpTaskType =
    | 'URGENT_CALLBACK'
    | 'VOICEMAIL_REVIEW'
    | 'MANUAL_REVIEW'
    | 'APPOINTMENT_REQUEST'
    | 'REFILL_REQUEST'
    | 'INSURANCE_CHECK'
    | 'BILLING_REQUEST';

type FollowUpTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type FollowUpTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface CreateFollowUpTaskInput {
    businessId: string;
    callId?: string;
    voicemailId?: string;
    type: FollowUpTaskType;
    status?: FollowUpTaskStatus;
    priority?: FollowUpTaskPriority;
    title: string;
    summary: string;
    callerName?: string;
    callerPhone?: string;
    urgencyKeywords?: string[];
    metadata?: Record<string, unknown>;
    dueAt?: Date;
}

const priorityWeight: Record<FollowUpTaskPriority, number> = {
    URGENT: 4,
    HIGH: 3,
    NORMAL: 2,
    LOW: 1,
};

@Injectable()
export class FollowUpTasksService {
    private readonly logger = new Logger(FollowUpTasksService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) {}

    async findAllByBusiness(businessId: string, filters?: {
        type?: string;
        status?: string;
        priority?: string;
        search?: string;
    }): Promise<any[]> {
        const startedAt = Date.now();
        const cacheKey = `follow-up-tasks:${businessId}:${JSON.stringify(filters ?? {})}`;

        const tasks = await this.cache.getOrSet(
            cacheKey,
            async () => {
                const where: Record<string, unknown> = { businessId };

                if (filters?.type) where.type = filters.type.toUpperCase();
                if (filters?.status) where.status = filters.status.toUpperCase();
                if (filters?.priority) where.priority = filters.priority.toUpperCase();
                if (filters?.search) {
                    where.OR = [
                        { title: { contains: filters.search, mode: 'insensitive' } },
                        { summary: { contains: filters.search, mode: 'insensitive' } },
                        { callerName: { contains: filters.search, mode: 'insensitive' } },
                        { callerPhone: { contains: filters.search } },
                    ];
                }

                const tasks = await this.prisma.followUpTask.findMany({
                    where,
                    include: {
                        call: {
                            select: {
                                id: true,
                                tag: true,
                                startedAt: true,
                                isEmergency: true,
                            },
                        },
                        voicemail: {
                            select: {
                                id: true,
                                isListened: true,
                                createdAt: true,
                                recordingUrl: true,
                            },
                        },
                    },
                    orderBy: [{ createdAt: 'desc' }],
                });

                return tasks.sort((left, right) => {
                    const leftWeight = priorityWeight[left.priority as FollowUpTaskPriority] ?? 0;
                    const rightWeight = priorityWeight[right.priority as FollowUpTaskPriority] ?? 0;
                    if (leftWeight !== rightWeight) return rightWeight - leftWeight;
                    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
                });
            },
            {
                ttl: CacheTTL.SHORT,
                tags: [`business:${businessId}`, 'follow-up-tasks'],
            },
        );

        this.logger.info('Dashboard follow-up query completed', {
            businessId,
            durationMs: Date.now() - startedAt,
            count: tasks.length,
            filters: filters ?? {},
        });

        return tasks;
    }

    async create(input: CreateFollowUpTaskInput): Promise<any> {
        const data = {
            businessId: input.businessId,
            callId: input.callId,
            voicemailId: input.voicemailId,
            type: input.type,
            status: input.status ?? 'OPEN',
            priority: input.priority ?? 'NORMAL',
            title: input.title,
            summary: input.summary,
            callerName: input.callerName,
            callerPhone: input.callerPhone,
            urgencyKeywords: input.urgencyKeywords ?? [],
            metadata: input.metadata as any,
            dueAt: input.dueAt,
        };

        const task = input.voicemailId
            ? await this.prisma.followUpTask.upsert({
                where: { voicemailId: input.voicemailId },
                update: data,
                create: data,
            })
            : await this.prisma.followUpTask.create({ data });

        await this.invalidate(input.businessId);
        return task;
    }

    async updateStatus(id: string, status: FollowUpTaskStatus): Promise<any> {
        const existing = await this.prisma.followUpTask.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Follow-up task "${id}" not found`);

        const task = await this.prisma.followUpTask.update({
            where: { id },
            data: {
                status,
                completedAt: status === 'COMPLETED' ? new Date() : null,
            },
        });

        await this.invalidate(existing.businessId);
        return task;
    }

    private async invalidate(businessId: string) {
        await this.cache.invalidateByTag('follow-up-tasks');
        await this.cache.invalidateByTag(`business:${businessId}`);
    }
}
