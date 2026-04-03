'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Bot,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Phone,
    PhoneForwarded,
    Search,
    Voicemail,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Button, Card } from '@/components/dashboard/shared';
import { CallsTableSkeleton } from '@/components/dashboard/skeletons';
import { labelRuntimeAction } from '@/lib/operator-insights';
import { cn } from '@/lib/utils';
import { useCalls, usePrefetchCallsPage } from '@/lib/hooks/query-hooks';

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

const TAG_COLOR: Record<string, string> = {
    SCHEDULING: 'bg-emerald-500/12 text-emerald-800',
    BILLING: 'bg-sky-500/12 text-sky-800',
    INSURANCE: 'bg-violet-500/12 text-violet-800',
    FAQ: 'bg-amber-500/12 text-amber-900',
    PRESCRIPTION_REFILL: 'bg-rose-500/12 text-rose-800',
    HUMAN_TRANSFER: 'bg-orange-500/12 text-orange-900',
    VOICEMAIL: 'bg-red-500/12 text-red-800',
    EMERGENCY: 'bg-red-500/18 text-red-900',
};

type CallResolution =
    | 'AI_RESOLVED'
    | 'STAFF_FOLLOW_UP'
    | 'ESCALATED'
    | 'VOICEMAIL'
    | 'EMERGENCY';

function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getCallResolution(call: {
    resolution?: string;
    handledLive?: boolean;
    isEmergency: boolean;
    tag?: string;
    followUpTaskCount?: number;
}): CallResolution {
    if (call.isEmergency || call.tag === 'EMERGENCY' || call.resolution === 'EMERGENCY_ESCALATION') {
        return 'EMERGENCY';
    }
    if (call.tag === 'VOICEMAIL' || call.resolution === 'VOICEMAIL_CAPTURED') {
        return 'VOICEMAIL';
    }
    if (call.tag === 'HUMAN_TRANSFER' || call.resolution === 'HUMAN_ESCALATION') {
        return 'ESCALATED';
    }
    if (call.resolution === 'FOLLOW_UP_REQUIRED' || (call.followUpTaskCount ?? 0) > 0) {
        return 'STAFF_FOLLOW_UP';
    }
    if (call.resolution === 'CALL_INITIATED' || call.resolution === 'CALL_IN_PROGRESS') {
        return 'AI_RESOLVED';
    }
    return call.handledLive ? 'AI_RESOLVED' : 'STAFF_FOLLOW_UP';
}

