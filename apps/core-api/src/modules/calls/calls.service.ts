import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheKeys, CacheTTL } from '../../cache/cache.service';
import * as crypto from 'crypto';

@Injectable()
export class CallsService {
    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
    ) {}

    /**
     * Get paginated list of calls for a hospital with optional filters.
     * Uses caching for repeat queries.
     */
    async findAllByHospital(hospitalId: string, filters?: any): Promise<any> {
        const page = parseInt(filters?.page) || 1;
        const pageSize = parseInt(filters?.pageSize) || 20;
        const skip = (page - 1) * pageSize;

        // Create cache key based on all filters
        const filterHash = crypto
            .createHash('md5')
            .update(JSON.stringify({ ...filters, page, pageSize }))
            .digest('hex')
            .substring(0, 8);

        const cacheKey = CacheKeys.callsList(hospitalId, filterHash);

        // Try cache first
        return this.cache.getOrSet(
            cacheKey,
            async () => {
                // Build where clause
                const where: any = { hospitalId };

                if (filters?.status) {
                    // Convert to uppercase to match CallStatus enum
                    where.status = filters.status.toUpperCase();
                }

                if (filters?.search) {
                    // Search in phone number or patient name
                    where.OR = [
                        { phoneNumber: { twilioPhoneNumber: { contains: filters.search } } },
                        { patient: { name: { contains: filters.search, mode: 'insensitive' } } },
                    ];
                }

                // Use Promise.all for parallel queries
                const [calls, total] = await Promise.all([
                    this.prisma.callSession.findMany({
                        where,
                        include: {
                            phoneNumber: {
                                select: { twilioPhoneNumber: true },
                            },
                            intent: {
                                select: { displayName: true },
                            },
                            patient: {
                                select: { id: true, externalId: true, name: true },
                            },
                        },
                        orderBy: { startedAt: 'desc' },
                        skip,
                        take: pageSize,
                    }),
                    this.prisma.callSession.count({ where }),
                ]);

                // Transform to match frontend expectations
                const transformedCalls = calls.map((call) => ({
                    id: call.id,
                    hospitalId: call.hospitalId,
                    twilioCallSid: call.twilioCallSid,
                    direction: call.direction,
                    status: call.status,
                    callerPhone: call.phoneNumber.twilioPhoneNumber,
                    callerName: call.patient?.name,
                    duration: call.endedAt
                        ? Math.floor((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
                        : 0,
                    recordingConsent: call.recordingConsent,
                    wasEmergency: call.isEmergency,
                    detectedIntent: call.intent?.displayName,
                    sentiment: call.sentimentOverallScore
                        ? (Number(call.sentimentOverallScore) >= 0.6 ? 'positive' : Number(call.sentimentOverallScore) >= 0.4 ? 'neutral' : 'negative')
                        : undefined,
                    sentimentScore: call.sentimentOverallScore ? Number(call.sentimentOverallScore) : undefined,
                    createdAt: call.createdAt.toISOString(),
                    updatedAt: call.updatedAt.toISOString(),
                }));

                return {
                    data: transformedCalls,
                    total,
                    page,
                    pageSize,
                };
            },
            {
                ttl: CacheTTL.SHORT, // 30 seconds for call lists
                tags: [`hospital:${hospitalId}`, 'calls'],
            }
        );
    }

    /**
     * Get a single call with full details including transcript.
     * Uses caching for repeat views.
     */
    async findOne(id: string): Promise<any> {
        const cacheKey = CacheKeys.callDetail(id);

        return this.cache.getOrSet(
            cacheKey,
            async () => {
                return this.prisma.callSession.findUnique({
                    where: { id },
                    include: {
                        phoneNumber: true,
                        intent: true,
                        patient: true,
                        transcriptSegments: {
                            orderBy: { startTimeMs: 'asc' },
                        },
                        sentimentSnapshots: {
                            orderBy: { offsetMs: 'asc' },
                        },
                        handoffs: true,
                    },
                });
            },
            {
                ttl: CacheTTL.MEDIUM, // 2 minutes for call details
                tags: ['calls', `call:${id}`],
            }
        );
    }

    /**
     * Get analytics for a hospital using optimized database aggregations.
     * Much faster than fetching all calls and processing in memory.
     */
    async getAnalytics(hospitalId: string, startDate: Date, endDate: Date): Promise<any> {
        const cacheKey = CacheKeys.callAnalytics(
            hospitalId,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        return this.cache.getOrSet(
            cacheKey,
            async () => {
                const baseWhere = {
                    hospitalId,
                    startedAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                };

                // Run all aggregations in parallel
                const [
                    totalCount,
                    statusCounts,
                    emergencyCount,
                    activeEmergencyCount,
                    avgDuration,
                    intentCounts,
                    hourlyVolume,
                    sentimentCounts,
                ] = await Promise.all([
                    // Total calls
                    this.prisma.callSession.count({ where: baseWhere }),

                    // Calls by status
                    this.prisma.callSession.groupBy({
                        by: ['status'],
                        where: baseWhere,
                        _count: { id: true },
                    }),

                    // Emergency calls total
                    this.prisma.callSession.count({
                        where: { ...baseWhere, isEmergency: true },
                    }),

                    // Active emergencies
                    this.prisma.callSession.count({
                        where: { ...baseWhere, isEmergency: true, status: 'ONGOING' },
                    }),

                    // Average duration (using raw SQL for efficiency)
                    this.prisma.$queryRaw<[{ avg_duration: number | null }]>`
                        SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration
                        FROM call_sessions
                        WHERE hospital_id = ${hospitalId}
                          AND started_at >= ${startDate}
                          AND started_at <= ${endDate}
                          AND ended_at IS NOT NULL
                          AND status = 'COMPLETED'
                    `,

                    // Intent breakdown
                    this.prisma.$queryRaw<Array<{ display_name: string; count: bigint }>>`
                        SELECT i.display_name, COUNT(cs.id)::bigint as count
                        FROM call_sessions cs
                        LEFT JOIN intents i ON cs.intent_id = i.id
                        WHERE cs.hospital_id = ${hospitalId}
                          AND cs.started_at >= ${startDate}
                          AND cs.started_at <= ${endDate}
                          AND i.display_name IS NOT NULL
                        GROUP BY i.display_name
                        ORDER BY count DESC
                        LIMIT 10
                    `,

                    // Hourly volume
                    this.prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
                        SELECT EXTRACT(HOUR FROM started_at)::int as hour, COUNT(*)::bigint as count
                        FROM call_sessions
                        WHERE hospital_id = ${hospitalId}
                          AND started_at >= ${startDate}
                          AND started_at <= ${endDate}
                        GROUP BY hour
                        ORDER BY hour
                    `,

                    // Sentiment breakdown by day
                    this.prisma.$queryRaw<Array<{ date: Date; positive: bigint; neutral: bigint; negative: bigint }>>`
                        SELECT 
                            DATE(started_at) as date,
                            COUNT(*) FILTER (WHERE sentiment_overall_score >= 0.6)::bigint as positive,
                            COUNT(*) FILTER (WHERE sentiment_overall_score >= 0.4 AND sentiment_overall_score < 0.6)::bigint as neutral,
                            COUNT(*) FILTER (WHERE sentiment_overall_score < 0.4 AND sentiment_overall_score IS NOT NULL)::bigint as negative
                        FROM call_sessions
                        WHERE hospital_id = ${hospitalId}
                          AND started_at >= ${startDate}
                          AND started_at <= ${endDate}
                        GROUP BY DATE(started_at)
                        ORDER BY date
                    `,
                ]);

                // Process status counts
                const statusMap = new Map(statusCounts.map(s => [s.status, s._count.id]));
                const completedCalls = statusMap.get('COMPLETED') || 0;
                const abandonedCalls = statusMap.get('ABANDONED') || 0;

                // Format intent breakdown
                const intentBreakdown = intentCounts.map((item) => ({
                    intent: item.display_name,
                    count: Number(item.count),
                    percentage: totalCount > 0 ? (Number(item.count) / totalCount) * 100 : 0,
                }));

                // Format call volume by hour
                const callVolumeByHour = hourlyVolume.map((item) => ({
                    hour: `${String(item.hour).padStart(2, '0')}:00`,
                    calls: Number(item.count),
                }));

                // Format sentiment trend
                const sentimentTrend = sentimentCounts.map((item) => ({
                    date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0],
                    positive: Number(item.positive),
                    neutral: Number(item.neutral),
                    negative: Number(item.negative),
                }));

                return {
                    totalCalls: totalCount,
                    completedCalls,
                    abandonedCalls,
                    averageDuration: Math.floor(avgDuration[0]?.avg_duration || 0),
                    averageHoldTime: 0, // TODO: Implement if we track hold time
                    abandonRate: totalCount > 0 ? (abandonedCalls / totalCount) * 100 : 0,
                    emergencyFlags: emergencyCount,
                    activeEmergencies: activeEmergencyCount,
                    callVolumeByHour,
                    intentBreakdown,
                    sentimentTrend,
                };
            },
            {
                ttl: CacheTTL.ANALYTICS, // 1 minute for analytics
                tags: [`hospital:${hospitalId}`, 'analytics'],
            }
        );
    }

    /**
     * Create a new call session.
     * Invalidates related caches.
     */
    async create(data: {
        hospitalId: string;
        direction: string;
        fromNumber: string;
        toNumber: string;
        twilioCallSid: string;
    }): Promise<any> {
        // Look up phone number by Twilio number
        const phoneNumber = await this.prisma.phoneNumber.findUnique({
            where: { twilioPhoneNumber: data.toNumber },
        });

        if (!phoneNumber) {
            throw new Error(`Phone number not found: ${data.toNumber}`);
        }

        const call = await this.prisma.callSession.create({
            data: {
                hospitalId: data.hospitalId,
                phoneNumberId: phoneNumber.id,
                twilioCallSid: data.twilioCallSid,
                direction: data.direction as any,
                status: 'INITIATED',
                startedAt: new Date(),
            },
        });

        // Invalidate call list caches for this hospital
        this.cache.invalidateByTag(`hospital:${data.hospitalId}`);

        return call;
    }

    /**
     * Update an existing call session.
     * Invalidates related caches.
     */
    async update(id: string, data: {
        status?: string;
        duration?: number;
        recordingConsent?: string;
        detectedIntent?: string;
        isEmergency?: boolean;
        tag?: string;
    }): Promise<any> {
        const updateData: any = {};

        if (data.status) {
            updateData.status = data.status;
            // If completed or abandoned, set endedAt
            if (data.status === 'COMPLETED' || data.status === 'ABANDONED' || data.status === 'FAILED') {
                updateData.endedAt = new Date();
            }
        }

        if (data.recordingConsent) {
            updateData.recordingConsent = data.recordingConsent;
        }

        if (data.isEmergency !== undefined) {
            updateData.isEmergency = data.isEmergency;
        }

        if (data.tag) {
            updateData.tag = data.tag;
        }

        // Look up intent by key if provided
        if (data.detectedIntent) {
            const call = await this.prisma.callSession.findUnique({
                where: { id },
                select: { hospitalId: true },
            });

            if (call) {
                const intent = await this.prisma.intent.findFirst({
                    where: {
                        hospitalId: call.hospitalId,
                        key: data.detectedIntent,
                    },
                });

                if (intent) {
                    updateData.intentId = intent.id;
                }

                // Invalidate caches
                this.cache.invalidateByTag(`hospital:${call.hospitalId}`);
            }
        }

        const result = await this.prisma.callSession.update({
            where: { id },
            data: updateData,
        });

        // Invalidate call detail cache
        this.cache.delete(CacheKeys.callDetail(id));

        return result;
    }

    /**
     * Save transcript segments for a call
     */
    async saveTranscript(callId: string, segments: Array<{
        speaker: string;
        text: string;
        timestamp: Date;
        confidence?: number;
    }>): Promise<any> {
        // Get call start time to calculate offsets
        const call = await this.prisma.callSession.findUnique({
            where: { id: callId },
            select: { startedAt: true },
        });

        if (!call) {
            throw new Error(`Call not found: ${callId}`);
        }

        const callStart = call.startedAt.getTime();

        // Create transcript segments
        const transcriptData = segments.map((segment) => {
            const segmentTime = new Date(segment.timestamp).getTime();
            const startTimeMs = Math.max(0, segmentTime - callStart);
            // Estimate end time as start + 5 seconds or next segment
            const endTimeMs = startTimeMs + 5000;

            return {
                callId,
                speaker: segment.speaker as any,
                text: segment.text,
                startTimeMs,
                endTimeMs,
                confidence: segment.confidence ?? 0.95,
            };
        });

        const result = await this.prisma.transcriptSegment.createMany({
            data: transcriptData,
        });

        // Invalidate call detail cache since transcript changed
        this.cache.delete(CacheKeys.callDetail(callId));

        return result;
    }

    /**
     * Create a handoff record for escalation
     */
    async createHandoff(data: {
        callId: string;
        hospitalId: string;
        intentKey: string;
        tag: string;
        summary: string;
        fields: any;
    }): Promise<any> {
        // Create handoff payload
        const payload = {
            intentKey: data.intentKey,
            tag: data.tag,
            summary: data.summary,
            fields: data.fields,
            createdAt: new Date().toISOString(),
        };

        // Create handoff record
        const handoff = await this.prisma.handoff.create({
            data: {
                callId: data.callId,
                payload,
            },
        });

        // Update call with handoff info
        await this.prisma.callSession.update({
            where: { id: data.callId },
            data: {
                tag: data.tag as any,
                handoffTarget: data.intentKey,
                handoffReason: data.summary,
            },
        });

        // Invalidate caches
        this.cache.delete(CacheKeys.callDetail(data.callId));
        this.cache.invalidateByTag(`hospital:${data.hospitalId}`);

        return handoff;
    }
}
