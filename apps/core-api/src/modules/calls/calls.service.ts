import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';
import * as crypto from 'crypto';
import { FollowUpTasksService } from '../follow-up-tasks/follow-up-tasks.service';

@Injectable()
export class CallsService {
    private readonly logger = new Logger(CallsService.name);

    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
        private followUpTasksService: FollowUpTasksService,
    ) {}

    // -------------------------------------------------------------------------
    // Call Logs (dashboard)
    // -------------------------------------------------------------------------

    async findAllByBusiness(businessId: string, filters?: any): Promise<any> {
        const startedAt = Date.now();
        const page = parseInt(filters?.page) || 1;
        const pageSize = parseInt(filters?.pageSize) || 20;
        const skip = (page - 1) * pageSize;

        const filterHash = crypto
            .createHash('md5')
            .update(JSON.stringify({ ...filters, page, pageSize }))
            .digest('hex')
            .substring(0, 8);

        const response = await this.cache.getOrSet(
            `calls:list:${businessId}:${filterHash}`,
            async () => {
                const where: any = { businessId };

                if (filters?.status) where.status = filters.status.toUpperCase();
                if (filters?.tag) where.tag = filters.tag.toUpperCase();
                if (filters?.isEmergency) where.isEmergency = filters.isEmergency === 'true';
                if (filters?.search) {
                    where.OR = [
                        { phoneNumber: { twilioPhoneNumber: { contains: filters.search } } },
                        { caller: { name: { contains: filters.search, mode: 'insensitive' } } },
                    ];
                }

                const [calls, total] = await Promise.all([
                    this.prisma.callSession.findMany({
                        where,
                        include: {
                            phoneNumber: { select: { twilioPhoneNumber: true, label: true } },
                            caller: { select: { id: true, name: true, phone: true } },
                            voicemails: { select: { id: true, isListened: true } },
                            followUpTasks: {
                                where: { status: { in: ['OPEN', 'IN_PROGRESS'] as any } },
                                select: { id: true, priority: true, status: true },
                            },
                        },
                        orderBy: { startedAt: 'desc' },
                        skip,
                        take: pageSize,
                    }),
                    this.prisma.callSession.count({ where }),
                ]);

                const data = calls.map(call => ({
                    id: call.id,
                    businessId: call.businessId,
                    twilioCallSid: call.twilioCallSid,
                    direction: call.direction,
                    status: call.status,
                    tag: call.tag,
                    callerPhone: call.caller?.phone ?? call.phoneNumber.twilioPhoneNumber,
                    callerName: call.caller?.name,
                    lineLabel: call.phoneNumber.label,
                    isEmergency: call.isEmergency,
                    turnCount: call.turnCount,
                    hasVoicemail: call.voicemails.length > 0,
                    voicemailListened: call.voicemails.every(v => v.isListened),
                    followUpTaskCount: call.followUpTasks.length,
                    duration: call.endedAt
                        ? Math.floor((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
                        : 0,
                    sentimentScore: call.sentimentScore ? Number(call.sentimentScore) : undefined,
                    startedAt: call.startedAt.toISOString(),
                    endedAt: call.endedAt?.toISOString(),
                }));

                return { data, total, page, pageSize };
            },
            { ttl: CacheTTL.SHORT, tags: [`business:${businessId}`, 'calls'] },
        );

        this.logger.info('Dashboard calls query completed', {
            businessId,
            durationMs: Date.now() - startedAt,
            page,
            pageSize,
            total: response.total,
            filters: filters ?? {},
        });

        return response;
    }

    async findOne(id: string): Promise<any> {
        const startedAt = Date.now();
        const call = await this.cache.getOrSet(
            `calls:detail:${id}`,
            async () => {
                const call = await this.prisma.callSession.findUnique({
                    where: { id },
                    include: {
                        phoneNumber: true,
                        caller: true,
                        transcriptSegments: { orderBy: { startTimeMs: 'asc' } },
                        handoffs: true,
                        voicemails: true,
                        appointments: { select: { id: true, callerName: true, scheduledAt: true, status: true } },
                        prescriptionRefills: { select: { id: true, medicationName: true, status: true } },
                        insuranceInquiries: { select: { id: true, inquiryType: true, resolved: true } },
                        followUpTasks: true,
                    },
                });
                if (!call) throw new NotFoundException(`Call not found: ${id}`);
                return call;
            },
            { ttl: CacheTTL.MEDIUM, tags: ['calls', `call:${id}`] },
        );

        this.logger.info('Call detail query completed', {
            callId: id,
            businessId: call.businessId,
            durationMs: Date.now() - startedAt,
        });

        return call;
    }

    async findByTwilioSid(twilioCallSid: string): Promise<any[]> {
        return this.prisma.callSession.findMany({
            where: { twilioCallSid },
            include: { phoneNumber: { select: { twilioPhoneNumber: true } } },
            orderBy: { startedAt: 'desc' },
            take: 1,
        });
    }

    async getAnalytics(businessId: string, startDate: Date, endDate: Date): Promise<any> {
        const startedAt = Date.now();
        const dateKey = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
        const analytics = await this.cache.getOrSet(
            `calls:analytics:${businessId}:${dateKey}`,
            async () => {
                const baseWhere = { businessId, startedAt: { gte: startDate, lte: endDate } };

                const [totalCount, statusCounts, emergencyCount, tagCounts, voicemailCount] = await Promise.all([
                    this.prisma.callSession.count({ where: baseWhere }),
                    this.prisma.callSession.groupBy({ by: ['status'], where: baseWhere, _count: { id: true } }),
                    this.prisma.callSession.count({ where: { ...baseWhere, isEmergency: true } }),
                    this.prisma.callSession.groupBy({ by: ['tag'], where: baseWhere, _count: { id: true } }),
                    this.prisma.voicemailRecord.count({ where: { businessId, createdAt: { gte: startDate, lte: endDate } } }),
                ]);

                const avgDurationRaw = await this.prisma.$queryRaw<[{ avg_duration: number | null }]>`
                    SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration
                    FROM call_sessions
                    WHERE business_id = ${businessId}
                      AND started_at >= ${startDate}
                      AND started_at <= ${endDate}
                      AND ended_at IS NOT NULL
                      AND status = 'COMPLETED'
                `;

                const statusMap = new Map(statusCounts.map(s => [s.status, s._count.id]));
                const tagMap = new Map(tagCounts.map(t => [t.tag, t._count.id]));

                return {
                    totalCalls: totalCount,
                    completedCalls: statusMap.get('COMPLETED') || 0,
                    abandonedCalls: statusMap.get('ABANDONED') || 0,
                    emergencyCalls: emergencyCount,
                    voicemailCount,
                    avgDurationSeconds: Math.round(avgDurationRaw[0]?.avg_duration || 0),
                    callsByTag: Object.fromEntries(tagMap),
                };
            },
            { ttl: CacheTTL.MEDIUM, tags: [`business:${businessId}`, 'calls:analytics'] },
        );

        this.logger.info('Dashboard call analytics query completed', {
            businessId,
            durationMs: Date.now() - startedAt,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        });

        return analytics;
    }

    // -------------------------------------------------------------------------
    // Voicemail records
    // -------------------------------------------------------------------------

    async getVoicemails(businessId: string, unlistenedOnly = false): Promise<any[]> {
        const startedAt = Date.now();
        const voicemails = await this.cache.getOrSet(
            `voicemails:${businessId}:${unlistenedOnly ? 'unlistened' : 'all'}`,
            async () =>
                this.prisma.voicemailRecord.findMany({
                    where: {
                        businessId,
                        ...(unlistenedOnly && { isListened: false }),
                    },
                    include: {
                        call: { select: { tag: true, startedAt: true, isEmergency: true } },
                        followUpTask: {
                            select: {
                                id: true,
                                type: true,
                                priority: true,
                                status: true,
                                metadata: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
            { ttl: CacheTTL.SHORT, tags: [`business:${businessId}`, 'voicemails'] },
        );

        this.logger.info('Dashboard voicemail query completed', {
            businessId,
            durationMs: Date.now() - startedAt,
            count: voicemails.length,
            unlistenedOnly,
        });

        return voicemails;
    }

    async markVoicemailListened(id: string): Promise<any> {
        const voicemail = await this.prisma.voicemailRecord.update({
            where: { id },
            data: { isListened: true },
        });
        await this.invalidateOperationalCaches(voicemail.businessId, voicemail.callId);
        return voicemail;
    }

    async createVoicemail(data: {
        callId: string;
        businessId: string;
        callerPhone: string;
        callerName?: string;
        recordingUrl: string;
        transcription?: string;
        context: string;
        createFollowUp?: boolean;
        isUrgent?: boolean;
        urgencyKeywords?: string[];
    }): Promise<any> {
        const voicemail = await this.prisma.voicemailRecord.create({
            data: {
                callId: data.callId,
                businessId: data.businessId,
                callerPhone: data.callerPhone,
                callerName: data.callerName,
                recordingUrl: data.recordingUrl,
                transcription: data.transcription,
                context: data.context,
            },
        });

        // Tag the call session as voicemail
        await this.prisma.callSession.update({
            where: { id: data.callId },
            data: { tag: 'VOICEMAIL' },
        }).catch(() => { /* call may not exist yet */ });

        if (data.createFollowUp || data.isUrgent) {
            await this.followUpTasksService.create({
                businessId: data.businessId,
                callId: data.callId,
                voicemailId: voicemail.id,
                type: data.isUrgent ? 'URGENT_CALLBACK' : 'VOICEMAIL_REVIEW',
                priority: data.isUrgent ? 'URGENT' : 'NORMAL',
                title: data.isUrgent ? 'Urgent after-hours voicemail' : 'Voicemail follow-up',
                summary: data.context,
                callerName: data.callerName,
                callerPhone: data.callerPhone,
                urgencyKeywords: data.urgencyKeywords ?? [],
                metadata: {
                    source: 'voicemail',
                    transcription: data.transcription,
                },
            });
        }

        await this.invalidateOperationalCaches(data.businessId, data.callId);
        this.logger.info('Voicemail recorded', { callId: data.callId, businessId: data.businessId });
        return voicemail;
    }

    // -------------------------------------------------------------------------
    // Voice orchestrator endpoints
    // -------------------------------------------------------------------------

    async create(dto: any): Promise<any> {
        const phoneNumber = await this.prisma.phoneNumber.findFirst({
            where: {
                OR: [
                    { twilioSid: dto.twilioPhoneNumberSid },
                    { twilioPhoneNumber: dto.toNumber },
                ],
            },
        });

        if (!phoneNumber) {
            throw new Error(`Phone number not found: ${dto.toNumber || dto.twilioPhoneNumberSid}`);
        }

        return this.prisma.callSession.create({
            data: {
                businessId: phoneNumber.businessId,
                phoneNumberId: phoneNumber.id,
                twilioCallSid: dto.twilioCallSid,
                direction: dto.direction || 'INBOUND',
                status: 'INITIATED',
                turnCount: 0,
            },
        });
    }

    async update(id: string, dto: any): Promise<any> {
        const data: any = {};
        if (dto.status !== undefined) data.status = dto.status;
        if (dto.tag !== undefined) data.tag = dto.tag;
        if (dto.isEmergency !== undefined) data.isEmergency = dto.isEmergency;
        if (dto.endedAt !== undefined) data.endedAt = dto.endedAt ? new Date(dto.endedAt) : null;
        if (dto.recordingUrl !== undefined) data.recordingUrl = dto.recordingUrl;
        if (dto.sentimentScore !== undefined) data.sentimentScore = dto.sentimentScore;
        if (dto.turnCount !== undefined) data.turnCount = dto.turnCount;
        if (dto.turnsJson !== undefined) data.turnsJson = dto.turnsJson;
        if (dto.callerId !== undefined) data.callerId = dto.callerId;

        await this.cache.delete(`calls:detail:${id}`);
        const updated = await this.prisma.callSession.update({ where: { id }, data });
        await this.invalidateOperationalCaches(updated.businessId, id);
        return updated;
    }

    async saveTranscript(id: string, segments: any[]): Promise<any> {
        const call = await this.prisma.callSession.findUnique({ where: { id } });
        if (!call) throw new Error(`Call not found: ${id}`);

        await this.prisma.transcriptSegment.createMany({
            data: segments.map((seg, idx) => ({
                callId: id,
                speaker: seg.speaker,
                text: seg.text,
                startTimeMs: seg.startTimeMs ?? idx * 1000,
                endTimeMs: seg.endTimeMs ?? (idx + 1) * 1000,
                confidence: seg.confidence ?? 0.95,
            })),
        });

        await this.cache.delete(`calls:detail:${id}`);
        return { success: true, segmentsAdded: segments.length };
    }

    private async invalidateOperationalCaches(businessId: string, callId?: string) {
        await this.cache.invalidateByTag(`business:${businessId}`);
        await this.cache.invalidateByTag('calls');
        await this.cache.invalidateByTag('voicemails');
        if (callId) {
            await this.cache.delete(`calls:detail:${callId}`);
        }
    }

    async createHandoff(dto: any): Promise<any> {
        return this.prisma.handoff.create({
            data: {
                callId: dto.callId,
                payload: dto.payload,
            },
        });
    }
}
