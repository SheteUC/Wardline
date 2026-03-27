'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ChevronRight, Phone } from 'lucide-react';
import { Button, Card } from '@/components/dashboard/shared';
import { useFollowUpTasks, useUpdateFollowUpTaskStatus } from '@/lib/hooks/query-hooks';
import { humanizeFallbackReason } from '@/lib/operator-insights';

const TYPE_LABELS: Record<string, string> = {
    URGENT_CALLBACK: 'Urgent callback',
    MANUAL_REVIEW: 'Manual review',
    APPOINTMENT_REQUEST: 'Appointment request',
    REFILL_REQUEST: 'Refill request',
    INSURANCE_CHECK: 'Insurance check',
    BILLING_REQUEST: 'Billing request',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export default function UrgentCallsPage() {
    const followUpTasksQuery = useFollowUpTasks({ priority: 'URGENT' });
    const updateStatus = useUpdateFollowUpTaskStatus();
    const tasks = (followUpTasksQuery.data ?? []).filter(
        (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED',
    );

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] text-red-600 neo-inset">
                    <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Urgent Calls</h2>
                    <p className="text-sm text-muted-foreground">
                        Priority voicemails and urgent tasks captured by the after-hours and safety guard flow.
                    </p>
                </div>
            </div>

            <Card>
                {followUpTasksQuery.isLoading ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading urgent calls...</div>
                ) : followUpTasksQuery.isError ? (
                    <div className="py-16 text-center text-sm text-destructive">Failed to load urgent calls.</div>
                ) : tasks.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        No urgent calls are waiting right now.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tasks.map((task) => {
                            const metadata = isRecord(task.metadata) ? task.metadata : {};
                            const fallbackReason =
                                typeof metadata.fallbackReason === 'string' ? metadata.fallbackReason : null;

                            return (
                                <div
                                    key={task.id}
                                    className="rounded-2xl bg-[var(--background)] p-4 neo-inset"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <Link
                                            href={task.callId ? `/dashboard/calls/${task.callId}` : '/dashboard/follow-ups'}
                                            className="min-w-0 flex-1"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-700 neo-inset">
                                                    <Phone className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {task.callerName ?? task.callerPhone ?? task.title}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {task.title}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="mt-3 text-sm text-muted-foreground">{task.summary}</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-xs font-semibold text-red-800">
                                                    {TYPE_LABELS[task.type] || 'Urgent'}
                                                </span>
                                                <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs font-medium text-muted-foreground neo-flat">
                                                    {task.status.replaceAll('_', ' ').toLowerCase()}
                                                </span>
                                                {task.urgencyKeywords.map((keyword) => (
                                                    <span
                                                        key={keyword}
                                                        className="rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-800"
                                                    >
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                            {fallbackReason && (
                                                <p className="mt-2 text-xs text-amber-700">
                                                    Downgraded to staff follow-up because {humanizeFallbackReason(fallbackReason)}.
                                                </p>
                                            )}
                                        </Link>

                                        <div className="flex shrink-0 flex-col items-end gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                                            </span>
                                            <div className="flex gap-2">
                                                {task.status === 'OPEN' && (
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() =>
                                                            updateStatus.mutate({
                                                                taskId: task.id,
                                                                status: 'IN_PROGRESS',
                                                            })
                                                        }
                                                        disabled={updateStatus.isPending}
                                                    >
                                                        Start
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 px-3 text-xs"
                                                    onClick={() =>
                                                        updateStatus.mutate({
                                                            taskId: task.id,
                                                            status: 'COMPLETED',
                                                        })
                                                    }
                                                    disabled={updateStatus.isPending}
                                                >
                                                    Complete
                                                </Button>
                                                <Link
                                                    href={task.callId ? `/dashboard/calls/${task.callId}` : '/dashboard/follow-ups'}
                                                    className="inline-flex h-8 items-center gap-1 rounded-2xl px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    Open
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}
