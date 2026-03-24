'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, ListTodo, Voicemail } from 'lucide-react';
import { Card } from '@/components/dashboard/shared';
import { useCalls, useVoicemails } from '@/lib/hooks/query-hooks';

export default function FollowUpsPage() {
    const voicemailsQuery = useVoicemails(true);
    const urgentCallsQuery = useCalls({ isEmergency: true, page: 1, pageSize: 20 });
    const voicemails = voicemailsQuery.data ?? [];
    const urgentCalls = urgentCallsQuery.data?.data ?? [];

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] text-primary neo-inset">
                    <ListTodo className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Follow-ups</h2>
                    <p className="text-sm text-muted-foreground">
                        Priority callback work generated from voicemails and urgent calls that still need staff review.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Unreviewed Voicemails">
                    {voicemailsQuery.isLoading ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">Loading voicemail follow-ups...</div>
                    ) : voicemails.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">No voicemail follow-ups pending.</div>
                    ) : (
                        <div className="space-y-3">
                            {voicemails.map((voicemail) => (
                                <div key={voicemail.id} className="rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Voicemail className="h-4 w-4 text-red-600" />
                                            <span className="text-sm font-medium text-foreground">
                                                {voicemail.callerName ?? voicemail.callerPhone}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(voicemail.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">{voicemail.context}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card title="Urgent Call Queue">
                    {urgentCallsQuery.isLoading ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">Loading urgent follow-ups...</div>
                    ) : urgentCalls.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">No urgent follow-ups pending.</div>
                    ) : (
                        <div className="space-y-3">
                            {urgentCalls.map((call) => (
                                <Link
                                    key={call.id}
                                    href={`/dashboard/calls/${call.id}`}
                                    className="flex items-center justify-between rounded-2xl bg-[var(--background)] p-3 transition-colors hover:opacity-95 neo-inset"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-foreground">
                                            {call.callerName ?? call.callerPhone}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{call.callerPhone}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
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
        </div>
    );
}
