"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Phone, AlertTriangle, Clock, Users, TrendingUp, TrendingDown,
    ChevronRight, ExternalLink, RefreshCw, Smile, Meh, Frown,
    Activity, CheckCircle, XCircle, Headphones, UserPlus, Filter,
    ArrowUpRight, PhoneOff, MessageSquare, Zap
} from 'lucide-react';
import { format, formatDistanceToNow, subHours, subMinutes } from 'date-fns';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import type {
    LiveCallStatus,
    EscalatedCall,
    CallSummaryEntry,
    CallCenterMetrics,
    CallVolumeDataPoint,
    AgentInfo
} from '@/lib/patient-types';

/**
 * Call Center Admin Dashboard
 * Command center for real-time call monitoring and management
 */

// Mock data for demonstration
const mockLiveCalls: LiveCallStatus[] = [
    {
        id: 'call-001',
        callerId: '+1 (555) 123-4567',
        callerName: 'John Smith',
        intent: 'Appointment Scheduling',
        sentimentTrend: 'positive',
        sentimentScore: 0.75,
        state: 'with_ai',
        duration: 127,
        startedAt: subMinutes(new Date(), 2).toISOString(),
    },
    {
        id: 'call-002',
        callerId: '+1 (555) 234-5678',
        callerName: 'Mary Johnson',
        intent: 'Prescription Refill',
        sentimentTrend: 'neutral',
        sentimentScore: 0.5,
        state: 'with_ai',
        duration: 89,
        startedAt: subMinutes(new Date(), 1.5).toISOString(),
    },
    {
        id: 'call-003',
        callerId: '+1 (555) 345-6789',
        callerName: 'Robert Davis',
        intent: 'Billing Question',
        sentimentTrend: 'negative',
        sentimentScore: 0.25,
        state: 'queued',
        duration: 245,
        startedAt: subMinutes(new Date(), 4).toISOString(),
    },
    {
        id: 'call-004',
        callerId: '+1 (555) 456-7890',
        callerName: 'Sarah Wilson',
        intent: 'Insurance Verification',
        sentimentTrend: 'positive',
        sentimentScore: 0.8,
        state: 'with_agent',
        duration: 312,
        agentId: 'agent-001',
        agentName: 'Mike Chen',
        startedAt: subMinutes(new Date(), 5).toISOString(),
    },
];

const mockEscalatedCalls: EscalatedCall[] = [
    {
        id: 'esc-001',
        callerId: '+1 (555) 345-6789',
        callerName: 'Robert Davis',
        escalationType: 'negative_sentiment',
        summary: 'Caller frustrated about billing discrepancy. Has been charged twice for the same service and requesting immediate resolution.',
        tag: 'Billing',
        sentimentScore: 0.2,
        sentimentLabel: 'negative',
        queuedAt: subMinutes(new Date(), 3).toISOString(),
        status: 'pending',
    },
    {
        id: 'esc-002',
        callerId: '+1 (555) 567-8901',
        callerName: 'Emily Brown',
        escalationType: 'clinical',
        summary: 'Patient reporting severe chest pain and shortness of breath. Requires immediate clinical assessment.',
        tag: 'Clinical',
        sentimentScore: 0.3,
        sentimentLabel: 'negative',
        queuedAt: subMinutes(new Date(), 1).toISOString(),
        status: 'pending',
    },
    {
        id: 'esc-003',
        callerId: '+1 (555) 678-9012',
        callerName: 'David Miller',
        escalationType: 'low_confidence',
        summary: 'Complex insurance question about out-of-network coverage that AI could not resolve with confidence.',
        tag: 'Insurance',
        sentimentScore: 0.5,
        sentimentLabel: 'neutral',
        queuedAt: subMinutes(new Date(), 8).toISOString(),
        assignedAgentId: 'agent-002',
        assignedAgentName: 'Lisa Park',
        status: 'assigned',
    },
];

