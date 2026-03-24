'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, ListTodo } from 'lucide-react';
import { Button, Card } from '@/components/dashboard/shared';
import { useFollowUpTasks, useUpdateFollowUpTaskStatus } from '@/lib/hooks/query-hooks';

const TYPE_LABELS: Record<string, string> = {
    MANUAL_REVIEW: 'Manual review',
    APPOINTMENT_REQUEST: 'Appointment request',
    REFILL_REQUEST: 'Refill request',
    INSURANCE_CHECK: 'Insurance check',
    BILLING_REQUEST: 'Billing request',
    VOICEMAIL_REVIEW: 'Voicemail review',
};

const STATUS_TONES: Record<string, string> = {
    OPEN: 'bg-amber-500/12 text-amber-700',
    IN_PROGRESS: 'bg-sky-500/12 text-sky-700',
    COMPLETED: 'bg-emerald-500/12 text-emerald-700',
    CANCELLED: 'bg-muted text-muted-foreground',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function labelizeRuntimeAction(actionName: string) {
    return actionName.replaceAll('-', ' ');
}

export default function FollowUpsPage() {
    const followUpTasksQuery = useFollowUpTasks();
    const updateStatus = useUpdateFollowUpTaskStatus();
    const tasks = (followUpTasksQuery.data ?? []).filter(
        (task) =>
            task.status !== 'COMPLETED' &&
            task.status !== 'CANCELLED' &&
            task.priority !== 'URGENT' &&
            task.type !== 'URGENT_CALLBACK',
    );

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] text-primary neo-inset">
                    <ListTodo className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Follow-ups</h2>
                    <p className="text-sm text-muted-foreground">
                        Manual reviews and downgraded live actions that still need staff attention.
                    </p>
                </div>
            </div>

            <Card title="Open Follow-up Queue">
                {followUpTasksQuery.isLoading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Loading follow-up tasks...</div>
                ) : tasks.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">No follow-up tasks are pending.</div>
                ) : (
                    <div className="space-y-3">
                        {tasks.map((task) => {
                            const metadata = isRecord(task.metadata) ? task.metadata : {};
                            const fallbackReason =
                                typeof metadata.fallbackReason === 'string' ? metadata.fallbackReason : null;
                            const originatingAction =
                                typeof metadata.originatingAction === 'string' ? metadata.originatingAction : null;
                            const integrationVendor =
                                typeof metadata.integrationVendor === 'string' ? metadata.integrationVendor : null;
                            const liveAttemptMessage =
                                typeof metadata.liveAttemptMessage === 'string' ? metadata.liveAttemptMessage : null;

                            return (
                                <div
                                    key={task.id}
                                    className="rounded-2xl bg-[var(--background)] p-4 transition-colors neo-inset"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <Link
                                            href={task.callId ? `/dashboard/calls/${task.callId}` : '/dashboard/voicemails'}
                                            className="min-w-0 flex-1"
                                        >
                                            <div className="text-sm font-medium text-foreground">
                                                {task.callerName ?? task.callerPhone ?? task.title}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                    {TYPE_LABELS[task.type] ?? task.type.replaceAll('_', ' ').toLowerCase()}
                                                </span>
                                                <span
                                                    className={[
                                                        'rounded-full px-2 py-0.5 text-xs font-medium',
                                                        STATUS_TONES[task.status] ?? STATUS_TONES.OPEN,
                                                    ].join(' ')}
                                                >
                                                    {task.status.replaceAll('_', ' ').toLowerCase()}
                                                </span>
                                                <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                    {task.priority}
                                                </span>
                                                {originatingAction && (
                                                    <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs font-medium text-muted-foreground neo-flat">
                                                        {labelizeRuntimeAction(originatingAction)}
                                                    </span>
                                                )}
                                                {integrationVendor && (
                                                    <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs font-medium text-muted-foreground neo-flat">
                                                        {integrationVendor}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs text-muted-foreground">{task.title}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">{task.summary}</p>
                                            {fallbackReason && (
                                                <p className="mt-2 text-xs text-amber-700">
                                                    Live execution downgraded because {fallbackReason.replaceAll('_', ' ')}.
                                                </p>
                                            )}
                                            {liveAttemptMessage && (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Last runtime message: {liveAttemptMessage}
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
                                                {task.status !== 'COMPLETED' && (
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
                                                )}
                                                <Link
                                                    href={task.callId ? `/dashboard/calls/${task.callId}` : '/dashboard/voicemails'}
                                                    className="inline-flex h-8 items-center gap-1 rounded-2xl px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    Open
                                                    <ChevronRight className="h-4 w-4" />
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
