import { Injectable } from '@nestjs/common';

type RuntimeActionEvent = {
    type: 'runtime_action_outcome';
    actionName: string;
    integrationCategory?: string;
    integrationVendor?: string;
    domain?: string;
    handledLive: boolean;
    followUpTaskId?: string;
    fallbackReason?: string;
    operatorSummary?: string;
    callerName?: string;
    callerPhone?: string;
    data: Record<string, unknown>;
    latencyMs?: number;
    createdAt: string;
};

type OperatorSummary = {
    resolution: string;
    label: string;
    nextStep: string;
    actionName?: string;
    handledLive?: boolean;
    followUpTaskId?: string;
    fallbackReason?: string;
};

@Injectable()
export class CallProjectionService {
    extractRuntimeActionEvents(turnsJson: unknown): RuntimeActionEvent[] {
        if (!Array.isArray(turnsJson)) {
            return [];
        }

        return turnsJson
            .filter((entry): entry is Record<string, any> =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                entry.type === 'runtime_action_outcome' &&
                typeof entry.actionName === 'string',
            )
            .map((entry) => ({
                type: 'runtime_action_outcome' as const,
                actionName: entry.actionName,
                integrationCategory: entry.integrationCategory,
                integrationVendor: entry.integrationVendor,
                domain: typeof entry.domain === 'string' ? entry.domain : undefined,
                handledLive: Boolean(entry.handledLive),
                followUpTaskId:
                    typeof entry.followUpTaskId === 'string' ? entry.followUpTaskId : undefined,
                fallbackReason:
                    typeof entry.fallbackReason === 'string' ? entry.fallbackReason : undefined,
                operatorSummary:
                    typeof entry.operatorSummary === 'string' ? entry.operatorSummary : undefined,
                callerName: typeof entry.callerName === 'string' ? entry.callerName : undefined,
                callerPhone: typeof entry.callerPhone === 'string' ? entry.callerPhone : undefined,
                data:
                    entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)
                        ? entry.data
                        : {},
                latencyMs:
                    entry.data &&
                    typeof entry.data === 'object' &&
                    !Array.isArray(entry.data) &&
                    typeof entry.data.latencyMs === 'number'
                        ? entry.data.latencyMs
                        : undefined,
                createdAt:
                    typeof entry.createdAt === 'string'
                        ? entry.createdAt
                        : new Date().toISOString(),
            }))
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    extractTransportSummary(turnsJson: unknown) {
        if (!Array.isArray(turnsJson)) {
            return undefined;
        }

        const bootstrapEvent = turnsJson.find(
            (entry): entry is Record<string, any> =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                entry.type === 'session_bootstrap' &&
                entry.data &&
                typeof entry.data === 'object' &&
                entry.data.transport &&
                typeof entry.data.transport === 'object',
        );

        if (!bootstrapEvent) {
            return undefined;
        }

        const transport = bootstrapEvent.data.transport as Record<string, unknown>;
        const transportEvents = turnsJson.filter(
            (entry): entry is Record<string, any> =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                entry.type === 'transport_event',
        );
        const latestProviderEvent = [...transportEvents]
            .reverse()
            .find(
                (entry) =>
                    typeof entry.data?.providerSessionId === 'string' ||
                    typeof entry.data?.deepgramRequestId === 'string' ||
                    typeof entry.data?.twilioStreamSid === 'string',
            );
        const transcriptEventCount = turnsJson.filter(
            (entry): entry is Record<string, any> =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                (entry.type === 'transcript_partial' ||
                    (entry.type === 'transport_event' && entry.actionName === 'deepgram_transcript')),
        ).length;

        return {
            runtime: typeof transport.runtime === 'string' ? transport.runtime : 'voice-runtime-v2',
            transport: typeof transport.transport === 'string' ? transport.transport : 'livekit',
            twilioCallSid: typeof transport.twilioCallSid === 'string' ? transport.twilioCallSid : undefined,
            roomName: typeof transport.roomName === 'string' ? transport.roomName : undefined,
            participantIdentity:
                typeof transport.participantIdentity === 'string'
                    ? transport.participantIdentity
                    : undefined,
            livekitUrl: typeof transport.livekitUrl === 'string' ? transport.livekitUrl : undefined,
            twilioMediaStreamUrl:
                typeof transport.twilioMediaStreamUrl === 'string'
                    ? transport.twilioMediaStreamUrl
                    : undefined,
            twilioStreamSid:
                typeof latestProviderEvent?.data?.twilioStreamSid === 'string'
                    ? latestProviderEvent.data.twilioStreamSid
                    : typeof transport.twilioStreamSid === 'string'
                        ? transport.twilioStreamSid
                        : undefined,
            providerSessionId:
                typeof latestProviderEvent?.data?.providerSessionId === 'string'
                    ? latestProviderEvent.data.providerSessionId
                    : typeof latestProviderEvent?.data?.deepgramRequestId === 'string'
                        ? latestProviderEvent.data.deepgramRequestId
                        : typeof transport.providerSessionId === 'string'
                            ? transport.providerSessionId
                            : undefined,
            deepgramRequestId:
                typeof latestProviderEvent?.data?.deepgramRequestId === 'string'
                    ? latestProviderEvent.data.deepgramRequestId
                    : typeof transport.deepgramRequestId === 'string'
                        ? transport.deepgramRequestId
                        : undefined,
            transcriptEventCount,
        };
    }

