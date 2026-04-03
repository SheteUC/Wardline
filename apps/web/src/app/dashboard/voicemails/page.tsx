'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, Button } from '@/components/dashboard/shared';
import { CheckCircle, Phone, Play, Voicemail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarkVoicemailListened, useVoicemails } from '@/lib/hooks/query-hooks';
import { humanizeFallbackReason, labelRuntimeAction } from '@/lib/operator-insights';

const TAG_LABEL: Record<string, string> = {
    SCHEDULING: 'Scheduling',
    BILLING: 'Billing',
    INSURANCE: 'Insurance',
    FAQ: 'FAQ',
    HUMAN_TRANSFER: 'Human transfer',
    VOICEMAIL: 'Voicemail',
    EMERGENCY: 'Emergency',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export default function VoicemailsPage() {
    const [playing, setPlaying] = useState<string | null>(null);
    const voicemailsQuery = useVoicemails();
    const markListenedMutation = useMarkVoicemailListened();
    const voicemails = voicemailsQuery.data ?? [];
    const unlistened = voicemails.filter((voicemail) => !voicemail.isListened).length;

    const markListened = async (id: string) => {
        await markListenedMutation.mutateAsync(id);
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] text-red-600 neo-inset">
                    <Voicemail className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">
                        {unlistened > 0
                            ? `${unlistened} unlistened voicemail${unlistened > 1 ? 's' : ''}`
                            : 'All voicemails have been reviewed'}
                    </p>
                </div>
            </div>

            {voicemailsQuery.isLoading ? (
                <Card>
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading voicemail inbox...</div>
                </Card>
            ) : voicemailsQuery.isError ? (
                <Card>
                    <div className="py-16 text-center text-sm text-destructive">Failed to load voicemails.</div>
                </Card>
            ) : voicemails.length === 0 ? (
                <Card>
                    <div className="py-16 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                            <Voicemail className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 font-semibold text-foreground">No voicemails</h3>
                        <p className="text-sm text-muted-foreground">
                            After-hours calls and unanswered transfers will appear here for next-day follow-up.
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {voicemails.map((voicemail) => (
                        <Card
                            key={voicemail.id}
                            className={cn('transition-all', !voicemail.isListened && 'ring-2 ring-red-500/20')}
                        >
                            {(() => {
                                const followUpMetadata = isRecord(voicemail.followUpTask?.metadata)
                                    ? voicemail.followUpTask.metadata
                                    : {};
                                const originatingAction =
                                    typeof followUpMetadata.originatingAction === 'string'
                                        ? followUpMetadata.originatingAction
                                        : null;
                                const fallbackReason =
                                    typeof followUpMetadata.fallbackReason === 'string'
                                        ? followUpMetadata.fallbackReason
                                        : null;
                                const liveAttemptMessage =
                                    typeof followUpMetadata.liveAttemptMessage === 'string'
                                        ? followUpMetadata.liveAttemptMessage
                                        : null;

                                return (
                            <div className="flex items-start gap-4">
                                <div
                                    className={cn(
                                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--background)] neo-inset',
                                        voicemail.isListened ? 'text-muted-foreground' : 'text-red-600',
                                    )}
                                >
                                    <Voicemail className="h-5 w-5" />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {voicemail.callerName ?? voicemail.callerPhone}
                                                </span>
                                                {!voicemail.isListened && (
                                                    <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-xs font-bold text-red-800">
                                                        New
                                                    </span>
                                                )}
                                                {voicemail.call?.tag && (
                                                    <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                        {TAG_LABEL[voicemail.call.tag] ?? voicemail.call.tag}
                                                    </span>
                                                )}
                                                {voicemail.followUpTask && (
                                                    <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-800">
                                                        Follow-up {voicemail.followUpTask.status.toLowerCase()}
                                                    </span>
                                                )}
                                                {originatingAction && (
                                                    <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs font-medium text-muted-foreground neo-flat">
                                                        {labelRuntimeAction(originatingAction)}
                                                    </span>
                                                )}
                                            </div>
                                            {voicemail.callerName && (
                                                <p className="text-xs text-muted-foreground">{voicemail.callerPhone}</p>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(voicemail.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="mb-2 text-xs text-muted-foreground">{voicemail.context}</p>
                                    {voicemail.followUpTask && (
                                        <div className="mb-2 space-y-1">
                                            <p className="text-xs text-muted-foreground">
                                                Linked task: {voicemail.followUpTask.type.replaceAll('_', ' ').toLowerCase()}
                                            </p>
                                            {fallbackReason && (
                                                <p className="text-xs text-amber-700">
                                                    Downgraded to staff follow-up because {humanizeFallbackReason(fallbackReason)}.
                                                </p>
                                            )}
                                            {liveAttemptMessage && (
                                                <p className="text-xs text-muted-foreground">
                                                    Last runtime message: {liveAttemptMessage}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {voicemail.transcription && (
                                        <div className="mb-3 rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                            <p className="text-xs italic text-foreground">
                                                &ldquo;{voicemail.transcription}&rdquo;
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="ghost"
                                            className="h-9 text-xs"
                                            onClick={async () => {
                                                setPlaying(playing === voicemail.id ? null : voicemail.id);
                                                if (!voicemail.isListened) {
                                                    await markListened(voicemail.id);
                                                }
                                                if (voicemail.recordingUrl && voicemail.recordingUrl !== '#') {
                                                    window.open(voicemail.recordingUrl, '_blank', 'noopener,noreferrer');
                                                }
                                            }}
                                        >
                                            <Play className="mr-1 h-3 w-3" />
                                            {playing === voicemail.id ? 'Opened audio' : 'Play'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="h-9 text-xs"
                                            onClick={() => window.open(`tel:${voicemail.callerPhone}`)}
                                        >
                                            <Phone className="mr-1 h-3 w-3" />
                                            Call back
                                        </Button>
                                        {!voicemail.isListened && (
                                            <Button
                                                variant="ghost"
                                                className="h-9 text-xs"
                                                onClick={() => markListened(voicemail.id)}
                                                disabled={markListenedMutation.isPending}
                                            >
                                                <CheckCircle className="mr-1 h-3 w-3" />
                                                Mark listened
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                                );
                            })()}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
