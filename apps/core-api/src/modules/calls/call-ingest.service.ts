import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { Logger } from '@wardline/utils';
import { CallProjectionService } from './call-projection.service';
import { CallCutoverMetricsService } from './call-cutover-metrics.service';

type IngestEvent = {
    sequence: number;
    type: string;
    domain?: string;
    actionName?: string;
    createdAt?: string;
    [key: string]: unknown;
};

type TranscriptSegmentInput = {
    speaker: 'CALLER' | 'AGENT' | 'SYSTEM';
    text: string;
    timestamp?: string;
    confidence?: number;
    startTimeMs?: number;
    endTimeMs?: number;
};

type StatePatch = {
    status?: string;
    tag?: string | null;
    turnCount?: number;
    isEmergency?: boolean;
    endedAt?: string | null;
    callerId?: string | null;
    recordingUrl?: string | null;
    sentimentScore?: number | null;
};

@Injectable()
export class CallIngestService {
    private readonly logger = new Logger(CallIngestService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
        private readonly projection: CallProjectionService,
        private readonly metrics: CallCutoverMetricsService,
    ) {}

    async ingestDelta(
        callId: string,
        input: {
            sessionId?: string;
            events?: IngestEvent[];
            transcriptSegments?: TranscriptSegmentInput[];
            statePatch?: StatePatch;
        },
        options?: {
            dualWriteLegacyTurns?: boolean;
        },
    ) {
        const call = await this.prisma.callSession.findUnique({
            where: { id: callId },
            select: {
                id: true,
                businessId: true,
                turnsJson: true,
                projection: {
                    select: {
                        lastSequenceApplied: true,
                    },
                },
            },
        });
        if (!call) {
            throw new NotFoundException(`Call not found: ${callId}`);
        }

        const existingLastSequence = call.projection?.lastSequenceApplied ?? 0;
        let normalizedEvents: IngestEvent[] = [];

        try {
            normalizedEvents = this.normalizeEvents(input.events ?? []);
            const newEvents = normalizedEvents.filter((event) => event.sequence > existingLastSequence);

            this.ensureContiguousSequences(existingLastSequence, newEvents);

            const normalizedSegments = this.normalizeTranscriptSegments(input.transcriptSegments ?? []);
            const statePatch = this.normalizeStatePatch(input.statePatch ?? {});

            await this.prisma.$transaction(async (tx) => {
                if (newEvents.length > 0) {
                    await tx.callEvent.createMany({
                        data: newEvents.map((event) => ({
                            callId,
                            sequence: event.sequence,
                            type: event.type,
                            domain: typeof event.domain === 'string' ? event.domain : undefined,
                            actionName: typeof event.actionName === 'string' ? event.actionName : undefined,
                            createdAt:
                                typeof event.createdAt === 'string' ? new Date(event.createdAt) : new Date(),
                            payload: event as any,
                        })),
                        skipDuplicates: true,
                    });
                }

                if (normalizedSegments.length > 0) {
                    await tx.transcriptSegment.createMany({
                        data: normalizedSegments.map((segment) => ({
                            callId,
                            speaker: segment.speaker,
                            text: segment.text,
                            startTimeMs: segment.startTimeMs,
                            endTimeMs: segment.endTimeMs,
                            confidence: segment.confidence,
                        })),
                    });
                }

                const callUpdate: Record<string, unknown> = { ...statePatch };
                if (options?.dualWriteLegacyTurns && newEvents.length > 0) {
                    const existingTurns = Array.isArray(call.turnsJson) ? [...(call.turnsJson as unknown[])] : [];
                    existingTurns.push(...newEvents.map((event) => ({ ...event })));
                    callUpdate.turnsJson = existingTurns as any;
                }

                if (Object.keys(callUpdate).length > 0) {
                    await tx.callSession.update({
                        where: { id: callId },
                        data: callUpdate as any,
                    });
                }
            });

            await this.rebuildProjection(callId);
            await this.invalidateOperationalCaches(call.businessId, callId);

            return {
                accepted: true,
                callId,
                sessionId: input.sessionId,
                ingestedEventCount: newEvents.length,
                transcriptSegmentCount: normalizedSegments.length,
                lastSequenceApplied:
                    newEvents.length > 0 ? newEvents[newEvents.length - 1].sequence : existingLastSequence,
            };
        } catch (error) {
            this.metrics.recordIngestFailure();
            const message = error instanceof Error ? error.message : String(error);
            const isSequenceGap = message.includes('Event sequence gap detected');
            this.logger.warn('Call ingest failed', {
                callId,
                businessId: call.businessId,
                sessionId: input.sessionId,
                reason: isSequenceGap ? 'sequence_gap' : 'ingest_error',
                error: message,
                existingLastSequence,
                requestedSequences:
                    normalizedEvents.length > 0
                        ? normalizedEvents.map((event) => event.sequence)
                        : (input.events ?? []).map((event) =>
                              typeof event?.sequence === 'number' ? event.sequence : null,
                          ),
            });
            throw error;
        }
    }