    extractIntentTimeline(turnsJson: unknown) {
        if (!Array.isArray(turnsJson)) {
            return undefined;
        }

        type IntentTimelineEntry = {
            intentId: string;
            domain?: string;
            summary: string;
            status: string;
            detectedOrder?: number;
            selectedOrder?: number;
            actionName?: string;
            handledLive?: boolean;
            followUpTaskId?: string;
            fallbackReason?: string;
            transferStatus?: string;
            transferTargetLabel?: string;
            createdAt?: string;
        };

        const timeline = new Map<string, IntentTimelineEntry>();

        const intentStatusByEvent: Record<string, string> = {
            intent_detected: 'detected',
            intent_selected: 'active',
            intent_resumed: 'active',
            intent_paused: 'paused',
            intent_resolved: 'resolved',
            intent_cancelled: 'cancelled',
            intent_dropped: 'dropped',
        };

        for (const entry of turnsJson) {
            if (!entry || typeof entry !== 'object') {
                continue;
            }

            if (typeof entry.type === 'string' && entry.type.startsWith('intent_')) {
                const data =
                    entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)
                        ? entry.data
                        : {};
                const intentId = typeof data.intentId === 'string' ? data.intentId : undefined;
                if (!intentId) {
                    continue;
                }

                const existing: IntentTimelineEntry = timeline.get(intentId) ?? {
                    intentId,
                    domain: typeof entry.domain === 'string' ? entry.domain : undefined,
                    summary:
                        typeof data.summary === 'string'
                            ? data.summary
                            : typeof entry.operatorSummary === 'string'
                                ? entry.operatorSummary
                                : 'Call issue',
                    status: typeof data.status === 'string' ? data.status : 'detected',
                    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : undefined,
                };

                existing.domain =
                    typeof entry.domain === 'string'
                        ? entry.domain
                        : typeof existing.domain === 'string'
                            ? existing.domain
                            : undefined;
                existing.summary =
                    typeof data.summary === 'string' && data.summary.length > 0
                        ? data.summary
                        : existing.summary;
                existing.status = intentStatusByEvent[entry.type] ?? existing.status;
                existing.detectedOrder =
                    typeof data.detectedOrder === 'number' ? data.detectedOrder : existing.detectedOrder;
                existing.selectedOrder =
                    typeof data.selectedOrder === 'number' ? data.selectedOrder : existing.selectedOrder;
                existing.followUpTaskId =
                    typeof data.followUpTaskId === 'string' ? data.followUpTaskId : existing.followUpTaskId;
                existing.fallbackReason =
                    typeof data.fallbackReason === 'string' ? data.fallbackReason : existing.fallbackReason;
                existing.actionName =
                    typeof data.actionName === 'string' ? data.actionName : existing.actionName;
                timeline.set(intentId, existing);
                continue;
            }

            if (entry.type !== 'runtime_action_outcome') {
                if (
                    entry.type !== 'handoff_transfer_requested' &&
                    entry.type !== 'handoff_transfer_connected' &&
                    entry.type !== 'handoff_transfer_failed' &&
                    entry.type !== 'handoff_callback_requested'
                ) {
                    continue;
                }

                const data =
                    entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data) ? entry.data : {};
                const intentId = typeof data.intentId === 'string' ? data.intentId : undefined;
                if (!intentId) {
                    continue;
                }

                const existing: IntentTimelineEntry = timeline.get(intentId) ?? {
                    intentId,
                    domain: typeof entry.domain === 'string' ? entry.domain : undefined,
                    summary:
                        typeof data.reasonSummary === 'string'
                            ? data.reasonSummary
                            : typeof data.summary === 'string'
                                ? data.summary
                                : typeof entry.operatorSummary === 'string'
                                    ? entry.operatorSummary
                                    : 'Call issue',
                    status: 'active',
                    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : undefined,
                };

                existing.domain =
                    typeof entry.domain === 'string'
                        ? entry.domain
                        : typeof existing.domain === 'string'
                            ? existing.domain
                            : undefined;
                existing.summary =
                    typeof data.reasonSummary === 'string' && data.reasonSummary.length > 0
                        ? data.reasonSummary
                        : typeof existing.summary === 'string'
                            ? existing.summary
                            : 'Call issue';
                existing.actionName =
                    entry.type === 'handoff_callback_requested'
                        ? 'manual-follow-up'
                        : typeof entry.actionName === 'string'
                            ? entry.actionName
                            : existing.actionName;
                existing.transferStatus =
                    entry.type === 'handoff_transfer_requested'
                        ? 'requested'
                        : entry.type === 'handoff_transfer_connected'
                            ? 'connected'
                            : entry.type === 'handoff_transfer_failed'
                                ? 'failed'
                                : 'callback_requested';
                existing.transferTargetLabel =
                    typeof data.transferTargetLabel === 'string'
                        ? data.transferTargetLabel
                        : existing.transferTargetLabel;
                existing.handledLive =
                    entry.type === 'handoff_transfer_connected'
                        ? true
                        : entry.type === 'handoff_transfer_failed'
                            ? false
                            : existing.handledLive;
                existing.followUpTaskId =
                    typeof entry.followUpTaskId === 'string'
                        ? entry.followUpTaskId
                        : typeof data.followUpTaskId === 'string'
                            ? data.followUpTaskId
                            : existing.followUpTaskId;
                existing.fallbackReason =
                    typeof entry.fallbackReason === 'string'
                        ? entry.fallbackReason
                        : typeof data.fallbackReason === 'string'
                            ? data.fallbackReason
                            : existing.fallbackReason;
                if (entry.type === 'handoff_callback_requested') {
                    existing.status = 'resolved';
                }
                timeline.set(intentId, existing);
                continue;
            }

