"use client";

import Link from 'next/link';
import {
    AlertTriangle,
    ChevronRight,
    Clock,
    Download,
    Loader2,
    Phone,
    User,
} from 'lucide-react';
import { Button, Card, Badge } from "@/components/dashboard/shared";
import { useCall } from '@/lib/hooks/query-hooks';
import { CallStatus } from '@wardline/types';
import { humanizeFallbackReason, labelRuntimeAction } from '@/lib/operator-insights';

const TAG_LABEL: Record<string, string> = {
    SCHEDULING: 'Scheduling',
    BILLING: 'Billing',
    INSURANCE: 'Insurance',
    FAQ: 'FAQ',
    PRESCRIPTION_REFILL: 'Refill',
    HUMAN_TRANSFER: 'Human transfer',
    VOICEMAIL: 'Voicemail',
    EMERGENCY: 'Emergency',
};

const FOLLOW_UP_LABELS: Record<string, string> = {
    URGENT_CALLBACK: 'Urgent callback',
    MANUAL_REVIEW: 'Manual review',
    APPOINTMENT_REQUEST: 'Appointment request',
    REFILL_REQUEST: 'Refill request',
    INSURANCE_CHECK: 'Insurance check',
    BILLING_REQUEST: 'Billing request',
    VOICEMAIL_REVIEW: 'Voicemail review',
};

