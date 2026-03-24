'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ChevronRight, Phone } from 'lucide-react';
import { Card } from '@/components/dashboard/shared';
import { useCalls } from '@/lib/hooks/query-hooks';

const TAG_LABEL: Record<string, string> = {
    EMERGENCY: 'Emergency',
    HUMAN_TRANSFER: 'Escalated',
    VOICEMAIL: 'Urgent voicemail',
};

export default function UrgentCallsPage() {
    const callsQuery = useCalls({ isEmergency: true, page: 1, pageSize: 50 });
    const calls = callsQuery.data?.data ?? [];

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] text-red-600 neo-inset">
                    <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Urgent Calls</h2>
                    <p className="text-sm text-muted-foreground">
                        Review urgent and emergency-tagged calls captured by the after-hours and safety flow.
                    </p>
                </div>
            </div>

            <Card>
                {callsQuery.isLoading ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading urgent calls...</div>
                ) : callsQuery.isError ? (
                    <div className="py-16 text-center text-sm text-destructive">Failed to load urgent calls.</div>
                ) : calls.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        No urgent calls are waiting right now.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {calls.map((call) => (
                            <Link
                                key={call.id}
                                href={`/dashboard/calls/${call.id}`}
                                className="flex items-center justify-between rounded-2xl p-4 transition-colors hover:bg-[var(--background)]/60"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-700 neo-inset">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">
                                            {call.callerName ?? call.callerPhone}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-xs font-semibold text-red-800">
                                        {TAG_LABEL[call.tag || 'EMERGENCY'] || call.tag || 'Urgent'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