function OutcomeIcon({
    tag,
    isEmergency,
    resolution,
}: {
    tag?: string;
    isEmergency: boolean;
    resolution: CallResolution;
}) {
    if (resolution === 'EMERGENCY' || isEmergency || tag === 'EMERGENCY') {
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    if (resolution === 'VOICEMAIL' || tag === 'VOICEMAIL') {
        return <Voicemail className="h-4 w-4 text-red-500" />;
    }
    if (resolution === 'STAFF_FOLLOW_UP') {
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    }
    if (resolution === 'ESCALATED') {
        return <PhoneForwarded className="h-4 w-4 text-orange-500" />;
    }
    return <Bot className="h-4 w-4 text-emerald-600" />;
}

export default function CallLogsPage() {
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState('all');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const filters = useMemo(
        () => ({
            search: search || undefined,
            tag: tagFilter === 'all' ? undefined : tagFilter,
            page,
            pageSize,
        }),
        [page, pageSize, search, tagFilter],
    );

    const callsQuery = useCalls(filters);
    const prefetchCallsPage = usePrefetchCallsPage();
    const calls = callsQuery.data?.data ?? [];
    const total = callsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        if (page < totalPages) {
            prefetchCallsPage({ ...filters, page: page + 1 });
        }
    }, [filters, page, prefetchCallsPage, totalPages]);

    const resolvedByAI = calls.filter((call) => call.resolution === 'LIVE_RESOLVED').length;
    const escalated = calls.filter((call) => call.resolution !== 'LIVE_RESOLVED').length;

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Search caller name or number..."
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        className="w-full rounded-full border-0 bg-[var(--background)] py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground neo-inset outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {['all', 'SCHEDULING', 'BILLING', 'FAQ', 'HUMAN_TRANSFER', 'VOICEMAIL', 'EMERGENCY'].map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => {
                                setTagFilter(tag);
                                setPage(1);
                            }}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                                tagFilter === tag
                                    ? 'bg-[var(--background)] text-primary neo-raised'
                                    : 'bg-[var(--background)] text-muted-foreground neo-inset hover:text-foreground',
                            )}
                        >
                            {tag === 'all' ? 'All' : TAG_LABEL[tag]}
                        </button>
                    ))}
                </div>

                <Button variant="ghost" className="h-10 shrink-0 rounded-2xl" disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span><strong className="text-foreground">{total}</strong> calls</span>
                <span className="text-muted-foreground/50">&bull;</span>
                <span className="text-emerald-700">
                    <strong>{resolvedByAI}</strong> handled live
                </span>
                <span className="text-muted-foreground/50">&bull;</span>
                <span className="text-orange-700">
                    <strong>{escalated}</strong> still need review
                </span>
            </div>

            <Card className="overflow-hidden p-0">
                {callsQuery.isLoading ? (
                    <div className="p-4 sm:p-6">
                        <CallsTableSkeleton />
                    </div>
                ) : callsQuery.isError ? (
                    <div className="py-16 text-center text-sm text-destructive">Failed to load call logs.</div>
                ) : calls.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        No calls matched this filter.
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/60 bg-[var(--background)] neo-inset">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caller</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Turns</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome</th>
                                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">Duration</th>
                                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">Time</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {calls.map((call) => {
                                        const resolution = getCallResolution(call);

                                        return (
                                            <tr key={call.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-[var(--background)]/80">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={cn(
                                                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full neo-inset',
                                                                resolution === 'AI_RESOLVED' ? 'text-emerald-700' : 'text-orange-700',
                                                            )}
                                                        >
                                                            <OutcomeIcon
                                                                tag={call.tag}
                                                                isEmergency={call.isEmergency}
                                                                resolution={resolution}
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-medium text-foreground">
                                                                {call.callerName ?? call.callerPhone}
                                                            </p>
                                                            {call.callerName && (
                                                                <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="space-y-1">
                                                        {(call.tag || call.latestDomain) ? (
                                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLOR[call.tag ?? ''] ?? 'bg-muted text-muted-foreground'}`}>
                                                                {call.tag
                                                                    ? (TAG_LABEL[call.tag] ?? call.tag)
                                                                    : call.latestDomain}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">No route yet</span>
                                                        )}
                                                        <div className="text-xs text-muted-foreground">{call.lineLabel}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-muted-foreground">{call.turnCount}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="space-y-1">
                                                        <span
                                                            className={cn(
                                                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                                                resolution === 'AI_RESOLVED'
                                                                    ? 'bg-emerald-500/12 text-emerald-800'
                                                                    : resolution === 'VOICEMAIL'
                                                                      ? 'bg-red-500/12 text-red-800'
                                                                      : resolution === 'EMERGENCY'
                                                                        ? 'bg-red-500/18 text-red-900'
                                                                        : resolution === 'ESCALATED'
                                                                          ? 'bg-orange-500/12 text-orange-900'
                                                                          : 'bg-amber-500/12 text-amber-900',
                                                            )}
                                                        >
                                                            {call.resolutionLabel ?? (
                                                                resolution === 'AI_RESOLVED'
                                                                    ? 'AI resolved'
                                                                    : resolution === 'STAFF_FOLLOW_UP'
                                                                      ? 'Staff follow-up'
                                                                      : resolution === 'VOICEMAIL'
                                                                        ? 'Voicemail'
                                                                        : resolution === 'EMERGENCY'
                                                                          ? 'Emergency'
                                                                          : 'Escalated'
                                                            )}
                                                        </span>
                                                        {call.latestRuntimeAction && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {labelRuntimeAction(call.latestRuntimeAction)}
                                                                {call.handledLive === true
                                                                    ? ' handled live'
                                                                    : call.handledLive === false
                                                                      ? ' needs staff follow-up'
                                                                      : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="hidden px-4 py-3 sm:table-cell">
                                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDuration(call.duration)}
                                                    </span>
                                                </td>
                                                <td className="hidden px-4 py-3 md:table-cell">
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Link href={`/dashboard/calls/${call.id}`} className="text-xs text-primary hover:underline">
                                                        View
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-border/50 bg-[var(--background)] px-4 py-3 neo-inset">
                                <span className="text-xs text-muted-foreground">
                                    Page {page} of {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        className="h-8"
                                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                                        disabled={page === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-8"
                                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                        disabled={page === totalPages}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}
