'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@clerk/nextjs';
import {
    AlertTriangle,
    Bot,
    ChevronRight,
    Clock,
    Phone,
    PhoneForwarded,
    PlugZap,
    Settings2,
    Voicemail,
} from 'lucide-react';
import { Card } from '@/components/dashboard/shared';
import { useBusiness } from '@/lib/business-context';
import {
    useCallAnalytics,
    useCalls,
    useFollowUpTasks,
    useIntegrations,
    useVoicemails,
} from '@/lib/hooks/query-hooks';
import { canAccessInternalTools } from '@/lib/internal-tools';

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
    SCHEDULING: 'bg-emerald-500/10 text-emerald-700',
    BILLING: 'bg-sky-500/10 text-sky-700',
    INSURANCE: 'bg-violet-500/10 text-violet-700',
    FAQ: 'bg-amber-500/10 text-amber-800',
    PRESCRIPTION_REFILL: 'bg-rose-500/10 text-rose-700',
    HUMAN_TRANSFER: 'bg-orange-500/10 text-orange-700',
    VOICEMAIL: 'bg-red-500/10 text-red-700',
    EMERGENCY: 'bg-red-500/15 text-red-800',
};

function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function DashboardPage() {
    const { businessId, isLoading: businessLoading } = useBusiness();
    const { user } = useUser();
    const showInternalTools = canAccessInternalTools(user);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const callsQuery = useCalls({ page: 1, pageSize: 6 });
    const analyticsQuery = useCallAnalytics(startOfToday, now);
    const voicemailsQuery = useVoicemails(true);
    const followUpTasksQuery = useFollowUpTasks();
    const integrationsQuery = useIntegrations();

    const recentCalls = callsQuery.data?.data ?? [];
    const analytics = analyticsQuery.data;
    const voicemails = voicemailsQuery.data ?? [];
    const openTasks = (followUpTasksQuery.data ?? []).filter(
        (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED',
    );
    const urgentTasks = openTasks.filter(
        (task) => task.priority === 'URGENT' || task.type === 'URGENT_CALLBACK',
    );
    const integrations = integrationsQuery.data ?? [];
    const integrationFailures = integrations.filter((integration) => integration.status !== 'CONNECTED');
    const escalatedCalls = (analytics?.callsByTag?.HUMAN_TRANSFER ?? 0) + (analytics?.callsByTag?.EMERGENCY ?? 0);
    const aiResolved = Math.max((analytics?.completedCalls ?? 0) - escalatedCalls - (analytics?.voicemailCount ?? 0), 0);
    const topReasons = Object.entries(analytics?.callsByTag ?? {})
        .sort(([, left], [, right]) => right - left)
        .slice(0, 4);
    const readinessIssues = [
        !businessId ? 'Select a practice' : null,
        integrationFailures.length > 0 ? `${integrationFailures.length} integrations need attention` : null,
        urgentTasks.length > 0 ? `${urgentTasks.length} urgent follow-ups need review` : null,
    ].filter(Boolean);

    if (!businessLoading && !businessId) {
        return (
            <Card>
                <div className="py-16 text-center">
                    <h2 className="text-xl font-semibold text-foreground">Select a practice to get started</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                        Create or choose a business in Practice Setup before reviewing calls, follow-ups, and integrations.
                    </p>
                    <Link
                        href="/dashboard/settings"
                        className="mt-4 inline-flex rounded-2xl bg-[var(--background)] px-4 py-2.5 text-sm font-semibold text-primary neo-raised"
                    >
                        Open settings
                    </Link>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {readinessIssues.length > 0 && (
                <div className="neo-raised rounded-[16px] bg-[var(--background)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--background)] neo-raised-sm">
                                <PlugZap className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {readinessIssues[0]}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Practice readiness now comes from setup, integrations, and follow-up coverage rather than manual runtime design.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/settings"
                            className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            Open practice setup <ChevronRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    {
                        label: 'Calls Today',
                        value: analytics?.totalCalls ?? 0,
                        detail: `${analytics?.completedCalls ?? 0} completed`,
                        icon: Phone,
                    },
                    {
                        label: 'AI Resolved',
                        value: aiResolved,
                        detail: `${escalatedCalls} escalated`,
                        icon: PhoneForwarded,
                    },
                    {
                        label: 'Urgent Calls',
                        value: urgentTasks.length,
                        detail: 'Requires follow-up queue review',
                        icon: AlertTriangle,
                    },
                    {
                        label: 'New Voicemails',
                        value: voicemails.length,
                        detail: voicemails.length > 0 ? 'Unlistened messages' : 'Inbox is clear',
                        icon: Voicemail,
                    },
                ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{stat.label}</p>
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised-sm">
                                    <Icon className="h-4 w-4 text-primary" />
                                </div>
                            </div>
                            <div className="text-3xl font-semibold text-foreground">{stat.value}</div>
                            <div className="text-xs font-medium text-muted-foreground">{stat.detail}</div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <Card>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="font-semibold text-foreground">Recent Calls</h2>
                            <Link href="/dashboard/calls" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                View all <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>

                        {callsQuery.isLoading ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">Loading recent calls...</div>
                        ) : recentCalls.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">
                                No calls have been recorded for this business yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentCalls.map((call) => {
                                    const isEscalated = call.isEmergency || call.tag === 'HUMAN_TRANSFER' || call.tag === 'VOICEMAIL';
                                    return (
                                        <Link
                                            key={call.id}
                                            href={`/dashboard/calls/${call.id}`}
                                            className="flex items-center justify-between rounded-2xl py-2.5 pl-1 pr-2 transition-colors hover:bg-[var(--background)]/50"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised-sm">
                                                    {isEscalated ? (
                                                        <PhoneForwarded className="h-4 w-4 text-orange-500" />
                                                    ) : (
                                                        <Bot className="h-4 w-4 text-emerald-600" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {call.callerName ?? call.callerPhone}
                                                    </p>
                                                    {call.callerName && (
                                                        <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-3">
                                                {call.tag && (
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLOR[call.tag] ?? 'bg-muted text-muted-foreground'}`}>
                                                        {TAG_LABEL[call.tag] ?? call.tag}
                                                    </span>
                                                )}
                                                <div className="hidden text-right sm:block">
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDuration(call.duration)}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="font-semibold text-foreground">Top Call Reasons</h2>
                            <Phone className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {topReasons.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Call reason analytics will appear once calls are processed.</p>
                        ) : (
                            <div className="space-y-3">
                                {topReasons.map(([tag, count]) => (
                                    <div key={tag}>
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-sm text-foreground">{TAG_LABEL[tag] ?? tag}</span>
                                            <span className="text-xs text-muted-foreground">{count} calls</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-[var(--background)] neo-inset">
                                            <div
                                                className="h-full rounded-full bg-primary"
                                                style={{
                                                    width: `${analytics?.totalCalls ? Math.max((count / analytics.totalCalls) * 100, 8) : 0}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-semibold text-foreground">Voicemail Queue</h2>
                            {voicemails.length > 0 && (
                                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-700">
                                    {voicemails.length} new
                                </span>
                            )}
                        </div>
                        {voicemails.slice(0, 3).map((voicemail) => (
                            <div key={voicemail.id} className="mb-2 rounded-2xl bg-[var(--background)] p-3 neo-inset last:mb-0">
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground">
                                        {voicemail.callerName ?? voicemail.callerPhone}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(voicemail.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{voicemail.context}</p>
                            </div>
                        ))}
                        <Link href="/dashboard/voicemails" className="mt-3 block text-center text-xs text-primary hover:underline">
                            View voicemail inbox
                        </Link>
                    </Card>

                    <Card>
                        <h2 className="mb-3 font-semibold text-foreground">Quick Actions</h2>
                        <div className="space-y-2">
                            <Link href="/dashboard/settings" className="flex items-center gap-3 rounded-2xl p-2.5 transition-all duration-150 hover:bg-[var(--background)] hover:neo-raised-sm">
                                <Settings2 className="h-4 w-4 text-sky-600" />
                                <span className="text-sm font-medium text-foreground">Review Practice Setup</span>
                                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                            </Link>
                            <Link href="/dashboard/integration-failures" className="flex items-center gap-3 rounded-2xl p-2.5 transition-all duration-150 hover:bg-[var(--background)] hover:neo-raised-sm">
                                <PlugZap className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">Check Integrations</span>
                                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                            </Link>
                            {showInternalTools && (
                                <Link href="/dashboard/workflows" className="flex items-center gap-3 rounded-2xl p-2.5 transition-all duration-150 hover:bg-[var(--background)] hover:neo-raised-sm">
                                    <PhoneForwarded className="h-4 w-4 text-amber-500" />
                                    <span className="text-sm font-medium text-foreground">Open Legacy Runtime Tools</span>
                                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                </Link>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
