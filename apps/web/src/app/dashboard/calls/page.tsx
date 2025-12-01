"use client";

import React, { useState } from 'react';
import {
    Search, Filter, Download, ChevronRight
} from 'lucide-react';
import { Card, Badge, Button } from "@/components/dashboard/shared";
import Link from 'next/link';
import { useCalls } from '@/lib/hooks/query-hooks';
import { useHospital } from '@/lib/hospital-context';
import { formatDistanceToNow } from 'date-fns';
import { CallStatus } from '@wardline/types';

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSentimentDisplay(sentiment: string | undefined, score?: number) {
    if (!sentiment) return { label: '-', color: 'text-muted-foreground', dotColor: 'bg-muted' };

    if (sentiment === 'positive') return { label: 'High', color: 'text-foreground', dotColor: 'bg-emerald-500' };
    if (sentiment === 'negative') return { label: 'Low', color: 'text-foreground', dotColor: 'bg-red-500' };
    return { label: 'Neutral', color: 'text-foreground', dotColor: 'bg-muted-foreground' };
}

export default function CallsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);

    // Fetch calls with filters
    const { data: callsData, isLoading, error } = useCalls({
        status: filter === 'completed' ? CallStatus.COMPLETED :
            filter === 'abandoned' ? CallStatus.ABANDONED : undefined,
        search: searchQuery || undefined,
        page,
        pageSize: 20,
    });

    const filteredCalls = React.useMemo(() => {
        if (!callsData?.data) return [];

        let filtered = callsData.data;

        if (filter === 'emergency') {
            filtered = filtered.filter(call => call.wasEmergency);
        }

        return filtered;
    }, [callsData, filter]);

    if (hospitalLoading) {
        return (
            <div className="space-y-6">
                <Card className="min-h-[600px]">
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-muted-foreground">Loading...</div>
                    </div>
                </Card>
            </div>
        );
    }

    if (!hospitalId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">No Hospital Selected</h2>
                    <p className="text-muted-foreground max-w-md">
                        Please set up your hospital to view call data.
                    </p>
                </div>
                <Link href="/dashboard/settings">
                    <Button>Set Up Hospital</Button>
                </Link>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Card className="min-h-[600px]">
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-muted-foreground">Loading calls...</div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="min-h-[600px]">
                {/* Filters & Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit">
                        {['all', 'emergency', 'completed', 'abandoned'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all
                    ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
                  `}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by phone or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring w-full md:w-64"
                            />
                        </div>
                        <Button variant="secondary" icon={Filter} className="hidden md:flex">Filters</Button>
                        <Button variant="secondary" icon={Download} className="hidden md:flex">Export</Button>
                    </div>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-muted-foreground">Loading calls...</div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-red-600">Error loading calls. Please try again.</div>
                    </div>
                ) : filteredCalls.length === 0 ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-muted-foreground">No calls found</div>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Time / Date</th>
                                        <th className="px-6 py-4 font-medium">Caller</th>
                                        <th className="px-6 py-4 font-medium">Intent Detected</th>
                                        <th className="px-6 py-4 font-medium">Sentiment</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium text-right">Duration</th>
                                        <th className="px-6 py-4 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredCalls.map((call) => {
                                        const callDate = new Date(call.createdAt);
                                        const sentiment = getSentimentDisplay(call.sentiment, call.sentimentScore);

                                        return (
                                            <tr key={call.id} className="hover:bg-muted/50 transition-colors group">
                                                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                    <div className="font-medium text-foreground">
                                                        {formatDistanceToNow(callDate, { addSuffix: true })}
                                                    </div>
                                                    <div className="text-xs">
                                                        {callDate.toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs">
                                                            {call.callerName?.charAt(0) || 'U'}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-foreground">
                                                                {call.callerName || 'Unknown'}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">{call.callerPhone}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge
                                                        type={call.wasEmergency ? 'danger' : 'primary'}
                                                        text={call.detectedIntent || 'Unknown'}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${sentiment.dotColor}`}></div>
                                                        <span className={sentiment.color}>{sentiment.label}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${call.status === CallStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                            call.status === CallStatus.ABANDONED ? 'bg-muted text-muted-foreground border border-border' :
                                                                call.status === CallStatus.FAILED ? 'bg-red-50 text-red-700 border border-red-100' :
                                                                    'bg-blue-50 text-blue-700 border border-blue-100'
                                                        }
                        `}>
                                                        {call.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                                                    {formatDuration(call.duration)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link href={`/dashboard/calls/${call.id}`}>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between pt-6 border-t border-border mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing <span className="font-medium">{(page - 1) * 20 + 1}-{Math.min(page * 20, callsData?.total || 0)}</span> of <span className="font-medium">{callsData?.total || 0}</span> results
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    className="h-8 px-3 text-xs"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="h-8 px-3 text-xs"
                                    disabled={!callsData || page * 20 >= callsData.total}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}