    async appendInternalEvent(
        callId: string,
        event: Omit<IngestEvent, 'sequence'>,
        options?: {
            dualWriteLegacyTurns?: boolean;
            statePatch?: StatePatch;
        },
    ) {
        const projection = await this.prisma.callSessionProjection.findUnique({
            where: { callId },
            select: { lastSequenceApplied: true },
        });

        const sequence = (projection?.lastSequenceApplied ?? 0) + 1;
        const nextEvent: IngestEvent = {
            ...(event as IngestEvent),
            sequence,
        };
        return this.ingestDelta(
            callId,
            {
                events: [nextEvent],
                statePatch: options?.statePatch,
            },
            {
                dualWriteLegacyTurns: options?.dualWriteLegacyTurns ?? true,
            },
        );
    }

    async rebuildProjection(callId: string) {
        try {
            const call = await this.prisma.callSession.findUnique({
                where: { id: callId },
                select: {
                    id: true,
                    status: true,
                    tag: true,
                    isEmergency: true,
                    turnsJson: true,
                    voicemails: { select: { id: true, isListened: true } },
                    followUpTasks: {
                        where: { status: { in: ['OPEN', 'IN_PROGRESS'] as any } },
                        select: { id: true, priority: true, status: true, type: true },
                    },
                    callEvents: {
                        orderBy: { sequence: 'asc' },
                        select: { sequence: true, payload: true },
                    },
                },
            });
            if (!call) {
                throw new NotFoundException(`Call not found: ${callId}`);
            }

            const eventPayloads =
                call.callEvents.length > 0
                    ? call.callEvents.map((event) => event.payload)
                    : Array.isArray(call.turnsJson)
                        ? call.turnsJson
                        : [];
            const snapshot = this.projection.buildProjection(call, eventPayloads);

            await this.prisma.callSessionProjection.upsert({
                where: { callId },
                create: {
                    callId,
                    lastSequenceApplied: call.callEvents.at(-1)?.sequence ?? 0,
                    latestDomain: snapshot.latestDomain,
                    resolution: snapshot.operatorSummary.resolution,
                    resolutionLabel: snapshot.operatorSummary.label,
                    operatorNextStep: snapshot.operatorSummary.nextStep,
                    latestRuntimeAction: snapshot.latestRuntimeAction?.actionName,
                    handledLive: snapshot.latestRuntimeAction?.handledLive,
                    fallbackReason: snapshot.latestRuntimeAction?.fallbackReason,
                    transportSummaryJson: snapshot.transportSummary as any,
                    intentTimelineJson: snapshot.intentTimeline as any,
                    operatorSummaryJson: snapshot.operatorSummary as any,
                },
                update: {
                    lastSequenceApplied: call.callEvents.at(-1)?.sequence ?? 0,
                    latestDomain: snapshot.latestDomain,
                    resolution: snapshot.operatorSummary.resolution,
                    resolutionLabel: snapshot.operatorSummary.label,
                    operatorNextStep: snapshot.operatorSummary.nextStep,
                    latestRuntimeAction: snapshot.latestRuntimeAction?.actionName,
                    handledLive: snapshot.latestRuntimeAction?.handledLive,
                    fallbackReason: snapshot.latestRuntimeAction?.fallbackReason,
                    transportSummaryJson: snapshot.transportSummary as any,
                    intentTimelineJson: snapshot.intentTimeline as any,
                    operatorSummaryJson: snapshot.operatorSummary as any,
                },
            });
        } catch (error) {
            this.metrics.recordProjectionRebuildFailure();
            this.logger.error('Call projection rebuild failed', {
                callId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async getCutoverHealthSummary() {
        const [callCount, projectionRowCount] = await Promise.all([
            this.prisma.callSession.count(),
            this.prisma.callSessionProjection.count(),
        ]);

        return {
            callCount,
            projectionRowCount,
            ...this.metrics.snapshot(),
        };
    }

    private normalizeEvents(events: IngestEvent[]) {
        const deduped = new Map<number, IngestEvent>();

        for (const event of events) {
            if (!event || typeof event !== 'object' || typeof event.sequence !== 'number') {
                throw new BadRequestException('Each ingest event must include a numeric sequence.');
            }
            if (event.sequence < 1) {
                throw new BadRequestException('Event sequence must be greater than zero.');
            }
            if (!event.type || typeof event.type !== 'string') {
                throw new BadRequestException('Each ingest event must include a type.');
            }
            if (!deduped.has(event.sequence)) {
                deduped.set(event.sequence, event);
            }
        }

        return [...deduped.values()].sort((left, right) => left.sequence - right.sequence);
    }

    private ensureContiguousSequences(lastSequenceApplied: number, newEvents: IngestEvent[]) {
        if (newEvents.length === 0) {
            return;
        }

        let expected = lastSequenceApplied + 1;
        for (const event of newEvents) {
            if (event.sequence !== expected) {
                throw new BadRequestException(
                    `Event sequence gap detected for call ingest. Expected ${expected}, received ${event.sequence}.`,
                );
            }
            expected += 1;
        }
    }

    private normalizeTranscriptSegments(segments: TranscriptSegmentInput[]) {
        return segments
            .filter((segment) => typeof segment.text === 'string' && segment.text.trim().length > 0)
            .map((segment, index) => {
                const text = segment.text.trim();
                const startTimeMs = typeof segment.startTimeMs === 'number' ? segment.startTimeMs : index * 1000;
                const endTimeMs =
                    typeof segment.endTimeMs === 'number'
                        ? segment.endTimeMs
                        : startTimeMs + Math.max(1000, Math.min(12000, text.length * 45));
                const confidence =
                    typeof segment.confidence === 'number' && !Number.isNaN(segment.confidence)
                        ? segment.confidence
                        : 0.95;

                return {
                    speaker: segment.speaker,
                    text,
                    startTimeMs,
                    endTimeMs,
                    confidence,
                };
            });
    }

    private normalizeStatePatch(statePatch: StatePatch) {
        const patch: StatePatch = {};

        if (typeof statePatch.status === 'string') {
            patch.status = statePatch.status;
        }
        if (statePatch.tag === null || typeof statePatch.tag === 'string') {
            patch.tag = statePatch.tag;
        }
        if (typeof statePatch.turnCount === 'number') {
            patch.turnCount = statePatch.turnCount;
        }
        if (typeof statePatch.isEmergency === 'boolean') {
            patch.isEmergency = statePatch.isEmergency;
        }
        if (statePatch.endedAt === null || typeof statePatch.endedAt === 'string') {
            patch.endedAt = statePatch.endedAt ? new Date(statePatch.endedAt).toISOString() : null;
        }
        if (statePatch.callerId === null || typeof statePatch.callerId === 'string') {
            patch.callerId = statePatch.callerId;
        }
        if (statePatch.recordingUrl === null || typeof statePatch.recordingUrl === 'string') {
            patch.recordingUrl = statePatch.recordingUrl;
        }
        if (
            statePatch.sentimentScore === null ||
            (typeof statePatch.sentimentScore === 'number' && !Number.isNaN(statePatch.sentimentScore))
        ) {
            patch.sentimentScore = statePatch.sentimentScore ?? null;
        }

        if (patch.endedAt === undefined) {
            delete patch.endedAt;
        }

        return patch;
    }

    private async invalidateOperationalCaches(businessId: string, callId?: string) {
        await this.cache.invalidateByTag('calls');
        await this.cache.invalidateByTag('voicemails');
        await this.cache.invalidateByTag('calls:analytics');
        await this.cache.invalidateByTag(`business:${businessId}`);
        if (callId) {
            await this.cache.delete(`calls:detail:${callId}`);
        }
        this.logger.debug('Invalidated call projection caches', { businessId, callId });
    }
}
