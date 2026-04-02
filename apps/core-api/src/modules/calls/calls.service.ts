import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';
import { FollowUpTasksService } from '../follow-up-tasks/follow-up-tasks.service';
import { DEFAULT_OPERATING_HOURS, normalizeOperatingHours } from '../businesses/business-hours';
import { buildVoicePolicyV2 } from '../businesses/voice-policy-v2';
import { normalizePracticeSetup } from '../businesses/practice-config';
import { CallProjectionService } from './call-projection.service';
import { CallIngestService } from './call-ingest.service';
import { callsEnableProjectionFallback, getCallCutoverFlagSnapshot } from './call-cutover-flags';
import { CallCutoverMetricsService } from './call-cutover-metrics.service';

@Injectable()
export class CallsService {
    private readonly logger = new Logger(CallsService.name);

    constructor(
        private prisma: PrismaService,
        private cache: CacheService,
        private followUpTasksService: FollowUpTasksService,
        private callProjectionService: CallProjectionService,
        private callIngestService: CallIngestService,
        private callCutoverMetrics: CallCutoverMetricsService,
    ) {}

    // -------------------------------------------------------------------------
    // Call Logs (dashboard)
    // -------------------------------------------------------------------------

    async findAllByBusiness(businessId: string, filters?: any): Promise<any> {
        const startedAt = Date.now();
        const page = parseInt(filters?.page) || 1;
        const pageSize = parseInt(filters?.pageSize) || 20;
        const skip = (page - 1) * pageSize;

        // Dashboard call rows include caller-identifying fields, so they bypass Redis.
        const where: any = { businessId };

        if (filters?.status) where.status = filters.status.toUpperCase();
        if (filters?.tag) where.tag = filters.tag.toUpperCase();
        if (filters?.isEmergency) where.isEmergency = filters.isEmergency === 'true';
        if (filters?.search) {
            where.OR = [
                { phoneNumber: { twilioPhoneNumber: { contains: filters.search } } },
                { caller: { name: { contains: filters.search, mode: 'insensitive' } } },
                { caller: { phone: { contains: filters.search } } },
            ];
        }

        const [calls, total] = await Promise.all([
            this.prisma.callSession.findMany({
                where,
                select: {
                    id: true,
                    businessId: true,
                    twilioCallSid: true,
                    direction: true,
                    status: true,
                    tag: true,
                    isEmergency: true,
                    turnCount: true,
                    startedAt: true,
                    endedAt: true,
                    sentimentScore: true,
                    phoneNumber: { select: { twilioPhoneNumber: true, label: true } },
                    caller: { select: { id: true, name: true, phone: true } },
                    voicemails: { select: { id: true, isListened: true } },
                    followUpTasks: {
                        where: { status: { in: ['OPEN', 'IN_PROGRESS'] as any } },
                        select: { id: true, priority: true, status: true, type: true },
                    },
                    projection: {
                        select: {
                            latestDomain: true,
                            resolution: true,
                            resolutionLabel: true,
                            operatorNextStep: true,
                            latestRuntimeAction: true,
                            handledLive: true,
                            fallbackReason: true,
                        },
                    },
                },
                orderBy: { startedAt: 'desc' },
                skip,
                take: pageSize,
            }),
            this.prisma.callSession.count({ where }),
        ]);

        const projectionFallbackEnabled = callsEnableProjectionFallback();
        const missingProjectionIds = projectionFallbackEnabled
            ? calls.filter((call) => !call.projection).map((call) => call.id)
            : [];
        const legacyTurnsMap = missingProjectionIds.length
            ? new Map(
                  (
                      await this.prisma.callSession.findMany({
                          where: { id: { in: missingProjectionIds } },
                          select: { id: true, turnsJson: true },
                      })
                  ).map((call) => [call.id, call.turnsJson]),
              )
            : new Map<string, unknown>();

        if (missingProjectionIds.length > 0) {
            this.callCutoverMetrics.recordFallbackRead();
            this.logger.warn('Projection fallback used for dashboard call rows', {
                route: 'dashboard_call_rows',
                businessId,
                count: missingProjectionIds.length,
                projectionFallbackEnabled,
            });
        } else if (!projectionFallbackEnabled && calls.some((call) => !call.projection)) {
            this.logger.error('Projection row missing while fallback is disabled for dashboard call rows', {
                route: 'dashboard_call_rows',
                businessId,
                count: calls.filter((call) => !call.projection).length,
                projectionFallbackEnabled,
            });
        }

        const data = calls.map((call) => {
            const fallbackSnapshot = !call.projection
                ? this.callProjectionService.buildProjection(call, legacyTurnsMap.get(call.id) ?? [])
                : undefined;
            const latestRuntimeAction = call.projection?.latestRuntimeAction
                ? {
                      actionName: call.projection.latestRuntimeAction,
                      handledLive: call.projection.handledLive ?? undefined,
                      fallbackReason: call.projection.fallbackReason ?? undefined,
                  }
                : fallbackSnapshot?.latestRuntimeAction;
            const operatorSummary = call.projection
                ? {
                      resolution: call.projection.resolution ?? 'CALL_IN_PROGRESS',
                      label: call.projection.resolutionLabel ?? 'Call in progress',
                      nextStep: call.projection.operatorNextStep ?? 'Review live transport events while the call is still active.',
                  }
                : fallbackSnapshot?.operatorSummary;

            return {
                id: call.id,
                businessId: call.businessId,
                twilioCallSid: call.twilioCallSid,
                direction: call.direction,
                status: call.status,
                tag: call.tag,
                latestDomain: call.projection?.latestDomain ?? fallbackSnapshot?.latestDomain,
                callerPhone: this.canonicalizePhone(call.caller?.phone) ?? call.phoneNumber.twilioPhoneNumber,
                callerName: call.caller?.name,
                lineLabel: call.phoneNumber.label,
                isEmergency: call.isEmergency,
                turnCount: call.turnCount,
                hasVoicemail: call.voicemails.length > 0,
                voicemailListened: call.voicemails.every(v => v.isListened),
                followUpTaskCount: call.followUpTasks.length,
                hasFollowUp: call.followUpTasks.length > 0,
                resolution: operatorSummary?.resolution,
                resolutionLabel: operatorSummary?.label,
                operatorNextStep: operatorSummary?.nextStep,
                latestRuntimeAction: latestRuntimeAction?.actionName,
                handledLive: latestRuntimeAction?.handledLive,
                fallbackReason: latestRuntimeAction?.fallbackReason,
                duration: call.endedAt
                    ? Math.floor((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
                    : 0,
                sentimentScore: call.sentimentScore ? Number(call.sentimentScore) : undefined,
                startedAt: call.startedAt.toISOString(),
                endedAt: call.endedAt?.toISOString(),
            };
        });

        const response = { data, total, page, pageSize };

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

    async findOne(id: string, businessId: string): Promise<any> {
        const startedAt = Date.now();
        // Call detail includes transcript text and caller fields, so it bypasses Redis.
        const call = await this.prisma.callSession.findUnique({
            where: { id, businessId },
            select: {
                id: true,
                businessId: true,
                twilioCallSid: true,
                direction: true,
                status: true,
                tag: true,
                callerId: true,
                isEmergency: true,
                turnCount: true,
                startedAt: true,
                endedAt: true,
                sentimentScore: true,
                recordingUrl: true,
                createdAt: true,
                updatedAt: true,
                phoneNumber: true,
                caller: true,
                transcriptSegments: { orderBy: { startTimeMs: 'asc' } },
                handoffs: true,
                voicemails: true,
                appointments: { select: { id: true, callerName: true, scheduledAt: true, status: true } },
                prescriptionRefills: { select: { id: true, medicationName: true, status: true } },
                insuranceInquiries: { select: { id: true, inquiryType: true, resolved: true } },
                followUpTasks: { orderBy: { createdAt: 'desc' } },
                projection: {
                    select: {
                        latestDomain: true,
                        resolution: true,
                        resolutionLabel: true,
                        operatorNextStep: true,
                        latestRuntimeAction: true,
                        handledLive: true,
                        fallbackReason: true,
                        transportSummaryJson: true,
                        intentTimelineJson: true,
                        operatorSummaryJson: true,
                    },
                },
                callEvents: {
                    where: { type: 'runtime_action_outcome' },
                    orderBy: { sequence: 'desc' },
                    select: { payload: true },
                },
            },
        });
        if (!call) throw new NotFoundException(`Call not found: ${id}`);
        const projectionFallbackEnabled = callsEnableProjectionFallback();
        const fallbackTurns = !call.projection && projectionFallbackEnabled
            ? (
                  await this.prisma.callSession.findUnique({
                      where: { id, businessId },
                      select: { turnsJson: true },
                  })
              )?.turnsJson
            : undefined;
        if (!call.projection && projectionFallbackEnabled) {
            this.callCutoverMetrics.recordFallbackRead();
            this.logger.warn('Projection fallback used for call detail', {
                route: 'call_detail',
                callId: id,
                businessId: call.businessId,
                projectionFallbackEnabled,
            });
        } else if (!call.projection) {
            this.logger.error('Projection row missing while fallback is disabled for call detail', {
                route: 'call_detail',
                callId: id,
                businessId: call.businessId,
                projectionFallbackEnabled,
            });
        }

        const runtimeActionEvents = call.callEvents.length > 0
            ? this.callProjectionService.extractRuntimeActionEvents(call.callEvents.map((event) => event.payload))
            : this.callProjectionService.extractRuntimeActionEvents(fallbackTurns);
        const fallbackSnapshot = !call.projection
            ? this.callProjectionService.buildProjection(call, fallbackTurns ?? [])
            : undefined;
        const transportSummary = call.projection?.transportSummaryJson ?? fallbackSnapshot?.transportSummary;
        const intentTimeline = call.projection?.intentTimelineJson ?? fallbackSnapshot?.intentTimeline;
        const operatorSummary = call.projection?.operatorSummaryJson ?? fallbackSnapshot?.operatorSummary;
        const response = {
            ...call,
            transportSummary,
            runtimeActionEvents,
            intentTimeline,
            operatorSummary,
        };

        this.logger.info('Call detail query completed', {
            callId: id,
            businessId: response.businessId,
            durationMs: Date.now() - startedAt,
        });

        return response;
    }

    private buildPhoneCandidates(phoneNumber?: string) {
        const normalized = String(phoneNumber ?? '').replace(/\D/g, '');
        const last10 = normalized.slice(-10);

        return Array.from(
            new Set(
                [
                    phoneNumber?.trim?.(),
                    normalized,
                    last10,
                    last10 ? `+1${last10}` : null,
                    last10 ? `1${last10}` : null,
                ].filter((value): value is string => Boolean(value)),
            ),
        );
    }

    private canonicalizePhone(phoneNumber?: string) {
        const candidates = this.buildPhoneCandidates(phoneNumber);
        if (candidates.length === 0) {
            return undefined;
        }

        return candidates.find(candidate => candidate.startsWith('+')) ?? candidates[0];
    }

    private async upsertCaller(businessId: string, phoneNumber?: string) {
        const canonicalPhone = this.canonicalizePhone(phoneNumber);
        if (!canonicalPhone) {
            return null;
        }

        return this.prisma.caller.upsert({
            where: {
                businessId_phone: {
                    businessId,
                    phone: canonicalPhone,
                },
            },
            update: {},
            create: {
                businessId,
                phone: canonicalPhone,
            },
        });
    }

    async getCallerContext(businessId: string, callerPhone: string) {
        const candidates = this.buildPhoneCandidates(callerPhone);
        if (candidates.length === 0) {
            return { caller: null, recentCalls: [], knownInsurance: null, knownMedications: [] };
        }
        const caller = await this.prisma.caller.findFirst({
            where: {
                businessId,
                phone: { in: candidates },
            },
            select: { id: true, name: true, phone: true, dob: true },
        });
        if (!caller) {
            return { caller: null, recentCalls: [], knownInsurance: null, knownMedications: [] };
        }
        const recentCalls = await this.prisma.callSession.findMany({
            where: { businessId, callerId: caller.id },
            select: {
                id: true,
                tag: true,
                status: true,
                startedAt: true,
                endedAt: true,
                projection: {
                    select: {
                        latestDomain: true,
                        resolution: true,
                        resolutionLabel: true,
                        operatorNextStep: true,
                        operatorSummaryJson: true,
                    },
                },
            },
            orderBy: { startedAt: 'desc' },
            take: 5,
        });
        const recentRefills = await this.prisma.prescriptionRefill.findMany({
            where: { callerId: caller.id },
            select: { medicationName: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        const recentInsurance = await this.prisma.insuranceInquiry.findMany({
            where: { businessId, callerPhone: { in: candidates } },
            select: { carrierName: true, planName: true, inquiryType: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
        });
        return {
            caller: { id: caller.id, name: caller.name, phone: caller.phone, dob: caller.dob },
            recentCalls: recentCalls.map((c) => ({
                id: c.id,
                tag: c.tag,
                status: c.status,
                startedAt: c.startedAt,
                endedAt: c.endedAt,
                domain: c.projection?.latestDomain ?? null,
                resolution: c.projection?.resolution ?? null,
                resolutionLabel: c.projection?.resolutionLabel ?? null,
                operatorNextStep: c.projection?.operatorNextStep ?? null,
            })),
            knownInsurance: recentInsurance[0]
                ? { carrierName: recentInsurance[0].carrierName, planName: recentInsurance[0].planName }
                : null,
            knownMedications: recentRefills.map((r) => r.medicationName),
        };
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
        // Voicemail records contain caller-identifying data and transcriptions.
        const voicemails = await this.prisma.voicemailRecord.findMany({
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
        });

        this.logger.info('Dashboard voicemail query completed', {
            businessId,
            durationMs: Date.now() - startedAt,
            count: voicemails.length,
            unlistenedOnly,
        });

        return voicemails;
    }

    async markVoicemailListened(id: string, businessId: string): Promise<any> {
        const voicemail = await this.prisma.voicemailRecord.update({
            where: { id, businessId },
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

        await this.callIngestService.rebuildProjection(data.callId);
        await this.invalidateOperationalCaches(data.businessId, data.callId);
        this.logger.info('Voicemail recorded', { callId: data.callId, businessId: data.businessId });
        return voicemail;
    }

    // -------------------------------------------------------------------------
    // Voice runtime endpoints
    // -------------------------------------------------------------------------

    async create(dto: any): Promise<any> {
        const existing = dto.twilioCallSid
            ? await this.prisma.callSession.findUnique({ where: { twilioCallSid: dto.twilioCallSid } })
            : null;
        if (existing) {
            await this.invalidateOperationalCaches(existing.businessId, existing.id);
            return existing;
        }

        const phoneNumber = await this.findPhoneNumberByInboundNumber(dto.toNumber, dto.twilioPhoneNumberSid);

        if (!phoneNumber) {
            throw new Error(`Phone number not found: ${dto.toNumber || dto.twilioPhoneNumberSid}`);
        }

        const caller = await this.upsertCaller(phoneNumber.businessId, dto.fromNumber);

        try {
            const created = await this.prisma.callSession.create({
                data: {
                    businessId: phoneNumber.businessId,
                    phoneNumberId: phoneNumber.id,
                    callerId: caller?.id,
                    twilioCallSid: dto.twilioCallSid,
                    direction: (dto.direction || 'INBOUND') as any,
                    status: 'INITIATED',
                    turnCount: 0,
                },
            });
            await this.callIngestService.rebuildProjection(created.id);
            await this.invalidateOperationalCaches(created.businessId, created.id);
            return created;
        } catch (error: unknown) {
            const prismaError = error as Error & { code?: string };
            if (prismaError.code === 'P2002' && dto.twilioCallSid) {
                const duplicate = await this.prisma.callSession.findUnique({
                    where: { twilioCallSid: dto.twilioCallSid },
                });
                if (duplicate) {
                    await this.invalidateOperationalCaches(duplicate.businessId, duplicate.id);
                    return duplicate;
                }
            }
            throw error;
        }
    }

    async bootstrapVoiceSession(dto: {
        direction: string;
        fromNumber: string;
        toNumber: string;
        twilioCallSid: string;
        twilioPhoneNumberSid?: string;
    }) {
        const existing = dto.twilioCallSid
            ? await this.prisma.callSession.findUnique({
                  where: { twilioCallSid: dto.twilioCallSid },
                  select: { id: true, businessId: true },
              })
            : null;

        const phoneNumber = await this.findPhoneNumberByInboundNumber(dto.toNumber, dto.twilioPhoneNumberSid, {
            includeBusinessContext: true,
        });
        if (!phoneNumber) {
            throw new Error(`Phone number not found: ${dto.toNumber || dto.twilioPhoneNumberSid}`);
        }

        const caller = await this.upsertCaller(phoneNumber.businessId, dto.fromNumber);
        const call =
            existing ??
            (await this.prisma.callSession.create({
                data: {
                    businessId: phoneNumber.businessId,
                    phoneNumberId: phoneNumber.id,
                    callerId: caller?.id,
                    twilioCallSid: dto.twilioCallSid,
                    direction: (dto.direction || 'INBOUND') as any,
                    status: 'INITIATED',
                    turnCount: 0,
                },
                select: { id: true, businessId: true },
            }).catch(async (error: unknown) => {
                const prismaError = error as Error & { code?: string };
                if (prismaError.code === 'P2002' && dto.twilioCallSid) {
                    const duplicate = await this.prisma.callSession.findUnique({
                        where: { twilioCallSid: dto.twilioCallSid },
                        select: { id: true, businessId: true },
                    });
                    if (duplicate) {
                        return duplicate;
                    }
                }
                throw error;
            }));

        const normalizedSettings = phoneNumber.business.settings
            ? this.normalizeBusinessSettingsRecord(phoneNumber.business.settings)
            : this.getDefaultBusinessSettings();
        const integrations = phoneNumber.business.integrations.map((integration) => ({
            id: integration.id,
            category: integration.category,
            vendor: integration.vendor,
            status: integration.status,
            capabilities: integration.capabilities,
            lastHealthCheckAt: integration.lastHealthCheckAt,
        }));
        const settingsUpdatedAt = phoneNumber.business.settings?.updatedAt
            ? phoneNumber.business.settings.updatedAt.toISOString()
            : 'no-settings';

        await this.callIngestService.rebuildProjection(call.id);
        await this.invalidateOperationalCaches(call.businessId, call.id);

        return {
            callId: call.id,
            runtimeConfigVersion: `${phoneNumber.business.updatedAt.toISOString()}:${settingsUpdatedAt}`,
            business: {
                id: phoneNumber.business.id,
                name: phoneNumber.business.name,
                slug: phoneNumber.business.slug,
                timeZone: phoneNumber.business.timeZone,
                status: phoneNumber.business.status,
            },
            settings: normalizedSettings,
            phoneNumbers: phoneNumber.business.phoneNumbers.map((entry) => ({
                id: entry.id,
                label: entry.label,
                twilioPhoneNumber: entry.twilioPhoneNumber,
            })),
            integrations,
            connectedIntegrationCategories: integrations
                .filter((integration) => integration.status === 'CONNECTED')
                .map((integration) => integration.category),
            voicePolicyV2: buildVoicePolicyV2({
                settings: normalizedSettings,
                integrations,
            }),
        };
    }

    async ingestCall(
        callId: string,
        input: {
            sessionId?: string;
            events?: Array<Record<string, unknown>>;
            transcriptSegments?: Array<Record<string, unknown>>;
            statePatch?: Record<string, unknown>;
        },
    ) {
        return this.callIngestService.ingestDelta(
            callId,
            {
                sessionId: input.sessionId,
                events: (input.events ?? []) as any,
                transcriptSegments: (input.transcriptSegments ?? []) as any,
                statePatch: (input.statePatch ?? {}) as any,
            },
            {
                dualWriteLegacyTurns: false,
            },
        );
    }

    async getCutoverHealthSummary() {
        return {
            ...(await this.callIngestService.getCutoverHealthSummary()),
            ...getCallCutoverFlagSnapshot(),
        };
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
        if (
            dto.turnsJson !== undefined ||
            dto.status !== undefined ||
            dto.tag !== undefined ||
            dto.isEmergency !== undefined
        ) {
            await this.callIngestService.rebuildProjection(id);
        }
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
        await this.callIngestService.rebuildProjection(id);
        return { success: true, segmentsAdded: segments.length };
    }

    private async findPhoneNumberByInboundNumber(
        toNumber: string,
        twilioPhoneNumberSid?: string,
        options?: { includeBusinessContext?: boolean },
    ): Promise<any> {
        const candidates = this.buildPhoneCandidates(toNumber);

        return this.prisma.phoneNumber.findFirst({
            where: {
                OR: [
                    ...(twilioPhoneNumberSid ? [{ twilioSid: twilioPhoneNumberSid }] : []),
                    ...candidates.flatMap((candidate) => [
                        { twilioPhoneNumber: candidate },
                        { twilioPhoneNumber: { endsWith: candidate } },
                    ]),
                ],
            },
            ...(options?.includeBusinessContext
                ? {
                      include: {
                          business: {
                              include: {
                                  settings: true,
                                  integrations: {
                                      select: {
                                          id: true,
                                          category: true,
                                          vendor: true,
                                          status: true,
                                          capabilities: true,
                                          lastHealthCheckAt: true,
                                      },
                                      orderBy: { category: 'asc' },
                                  },
                                  phoneNumbers: {
                                      select: {
                                          id: true,
                                          label: true,
                                          twilioPhoneNumber: true,
                                      },
                                      orderBy: { label: 'asc' },
                                  },
                              },
                          },
                      },
                  }
                : {}),
        });
    }

    private getDefaultBusinessSettings() {
        const practiceSetup = normalizePracticeSetup();

        return {
            recordingDefault: 'ON',
            transcriptRetentionDays: 30,
            operatingHours: DEFAULT_OPERATING_HOURS,
            enabledActions: practiceSetup.enabledActions,
            afterHoursPolicy: practiceSetup.afterHoursPolicy,
            refillPolicy: practiceSetup.refillPolicy,
            billingPolicy: practiceSetup.billingPolicy,
            insurancePolicy: practiceSetup.insurancePolicy,
            knowledgeConfig: practiceSetup.knowledgeConfig,
            escalationConfig: practiceSetup.escalationConfig,
            outOfScopeKeywords: [] as string[],
            emergencyKeywords: [] as string[],
            daytimeHandoffPolicy: practiceSetup.daytimeHandoffPolicy,
        };
    }

    private normalizeBusinessSettingsRecord(settings: any) {
        const practiceSetup = normalizePracticeSetup(settings);

        return {
            ...settings,
            operatingHours: normalizeOperatingHours(settings.operatingHours) as any,
            enabledActions: practiceSetup.enabledActions,
            afterHoursPolicy: practiceSetup.afterHoursPolicy,
            refillPolicy: practiceSetup.refillPolicy,
            billingPolicy: practiceSetup.billingPolicy,
            insurancePolicy: practiceSetup.insurancePolicy,
            knowledgeConfig: practiceSetup.knowledgeConfig,
            escalationConfig: practiceSetup.escalationConfig,
            daytimeHandoffPolicy: practiceSetup.daytimeHandoffPolicy,
        };
    }

    private async invalidateOperationalCaches(_businessId: string, callId?: string) {
        await this.cache.invalidateByTag('calls');
        await this.cache.invalidateByTag('voicemails');
        await this.cache.invalidateByTag('calls:analytics');
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