function formatDuration(startedAt: string, endedAt?: string): string {
    if (!endedAt) return '0:00';
    const seconds = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CallDetailPage({ params }: { params: { id: string } }) {
    const callQuery = useCall(params.id);
    const call = callQuery.data;

    if (callQuery.isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (callQuery.isError || !call) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                    <p className="text-lg font-semibold">Error loading call</p>
                    <p className="text-sm text-muted-foreground">Call details could not be loaded.</p>
                </div>
            </div>
        );
    }

    const duration = formatDuration(call.startedAt, call.endedAt);
    const openFollowUps = (call.followUpTasks ?? []).filter(
        (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED',
    );

    return (
        <div className="flex h-[calc(100vh-100px)] flex-col gap-6 lg:flex-row">
            <div className="w-full flex-shrink-0 space-y-6 lg:w-96">
                <Link href="/dashboard/calls">
                    <Button variant="secondary" icon={ChevronRight} className="mb-2 rotate-180">
                        Back to List
                    </Button>
                </Link>

                <Card>
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background)] text-primary neo-inset">
                            <Phone className="h-6 w-6" />
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-foreground">{duration}</div>
                            <div className="text-sm text-muted-foreground">Duration</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium uppercase text-muted-foreground">Caller</label>
                            <div className="font-medium text-foreground">{call.caller?.name || 'Unknown caller'}</div>
                            <div className="text-sm text-muted-foreground">
                                {call.caller?.phone || call.phoneNumber.twilioPhoneNumber}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium uppercase text-muted-foreground">Detected route</label>
                            <div className="mt-1 flex flex-wrap gap-2">
                                {call.tag && (
                                    <Badge
                                        type={call.isEmergency ? "danger" : "primary"}
                                        text={TAG_LABEL[call.tag] || call.tag}
                                    />
                                )}
                                {call.isEmergency && <Badge type="danger" text="Emergency" />}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium uppercase text-muted-foreground">Call status</label>
                            <div className="mt-1">
                                <Badge
                                    type={
                                        call.status === CallStatus.COMPLETED
                                            ? 'success'
                                            : call.status === CallStatus.FAILED
                                              ? 'warning'
                                              : 'neutral'
                                    }
                                    text={call.status}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium uppercase text-muted-foreground">Line</label>
                            <div className="text-sm text-foreground">{call.phoneNumber.label}</div>
                            <div className="text-xs text-muted-foreground">{call.phoneNumber.twilioPhoneNumber}</div>
                        </div>

                        <div>
                            <label className="text-xs font-medium uppercase text-muted-foreground">Turns captured</label>
                            <div className="text-sm text-foreground">{call.turnCount}</div>
                        </div>
                    </div>
                </Card>

                {call.operatorSummary && (
                    <Card title="Operator Summary">
                        <div className="space-y-3">
                            <div>
                                <div className="text-sm font-medium text-foreground">{call.operatorSummary.label}</div>
                                <p className="mt-1 text-sm text-muted-foreground">{call.operatorSummary.nextStep}</p>
                            </div>
                            {call.operatorSummary.actionName && (
                                <div className="rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground">Latest runtime action</div>
                                    <div className="mt-1 text-sm text-foreground">
                                        {labelRuntimeAction(call.operatorSummary.actionName)}
                                    </div>
                                </div>
                            )}
                            {call.operatorSummary.fallbackReason && (
                                <p className="text-xs text-amber-700">
                                    Staff follow-up was required because {humanizeFallbackReason(call.operatorSummary.fallbackReason)}.
                                </p>
                            )}
                        </div>
                    </Card>
                )}

                {call.transportSummary && (
                    <Card title="Voice Runtime">
                        <div className="space-y-3 text-sm text-foreground">
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <Badge type="neutral" text={call.transportSummary.runtime} />
                                <Badge type="neutral" text={call.transportSummary.transport} />
                            </div>
                            {call.transportSummary.roomName && (
                                <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground">LiveKit room</div>
                                    <div>{call.transportSummary.roomName}</div>
                                </div>
                            )}
                            {(call.transportSummary.twilioStreamSid || call.transportSummary.providerSessionId) && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {call.transportSummary.twilioStreamSid && (
                                        <div>
                                            <div className="text-xs font-medium uppercase text-muted-foreground">Twilio stream</div>
                                            <div>{call.transportSummary.twilioStreamSid}</div>
                                        </div>
                                    )}
                                    {call.transportSummary.providerSessionId && (
                                        <div>
                                            <div className="text-xs font-medium uppercase text-muted-foreground">Provider session</div>
                                            <div>{call.transportSummary.providerSessionId}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {typeof call.transportSummary.transcriptEventCount === 'number' && (
                                <p className="text-xs text-muted-foreground">
                                    Transcript events captured: {call.transportSummary.transcriptEventCount}
                                </p>
                            )}
                        </div>
                    </Card>
                )}

                {openFollowUps.length > 0 && (
                    <Card title="Linked Follow-ups">
                        <div className="space-y-3">
                            {openFollowUps.map((task) => (
                                <div key={task.id} className="rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-medium text-foreground">
                                            {FOLLOW_UP_LABELS[task.type] ?? task.type.replaceAll('_', ' ')}
                                        </div>
                                        <Badge
                                            type={task.priority === 'URGENT' ? 'danger' : 'neutral'}
                                            text={task.status.replaceAll('_', ' ')}
                                        />
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{task.summary}</p>
                                    {typeof task.metadata?.fallbackReason === 'string' && (
                                        <p className="mt-2 text-xs text-amber-700">
                                            Downgraded because {humanizeFallbackReason(task.metadata.fallbackReason)}.
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {call.runtimeActionEvents.length > 0 && (
                    <Card title="Runtime Actions">
                        <div className="space-y-3">
                            {call.runtimeActionEvents.map((event, index) => (
                                <div key={`${event.createdAt}-${index}`} className="rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-medium text-foreground">
                                            {labelRuntimeAction(event.actionName)}
                                        </div>
                                        <Badge
                                            type={event.handledLive ? 'success' : 'warning'}
                                            text={event.handledLive ? 'Handled live' : 'Staff follow-up'}
                                        />
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        {event.domain && <span>{event.domain}</span>}
                                        {event.integrationCategory && <span>{event.integrationCategory}</span>}
                                        {event.integrationVendor && <span>{event.integrationVendor}</span>}
                                        {event.latencyMs !== undefined && <span>{event.latencyMs}ms</span>}
                                    </div>
                                    {event.operatorSummary && (
                                        <p className="mt-2 text-xs text-foreground/80">{event.operatorSummary}.</p>
                                    )}
                                    {event.fallbackReason && (
                                        <p className="mt-2 text-xs text-amber-700">
                                            Downgraded because {humanizeFallbackReason(event.fallbackReason)}.
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {call.handoffs.length > 0 && (
                    <Card title="Handoffs">
                        <div className="space-y-3">
                            {call.handoffs.map((handoff) => (
                                <div key={handoff.id} className="rounded-2xl bg-amber-500/10 p-3 neo-inset">
                                    <div className="text-sm font-medium text-amber-950">Human escalation</div>
                                    <div className="mt-1 text-xs text-amber-800">
                                        {typeof handoff.payload?.summary === 'string'
                                            ? String(handoff.payload.summary)
                                            : 'Escalation summary recorded for follow-up.'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {call.voicemails.length > 0 && (
                    <Card title="Voicemail">
                        <div className="space-y-3">
                            {call.voicemails.map((voicemail) => (
                                <div key={voicemail.id} className="rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                    <div className="text-sm font-medium text-foreground">
                                        {voicemail.callerName ?? voicemail.callerPhone}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">{voicemail.context}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Button variant="secondary" className="w-full" icon={Download} disabled>
                    Export Call Summary
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-[var(--background)] neo-raised">
                <div className="flex items-center justify-between border-b border-border/40 bg-[var(--background)] px-6 py-4 neo-inset">
                    <h3 className="font-semibold text-foreground">Call transcript</h3>
                    <div className="flex gap-2">
                        <Badge type="neutral" text={`ID: ${(call.twilioCallSid || call.id).substring(0, 8)}`} />
                        {call.recordingUrl && <Badge type="primary" text="Recording available" />}
                    </div>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto bg-background/30 p-6">
                    {call.transcriptSegments.length > 0 ? (
                        call.transcriptSegments.map((segment) => {
                            const isAgentSide = segment.speaker === 'AGENT' || segment.speaker === 'SYSTEM';
                            return (
                                <div
                                    key={segment.id}
                                    className={`flex gap-4 ${isAgentSide ? '' : 'flex-row-reverse'}`}
                                >
                                    <div
                                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full neo-inset ${
                                            isAgentSide
                                                ? 'bg-primary/15 text-primary'
                                                : 'bg-[var(--background)] text-muted-foreground'
                                        }`}
                                    >
                                        {isAgentSide ? <Phone className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                    </div>
                                    <div className={`flex max-w-[70%] flex-col ${isAgentSide ? 'items-start' : 'items-end'}`}>
                                        <div
                                            className={`rounded-2xl px-4 py-3 text-sm neo-raised-sm ${
                                                isAgentSide
                                                    ? 'rounded-tl-none bg-[var(--background)] text-foreground'
                                                    : 'rounded-tr-none bg-[var(--background)] text-foreground'
                                            }`}
                                        >
                                            {segment.text}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                                            <span>{formatTime(segment.startTimeMs)}</span>
                                            {segment.confidence !== undefined && (
                                                <span>Confidence {Math.round(segment.confidence * 100)}%</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No transcript is available for this call yet.
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 border-t border-border/40 bg-[var(--background)] p-4 neo-inset">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                        Started {new Date(call.startedAt).toLocaleString()}
                    </span>
                    {call.endedAt && (
                        <span className="text-xs text-muted-foreground">
                            • Ended {new Date(call.endedAt).toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