const mockCallSummaries: CallSummaryEntry[] = [
    {
        id: 'sum-001',
        timestamp: subMinutes(new Date(), 15).toISOString(),
        summary: 'Patient called to schedule annual physical exam. Appointment booked for Dec 15 at 10:00 AM with Dr. Chen.',
        intent: 'Scheduling',
        tag: 'Appointments',
        sentimentScore: 0.85,
        sentimentLabel: 'positive',
        outcome: 'resolved',
        duration: 180,
    },
    {
        id: 'sum-002',
        timestamp: subMinutes(new Date(), 25).toISOString(),
        summary: 'Caller requested prescription refill for blood pressure medication. Forwarded to pharmacy for processing.',
        intent: 'Prescription',
        tag: 'Refill',
        sentimentScore: 0.7,
        sentimentLabel: 'positive',
        outcome: 'resolved',
        duration: 120,
    },
    {
        id: 'sum-003',
        timestamp: subMinutes(new Date(), 35).toISOString(),
        summary: 'Patient had questions about insurance coverage for upcoming procedure. Transferred to billing specialist.',
        intent: 'Insurance',
        tag: 'Billing',
        sentimentScore: 0.4,
        sentimentLabel: 'neutral',
        outcome: 'escalated',
        duration: 240,
    },
    {
        id: 'sum-004',
        timestamp: subMinutes(new Date(), 45).toISOString(),
        summary: 'Caller hung up during hold time while waiting for agent.',
        intent: 'Unknown',
        sentimentScore: 0.3,
        sentimentLabel: 'negative',
        outcome: 'abandoned',
        duration: 180,
    },
];

const mockMetrics: CallCenterMetrics = {
    averageWaitTime: 45,
    escalatedCallsLastHour: 7,
    callsWaitingForHuman: 3,
    totalCallsToday: 247,
    resolvedCallsToday: 218,
    abandonedCallsToday: 12,
};

const mockAgents: AgentInfo[] = [
    { id: 'agent-001', name: 'Mike Chen', status: 'busy', currentCallId: 'call-004' },
    { id: 'agent-002', name: 'Lisa Park', status: 'busy', currentCallId: 'esc-003' },
    { id: 'agent-003', name: 'James Wilson', status: 'available' },
    { id: 'agent-004', name: 'Anna Garcia', status: 'offline' },
];

const mockCallVolumeData: CallVolumeDataPoint[] = Array.from({ length: 12 }, (_, i) => ({
    time: format(subHours(new Date(), 11 - i), 'h a'),
    calls: Math.floor(Math.random() * 30) + 10,
    escalations: Math.floor(Math.random() * 5),
}));