            const data =
                entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data) ? entry.data : {};
            const intentId = typeof data.intentId === 'string' ? data.intentId : undefined;
            if (!intentId) {
                continue;
            }

            const existing: IntentTimelineEntry = timeline.get(intentId) ?? {
                intentId,
                domain: typeof entry.domain === 'string' ? entry.domain : undefined,
                summary:
                    typeof data.callerRequest === 'string'
                        ? data.callerRequest
                        : typeof entry.operatorSummary === 'string'
                            ? entry.operatorSummary
                            : 'Call issue',
                status: entry.handledLive ? 'resolved' : 'resolved',
                createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : undefined,
            };

            existing.domain =
                typeof entry.domain === 'string'
                    ? entry.domain
                    : typeof existing.domain === 'string'
                        ? existing.domain
                        : undefined;
            existing.actionName =
                typeof entry.actionName === 'string' ? entry.actionName : existing.actionName;
            existing.handledLive = Boolean(entry.handledLive);
            existing.followUpTaskId =
                typeof entry.followUpTaskId === 'string' ? entry.followUpTaskId : existing.followUpTaskId;
            existing.fallbackReason =
                typeof entry.fallbackReason === 'string' ? entry.fallbackReason : existing.fallbackReason;
            existing.status = 'resolved';
            timeline.set(intentId, existing);
        }

        if (timeline.size === 0) {
            return undefined;
        }

        return [...timeline.values()].sort((left, right) => {
            if ((left.detectedOrder ?? 0) !== (right.detectedOrder ?? 0)) {
                return (left.detectedOrder ?? 0) - (right.detectedOrder ?? 0);
            }
            return (left.createdAt ?? '').localeCompare(right.createdAt ?? '');
        });
    }

    extractLatestDomain(turnsJson: unknown, tag?: string | null) {
        if (Array.isArray(turnsJson)) {
            const latestDomainEvent = [...turnsJson].reverse().find(
                (entry): entry is Record<string, any> =>
                    Boolean(entry) &&
                    typeof entry === 'object' &&
                    typeof entry.domain === 'string',
            );
            if (typeof latestDomainEvent?.domain === 'string') {
                return latestDomainEvent.domain;
            }
        }

        return this.tagToDomain(tag);
    }

    buildOperatorSummary(
        call: {
            isEmergency?: boolean;
            tag?: string | null;
            status?: string | null;
            voicemails?: Array<unknown>;
            followUpTasks?: Array<{
                id: string;
                status: string;
                priority: string;
                type: string;
            }>;
        },
        runtimeActionEvents: RuntimeActionEvent[],
        turnsJson?: unknown,
    ): OperatorSummary {
        const openFollowUpTask = (call.followUpTasks ?? []).find(
            (task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS',
        );
        const latestRuntimeAction = runtimeActionEvents[0];

        if (call.isEmergency || call.tag === 'EMERGENCY') {
            return {
                resolution: 'EMERGENCY_ESCALATION',
                label: 'Emergency escalation',
                nextStep: openFollowUpTask
                    ? 'Review the urgent task and contact the caller immediately if staff intervention is still needed.'
                    : 'Confirm the caller received emergency guidance and staff awareness where appropriate.',
            };
        }

        if (latestRuntimeAction) {
            if (latestRuntimeAction.handledLive) {
                return {
                    resolution: 'LIVE_RESOLVED',
                    label: latestRuntimeAction.operatorSummary || 'Handled live',
                    nextStep: openFollowUpTask
                        ? 'A follow-up task is still open. Review it and close it if the live action fully resolved the call.'
                        : 'No staff follow-up is currently required unless the caller contacts the practice again.',
                    actionName: latestRuntimeAction.actionName,
                    handledLive: true,
                };
            }

            return {
                resolution: 'FOLLOW_UP_REQUIRED',
                label: latestRuntimeAction.operatorSummary || 'Staff follow-up required',
                nextStep: openFollowUpTask
                    ? `Open the ${this.humanizeTaskType(openFollowUpTask.type)} task and complete the requested staff follow-up.`
                    : 'Review the call and create or complete the appropriate staff follow-up.',
                actionName: latestRuntimeAction.actionName,
                handledLive: false,
                followUpTaskId: latestRuntimeAction.followUpTaskId,
                fallbackReason: latestRuntimeAction.fallbackReason,
            };
        }

        if ((call.voicemails ?? []).length > 0 || call.tag === 'VOICEMAIL') {
            return {
                resolution: 'VOICEMAIL_CAPTURED',
                label: 'Voicemail captured',
                nextStep: openFollowUpTask
                    ? 'Review the voicemail and the linked follow-up task.'
                    : 'Review the voicemail recording and transcript for next steps.',
            };
        }

        if (call.tag === 'HUMAN_TRANSFER') {
            return {
                resolution: 'HUMAN_ESCALATION',
                label: 'Escalated to staff',
                nextStep: openFollowUpTask
                    ? 'Review the linked follow-up task for the escalation outcome.'
                    : 'Review the call context to confirm the caller reached the right staff workflow.',
            };
        }

        if (call.status === 'ABANDONED') {
            return {
                resolution: 'CALL_ABANDONED',
                label: 'Caller disconnected before completion',
                nextStep: openFollowUpTask
                    ? 'Review the open follow-up task and confirm whether staff outreach is still needed.'
                    : 'No completed request was captured before the caller disconnected.',
            };
        }

        if (call.status === 'FAILED') {
            return {
                resolution: 'CALL_FAILED',
                label: 'Call failed before voice session initialized',
                nextStep: openFollowUpTask
                    ? 'Review the open follow-up task and the provider logs before retrying.'
                    : 'Review the bootstrap or provider logs before attempting another live call.',
            };
        }

        const connectedToTransport = this.hasTransportEvent(
            turnsJson,
            'twilio_stream_connected',
            'twilio_stream_started',
            'deepgram_connected',
        );

        return {
            resolution:
                call.status === 'COMPLETED'
                    ? 'CALL_COMPLETED_NO_ACTION'
                    : call.status === 'INITIATED'
                        ? 'CALL_INITIATED'
                        : 'CALL_IN_PROGRESS',
            label:
                call.status === 'COMPLETED'
                    ? connectedToTransport
                        ? 'Call connected, no request completed'
                        : 'Call completed without action'
                    : call.status === 'INITIATED'
                        ? 'Voice session starting'
                        : 'Call in progress',
            nextStep: openFollowUpTask
                ? 'A follow-up task is open for this call.'
                : call.status === 'COMPLETED'
                    ? 'Review the transport events and transcript if the caller needs additional follow-up.'
                    : 'Review live transport events while the call is still active.',
        };
    }

    buildProjection(
        call: {
            status?: string | null;
            tag?: string | null;
            isEmergency?: boolean;
            voicemails?: Array<unknown>;
            followUpTasks?: Array<{
                id: string;
                status: string;
                priority: string;
                type: string;
            }>;
        },
        turnsJson: unknown,
    ) {
        const runtimeActionEvents = this.extractRuntimeActionEvents(turnsJson);
        const operatorSummary = this.buildOperatorSummary(call, runtimeActionEvents, turnsJson);
        const transportSummary = this.extractTransportSummary(turnsJson);
        const intentTimeline = this.extractIntentTimeline(turnsJson);
        const latestRuntimeAction = runtimeActionEvents[0];

        return {
            latestDomain: this.extractLatestDomain(turnsJson, call.tag),
            operatorSummary,
            transportSummary,
            intentTimeline,
            latestRuntimeAction,
        };
    }

    private hasTransportEvent(turnsJson: unknown, ...eventNames: string[]) {
        if (!Array.isArray(turnsJson)) {
            return false;
        }

        return turnsJson.some(
            (entry): entry is Record<string, any> =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                entry.type === 'transport_event' &&
                (eventNames.length === 0 || eventNames.includes(entry.actionName)),
        );
    }

    private humanizeTaskType(type: string) {
        return type.toLowerCase().replaceAll('_', ' ');
    }

    private tagToDomain(tag?: string | null) {
        if (!tag) {
            return undefined;
        }

        return this.tagToDomainMap[tag as keyof typeof this.tagToDomainMap];
    }

    private readonly tagToDomainMap = {
        SCHEDULING: 'scheduling',
        PRESCRIPTION_REFILL: 'refill',
        INSURANCE: 'insurance',
        BILLING: 'billing',
        HUMAN_TRANSFER: 'handoff',
        EMERGENCY: 'safety',
        VOICEMAIL: 'handoff',
        FAQ: 'knowledge',
    } as const;
}
