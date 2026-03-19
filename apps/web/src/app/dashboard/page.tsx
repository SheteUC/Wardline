'use client';

import React from 'react';
import { Card } from '@/components/dashboard/shared';
import {
    Phone, Bot, Voicemail, CheckCircle, AlertTriangle,
    TrendingUp, Clock, PhoneForwarded, Calendar,
    ChevronRight, Zap,
} from 'lucide-react';
import Link from 'next/link';

// ─── Mock data (replace with API hooks) ──────────────────────────────────────

const STATS = [
    {
        label: 'Calls Today',
        value: '47',
        delta: '+12% vs yesterday',
        positive: true,
        icon: Phone,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
    },
    {
        label: 'AI Resolved',
        value: '41',
        delta: '87% resolution rate',
        positive: true,
        icon: CheckCircle,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
    },
    {
        label: 'Escalated to Human',
        value: '5',
        delta: '11% of calls',
        positive: null,
        icon: PhoneForwarded,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
    },
    {
        label: 'Voicemails',
        value: '1',
        delta: '1 unlistened',
        positive: false,
        icon: Voicemail,
        color: 'text-red-600',
        bg: 'bg-red-50',
    },
];

const RECENT_CALLS = [
    { id: 'c1', callerName: 'Maria Torres', callerPhone: '(555) 203-1842', tag: 'SCHEDULING', status: 'COMPLETED', duration: 142, resolvedByAI: true, startedAt: '2026-03-19T14:22:00Z' },
    { id: 'c2', callerPhone: '(555) 891-4403', tag: 'BILLING', status: 'COMPLETED', duration: 87, resolvedByAI: true, startedAt: '2026-03-19T13:58:00Z' },
    { id: 'c3', callerName: 'James Okafor', callerPhone: '(555) 671-2201', tag: 'HUMAN_TRANSFER', status: 'COMPLETED', duration: 210, resolvedByAI: false, startedAt: '2026-03-19T13:44:00Z' },
    { id: 'c4', callerPhone: '(555) 340-7798', tag: 'PRESCRIPTION_REFILL', status: 'COMPLETED', duration: 95, resolvedByAI: true, startedAt: '2026-03-19T13:31:00Z' },
    { id: 'c5', callerName: 'Sophia Lin', callerPhone: '(555) 112-6634', tag: 'VOICEMAIL', status: 'COMPLETED', duration: 48, resolvedByAI: false, startedAt: '2026-03-19T13:15:00Z' },
];

const AGENT_PERFORMANCE = [
    { catalogId: 'scheduling', name: 'Scheduling', totalCalls: 18, resolutionRate: 89, color: 'bg-green-500' },
    { catalogId: 'faq', name: 'FAQ & Info', totalCalls: 14, resolutionRate: 96, color: 'bg-amber-500' },
    { catalogId: 'billing', name: 'Billing', totalCalls: 9, resolutionRate: 78, color: 'bg-blue-500' },
    { catalogId: 'insurance', name: 'Insurance', totalCalls: 4, resolutionRate: 75, color: 'bg-purple-500' },
    { catalogId: 'prescription-refill', name: 'Prescriptions', totalCalls: 2, resolutionRate: 100, color: 'bg-rose-500' },
];

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

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    return (
        <div className="space-y-6">

            {/* Quick setup banner — shown until all agents configured */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-semibold text-foreground text-sm">2 agents need tool configuration</p>
                        <p className="text-xs text-muted-foreground">Connect your scheduling and billing tools to activate them.</p>
                    </div>
                </div>
                <Link href="/dashboard/agents" className="shrink-0 text-sm font-medium text-primary hover:underline flex items-center gap-1">
                    Configure <ChevronRight className="h-4 w-4" />
                </Link>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map(stat => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{stat.label}</p>
                                <div className={`h-8 w-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                                    <Icon className={`h-4 w-4 ${stat.color}`} />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                            <div className={`text-xs ${
                                stat.positive === true ? 'text-emerald-600' :
                                stat.positive === false ? 'text-red-500' :
                                'text-muted-foreground'
                            }`}>
                                {stat.delta}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Recent Calls */}
                <div className="xl:col-span-2">
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-foreground">Recent Calls</h2>
                            <Link href="/dashboard/calls" className="text-xs text-primary hover:underline flex items-center gap-1">
                                View all <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {RECENT_CALLS.map(call => (
                                <div key={call.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                                            call.resolvedByAI ? 'bg-emerald-100' : 'bg-orange-100'
                                        }`}>
                                            {call.resolvedByAI
                                                ? <Bot className="h-4 w-4 text-emerald-600" />
                                                : <PhoneForwarded className="h-4 w-4 text-orange-600" />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {call.callerName ?? call.callerPhone}
                                            </p>
                                            {call.callerName && (
                                                <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TAG_COLOR[call.tag] ?? 'bg-muted text-muted-foreground'}`}>
                                            {TAG_LABEL[call.tag] ?? call.tag}
                                        </span>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-muted-foreground">{formatTime(call.startedAt)}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDuration(call.duration)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right column */}
                <div className="space-y-4">

                    {/* Agent Performance */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-foreground">Agent Performance</h2>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-3">
                            {AGENT_PERFORMANCE.map(agent => (
                                <div key={agent.catalogId}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-foreground">{agent.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {agent.resolutionRate}% · {agent.totalCalls} calls
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${agent.color}`}
                                            style={{ width: `${agent.resolutionRate}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Unlistened Voicemails */}
                    <Card>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-foreground">Voicemails</h2>
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">1 new</span>
                        </div>
                        <div className="space-y-2">
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-foreground">(555) 112-6634</span>
                                    <span className="text-xs text-muted-foreground">1:15 PM</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Scheduling · Left message about appointment
                                </p>
                            </div>
                        </div>
                        <Link href="/dashboard/voicemails" className="mt-3 block text-xs text-primary hover:underline text-center">
                            View all voicemails
                        </Link>
                    </Card>

                    {/* Quick Links */}
                    <Card>
                        <h2 className="font-semibold text-foreground mb-3">Quick Actions</h2>
                        <div className="space-y-2">
                            <Link href="/dashboard/agents" className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                                <Bot className="h-4 w-4 text-primary" />
                                <span className="text-sm">Manage Agents</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                            </Link>
                            <Link href="/dashboard/workflows" className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <span className="text-sm">Edit Call Flow</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                            </Link>
                            <Link href="/dashboard/calls" className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <span className="text-sm">View Call Logs</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                            </Link>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