export default function CallCenterDashboardPage() {
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'negative'>('all');
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Simulate auto-refresh
    useEffect(() => {
        const interval = setInterval(() => {
            setLastRefresh(new Date());
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setLastRefresh(new Date());
            setIsRefreshing(false);
        }, 500);
    };

    const filteredSummaries = selectedFilter === 'negative'
        ? mockCallSummaries.filter(s => s.sentimentLabel === 'negative')
        : mockCallSummaries;

    return (
        <div className="space-y-6">
            {/* Performance Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={Clock}
                    label="Avg Wait Time"
                    value={`${mockMetrics.averageWaitTime}s`}
                    color="amber"
                    trend={mockMetrics.averageWaitTime > 60 ? 'up' : 'down'}
                    trendLabel={mockMetrics.averageWaitTime > 60 ? 'Above target' : 'Within target'}
                />
                <MetricCard
                    icon={AlertTriangle}
                    label="Escalated (1hr)"
                    value={mockMetrics.escalatedCallsLastHour}
                    color="rose"
                />
                <MetricCard
                    icon={Users}
                    label="Waiting for Human"
                    value={mockMetrics.callsWaitingForHuman}
                    color="indigo"
                    alert={mockMetrics.callsWaitingForHuman > 5}
                />
                <MetricCard
                    icon={CheckCircle}
                    label="Resolved Today"
                    value={`${mockMetrics.resolvedCallsToday}/${mockMetrics.totalCallsToday}`}
                    color="emerald"
                    subtext={`${Math.round((mockMetrics.resolvedCallsToday / mockMetrics.totalCallsToday) * 100)}% resolution rate`}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Real-time Call Status */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-border shadow-sm">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-50 p-2 rounded-lg">
                                <Phone className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-foreground">Real-time Call Status</h2>
                                <p className="text-xs text-muted-foreground">
                                    {mockLiveCalls.length} active calls
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                                Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                            </span>
                            <button 
                                onClick={handleRefresh}
                                className={`p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-muted-foreground border-b border-border">
                                        <th className="pb-3 font-medium">Caller</th>
                                        <th className="pb-3 font-medium">Intent</th>
                                        <th className="pb-3 font-medium">Sentiment</th>
                                        <th className="pb-3 font-medium">State</th>
                                        <th className="pb-3 font-medium">Duration</th>
                                        <th className="pb-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {mockLiveCalls.map((call) => (
                                        <tr key={call.id} className="hover:bg-muted/30">
                                            <td className="py-3">
                                                <div className="font-medium text-foreground">{call.callerName || 'Unknown'}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{call.callerId}</div>
                                            </td>
                                            <td className="py-3">
                                                <span className="px-2 py-1 bg-muted text-foreground text-xs rounded">
                                                    {call.intent || 'Detecting...'}
                                                </span>
                                            </td>
                                            <td className="py-3">
                                                <SentimentIndicator sentiment={call.sentimentTrend} score={call.sentimentScore} />
                                            </td>
                                            <td className="py-3">
                                                <CallStateIndicator state={call.state} agentName={call.agentName} />
                                            </td>
                                            <td className="py-3 font-mono text-muted-foreground">
                                                {formatDuration(call.duration)}
                                            </td>
                                            <td className="py-3 text-right">
                                                <button
                                                    className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                    title="Open Call Detail"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Agent Status */}
                <div className="bg-white rounded-xl border border-border shadow-sm">
                    <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 p-2 rounded-lg">
                                <Headphones className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h2 className="font-semibold text-foreground">Agent Status</h2>
                        </div>
                    </div>
                    <div className="p-4 space-y-3">
                        {mockAgents.map((agent) => (
                            <div 
                                key={agent.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${
                                        agent.status === 'available' ? 'bg-emerald-500' :
                                        agent.status === 'busy' ? 'bg-amber-500' :
                                        'bg-muted-foreground'
                                    }`} />
                                    <span className="font-medium text-sm">{agent.name}</span>
                                </div>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                    agent.status === 'available' ? 'bg-emerald-50 text-emerald-700' :
                                    agent.status === 'busy' ? 'bg-amber-50 text-amber-700' :
                                    'bg-muted text-muted-foreground'
                                }`}>
                                    {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Escalated Calls Queue */}
            <div className="bg-white rounded-xl border border-rose-200 shadow-sm">
                <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-rose-900">Escalated Calls Queue</h2>
                            <p className="text-xs text-rose-600">
                                {mockEscalatedCalls.filter(c => c.status === 'pending').length} pending attention
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/admin/call-center/escalations"
                        className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                    >
                        View All
                    </Link>
                </div>
                <div className="p-4">
                    <div className="space-y-4">
                        {mockEscalatedCalls.map((call) => (
                            <EscalatedCallCard 
                                key={call.id} 
                                call={call} 
                                agents={mockAgents.filter(a => a.status === 'available')}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Call Summaries & Sentiment + Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Call Volume Chart */}
                <div className="bg-white rounded-xl border border-border shadow-sm">
                    <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="bg-cyan-50 p-2 rounded-lg">
                                <Activity className="w-5 h-5 text-cyan-600" />
                            </div>
                            <h2 className="font-semibold text-foreground">Calls vs Escalations</h2>
                        </div>
                    </div>
                    <div className="p-4">
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={mockCallVolumeData}>
                                <defs>
                                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorEsc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="calls" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" name="Calls" />
                                <Area type="monotone" dataKey="escalations" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorEsc)" name="Escalations" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Call Summaries */}
                <div className="bg-white rounded-xl border border-border shadow-sm">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-50 p-2 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-purple-600" />
                            </div>
                            <h2 className="font-semibold text-foreground">Recent Call Summaries</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedFilter('all')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                    selectedFilter === 'all' 
                                        ? 'bg-foreground text-background' 
                                        : 'text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setSelectedFilter('negative')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                    selectedFilter === 'negative' 
                                        ? 'bg-rose-600 text-white' 
                                        : 'text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                Negative Only
                            </button>
                        </div>
                    </div>
                    <div className="p-4 max-h-[350px] overflow-y-auto">
                        <div className="space-y-3">
                            {filteredSummaries.map((summary) => (
                                <Link
                                    key={summary.id}
                                    href={`/dashboard/calls/${summary.id}`}
                                    className="block p-3 border border-border rounded-lg hover:border-purple-200 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-foreground line-clamp-2">
                                                {summary.summary}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(summary.timestamp), { addSuffix: true })}
                                                </span>
                                                {summary.tag && (
                                                    <span className="px-2 py-0.5 bg-muted text-xs rounded">
                                                        {summary.tag}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <SentimentIndicator sentiment={summary.sentimentLabel} score={summary.sentimentScore} small />
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                summary.outcome === 'resolved' ? 'bg-emerald-50 text-emerald-700' :
                                                summary.outcome === 'escalated' ? 'bg-amber-50 text-amber-700' :
                                                'bg-red-50 text-red-700'
                                            }`}>
                                                {summary.outcome.charAt(0).toUpperCase() + summary.outcome.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper Components

function MetricCard({ 
    icon: Icon, 
    label, 
    value, 
    color, 
    trend,
    trendLabel,
    subtext,
    alert
}: { 
    icon: React.ElementType; 
    label: string; 
    value: string | number; 
    color: 'amber' | 'rose' | 'indigo' | 'emerald';
    trend?: 'up' | 'down';
    trendLabel?: string;
    subtext?: string;
    alert?: boolean;
}) {
    const colorClasses = {
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div className={`bg-white rounded-xl border p-4 shadow-sm ${
            alert ? 'border-rose-200 bg-rose-50/30' : 'border-border'
        }`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-4 h-4" />
                </div>
                {trend && (
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        trend === 'up' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trendLabel}
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
    );
}

function SentimentIndicator({ 
    sentiment, 
    score,
    small = false 
}: { 
    sentiment: 'positive' | 'neutral' | 'negative'; 
    score?: number;
    small?: boolean;
}) {
    const config = {
        positive: { icon: Smile, bg: 'bg-emerald-50', text: 'text-emerald-600' },
        neutral: { icon: Meh, bg: 'bg-amber-50', text: 'text-amber-600' },
        negative: { icon: Frown, bg: 'bg-rose-50', text: 'text-rose-600' },
    };
    const { icon: Icon, bg, text } = config[sentiment];

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${bg}`}>
            <Icon className={`${small ? 'w-3 h-3' : 'w-4 h-4'} ${text}`} />
            {score !== undefined && !small && (
                <span className={`text-xs font-medium ${text}`}>
                    {Math.round(score * 100)}%
                </span>
            )}
        </div>
    );
}

function CallStateIndicator({ 
    state, 
    agentName 
}: { 
    state: 'with_ai' | 'queued' | 'with_agent'; 
    agentName?: string;
}) {
    const config = {
        with_ai: { label: 'With AI', bg: 'bg-cyan-50', text: 'text-cyan-700' },
        queued: { label: 'Queued', bg: 'bg-amber-50', text: 'text-amber-700' },
        with_agent: { label: agentName || 'With Agent', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    };
    const { label, bg, text } = config[state];

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${bg} ${text}`}>
            {label}
        </span>
    );
}

function EscalatedCallCard({ 
    call, 
    agents 
}: { 
    call: EscalatedCall; 
    agents: AgentInfo[];
}) {
    const [showAssign, setShowAssign] = useState(false);

    const typeConfig = {
        clinical: { label: 'Clinical Escalation', bg: 'bg-red-100', text: 'text-red-700' },
        emergency: { label: 'Emergency', bg: 'bg-red-100', text: 'text-red-700' },
        low_confidence: { label: 'Low AI Confidence', bg: 'bg-amber-100', text: 'text-amber-700' },
        negative_sentiment: { label: 'Negative Sentiment', bg: 'bg-rose-100', text: 'text-rose-700' },
    };
    const config = typeConfig[call.escalationType];

    return (
        <div className={`p-4 rounded-xl border ${
            call.status === 'pending' ? 'border-rose-200 bg-rose-50/30' : 'border-border bg-muted/30'
        }`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                            {config.label}
                        </span>
                        {call.tag && (
                            <span className="px-2 py-1 bg-muted text-xs rounded">
                                {call.tag}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-foreground mb-2">{call.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-mono">{call.callerId}</span>
                        <span>{call.callerName}</span>
                        <span>Queued {formatDistanceToNow(new Date(call.queuedAt), { addSuffix: true })}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <SentimentIndicator sentiment={call.sentimentLabel} score={call.sentimentScore} />
                    {call.status === 'pending' ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAssign(!showAssign)}
                                className="px-3 py-1.5 text-xs font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1"
                            >
                                <UserPlus className="w-3 h-3" />
                                Assign
                            </button>
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            Assigned to {call.assignedAgentName}
                        </span>
                    )}
                </div>
            </div>
            
            {showAssign && (
                <div className="mt-3 pt-3 border-t border-rose-200">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Assign to agent:</p>
                    <div className="flex flex-wrap gap-2">
                        {agents.length > 0 ? agents.map((agent) => (
                            <button
                                key={agent.id}
                                onClick={() => {
                                    console.log('Assign to:', agent.name);
                                    setShowAssign(false);
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-white border border-border rounded-lg hover:border-rose-300 transition-colors"
                            >
                                {agent.name}
                            </button>
                        )) : (
                            <span className="text-xs text-muted-foreground">No available agents</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

