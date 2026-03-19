'use client';

import React, { useState } from 'react';
import { Search, Download, Phone, Bot, PhoneForwarded, Voicemail, AlertTriangle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button } from '@/components/dashboard/shared';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

// ─── Tag config ───────────────────────────────────────────────────────────────

const TAG_LABEL: Record<string, string> = {
    SCHEDULING: 'Scheduling',
    BILLING: 'Billing',
    INSURANCE: 'Insurance',
    FAQ: 'FAQ',
    PRESCRIPTION_REFILL: 'Refill',
    HUMAN_TRANSFER: 'Human Transfer',
    VOICEMAIL: 'Voicemail',
    EMERGENCY: 'Emergency',
};

const TAG_COLOR: Record<string, string> = {
    SCHEDULING: 'bg-green-100 text-green-700',
    BILLING: 'bg-blue-100 text-blue-700',
    INSURANCE: 'bg-purple-100 text-purple-700',
    FAQ: 'bg-amber-100 text-amber-700',
    PRESCRIPTION_REFILL: 'bg-rose-100 text-rose-700',
    HUMAN_TRANSFER: 'bg-orange-100 text-orange-700',
    VOICEMAIL: 'bg-red-100 text-red-700',
    EMERGENCY: 'bg-red-200 text-red-800',
};

const STATUS_COLOR: Record<string, string> = {
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    ABANDONED: 'bg-gray-100 text-gray-500',
    FAILED: 'bg-red-100 text-red-700',
    INITIATED: 'bg-sky-100 text-sky-700',
    ONGOING: 'bg-blue-100 text-blue-700',
};

function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function OutcomeIcon({ tag, resolvedByAI }: { tag?: string; resolvedByAI: boolean }) {
    if (tag === 'EMERGENCY') return <AlertTriangle className="h-4 w-4 text-red-600" />;
    if (tag === 'VOICEMAIL') return <Voicemail className="h-4 w-4 text-red-500" />;
    if (!resolvedByAI) return <PhoneForwarded className="h-4 w-4 text-orange-500" />;
    return <Bot className="h-4 w-4 text-emerald-600" />;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CALLS = Array.from({ length: 24 }, (_, i) => {
    const tags = ['SCHEDULING', 'BILLING', 'FAQ', 'INSURANCE', 'PRESCRIPTION_REFILL', 'HUMAN_TRANSFER', 'VOICEMAIL'];
    const tag = tags[i % tags.length];
    const resolvedByAI = !['HUMAN_TRANSFER', 'VOICEMAIL', 'EMERGENCY'].includes(tag);
    const names = [null, 'Maria Torres', 'James Okafor', null, 'Sophia Lin', 'David Chen', null, 'Priya Patel'];
    return {
        id: `call-${i + 1}`,
        callerName: names[i % names.length],
        callerPhone: `(555) ${String(Math.floor(Math.random() * 900 + 100))}-${String(Math.floor(Math.random() * 9000 + 1000))}`,
        tag,
        status: 'COMPLETED',
        duration: Math.floor(Math.random() * 240 + 30),
        resolvedByAI,
        turnCount: Math.floor(Math.random() * 3) + 1,
        startedAt: new Date(Date.now() - (i * 28 + Math.random() * 20) * 60 * 1000).toISOString(),
    };
});

const ALL_TAGS = ['all', ...Object.keys(TAG_LABEL)];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallLogsPage() {
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState('all');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const filtered = MOCK_CALLS.filter(call => {
        const matchesSearch = !search
            || (call.callerName?.toLowerCase().includes(search.toLowerCase()))
            || call.callerPhone.includes(search);
        const matchesTag = tagFilter === 'all' || call.tag === tagFilter;
        return matchesSearch && matchesTag;
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search caller name or number..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                </div>

                {/* Tag filter */}
                <div className="flex gap-1 flex-wrap">
                    {['all', 'SCHEDULING', 'BILLING', 'FAQ', 'HUMAN_TRANSFER', 'VOICEMAIL'].map(t => (
                        <button
                            key={t}
                            onClick={() => { setTagFilter(t); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                tagFilter === t
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            {t === 'all' ? 'All' : TAG_LABEL[t]}
                        </button>
                    ))}
                </div>

                <Button variant="ghost" className="h-9 shrink-0">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>
            </div>

            {/* Summary row */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span><strong className="text-foreground">{filtered.length}</strong> calls</span>
                <span>·</span>
                <span className="text-emerald-600">
                    <strong>{filtered.filter(c => c.resolvedByAI).length}</strong> resolved by AI
                </span>
                <span>·</span>
                <span className="text-orange-600">
                    <strong>{filtered.filter(c => !c.resolvedByAI).length}</strong> escalated
                </span>
            </div>

            {/* Table */}
            <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Caller</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Turns</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outcome</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Duration</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Time</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map(call => (
                                <tr key={call.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                                                call.resolvedByAI ? 'bg-emerald-100' : 'bg-orange-100'
                                            }`}>
                                                <OutcomeIcon tag={call.tag} resolvedByAI={call.resolvedByAI} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground text-xs">{call.callerName ?? call.callerPhone}</p>
                                                {call.callerName && (
                                                    <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {call.tag ? (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TAG_COLOR[call.tag] ?? 'bg-muted text-muted-foreground'}`}>
                                                {TAG_LABEL[call.tag] ?? call.tag}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-muted-foreground">{call.turnCount}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            call.resolvedByAI ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {call.resolvedByAI ? 'AI Resolved' : 'Escalated'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDuration(call.duration)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link href={`/dashboard/calls/${call.id}`} className="text-primary hover:underline text-xs">
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                className="h-8"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-8"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
