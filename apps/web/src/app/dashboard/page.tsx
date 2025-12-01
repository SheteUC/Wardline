"use client";

import React, { useMemo } from 'react';
import {
    Phone, Clock, LogOut, AlertTriangle, CheckCircle
} from 'lucide-react';
import {
    AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';
import { Card, StatCard, Badge, Button } from "@/components/dashboard/shared";
import Link from 'next/link';
import { useCalls, useCallAnalytics } from '@/lib/hooks/query-hooks';
import { useHospital } from '@/lib/hospital-context';
import { CallStatus } from '@wardline/types';
import { formatDistanceToNow } from 'date-fns';

const COLORS = {
    primary: 'oklch(0.25 0.02 35)', // dark charcoal
    secondary: 'oklch(0.45 0.02 35)', // muted charcoal
    danger: 'oklch(0.65 0.18 25)', // destructive
    warning: 'oklch(0.55 0.15 45)', // burnt orange
    success: '#10b981', // emerald-500
    bg: 'oklch(0.96 0.01 90)' // warm beige
};

const INTENT_COLORS = [
    'oklch(0.25 0.02 35)',
    'oklch(0.45 0.02 35)',
    'oklch(0.65 0.18 25)',
    'oklch(0.55 0.15 45)',
];

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function DashboardPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();

    // Get today's date range
    const today = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }, []);

    // Fetch recent calls (last 10)
    const { data: callsData, isLoading: callsLoading } = useCalls({
        pageSize: 10,
        page: 1,
    });

    // Fetch analytics for today
    const { data: analytics, isLoading: analyticsLoading } = useCallAnalytics(
        today.start,
        today.end
    );

    const isLoading = hospitalLoading || callsLoading || analyticsLoading;

    // Process analytics data for charts
    const callVolumeData = useMemo(() => {
        if (!analytics?.callVolumeByHour) return [];
        return analytics.callVolumeByHour.map(item => ({
            time: item.hour,
            calls: item.calls,
            sentiment: item.sentiment || 0,
        }));
    }, [analytics]);

    const intentData = useMemo(() => {
        if (!analytics?.intentBreakdown) return [];
        return analytics.intentBreakdown.map((item, index) => ({
            name: item.intent,
            value: item.count,
            color: INTENT_COLORS[index % INTENT_COLORS.length],
        }));
    }, [analytics]);

    const recentCalls = useMemo(() => {
        if (!callsData?.data) return [];
        return callsData.data.map(call => ({
            id: call.id,
            caller: call.callerPhone,
            name: call.callerName || 'Unknown',
            time: formatDistanceToNow(new Date(call.createdAt), { addSuffix: true }),
            duration: formatDuration(call.duration),
            intent: call.detectedIntent || 'Unknown',
            status: call.status,
            sentiment: call.sentiment || 'N/A',
            emergency: call.wasEmergency,
        }));
    }, [callsData]);

    // Loading state
    if (hospitalLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
                    ))}
                </div>
                <div className="text-center py-12 text-muted-foreground">
                    Loading...
                </div>
            </div>
        );
    }

    // No hospital selected
    if (!hospitalId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">Welcome to Wardline</h2>
                    <p className="text-muted-foreground max-w-md">
                        To get started, you need to set up your hospital. This will allow you to manage calls, appointments, and more.
                    </p>
                </div>
                <Link href="/dashboard/settings">
                    <Button>Set Up Hospital</Button>
                </Link>
            </div>
        );
    }

    // Still loading data
    if (callsLoading || analyticsLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
                    ))}
                </div>
                <div className="text-center py-12 text-muted-foreground">
                    Loading dashboard data...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Calls Today"
                    value={analytics?.totalCalls?.toString() || '0'}
                    trendValue={`${analytics?.completedCalls || 0} completed`}
                    trend="up"
                    icon={Phone}
                />
                <StatCard
                    label="Avg Duration"
                    value={formatDuration(analytics?.averageDuration || 0)}
                    trendValue={`${analytics?.abandonedCalls || 0} abandoned`}
                    trend="down"
                    icon={Clock}
                />
                <StatCard
                    label="Abandon Rate"
                    value={`${(analytics?.abandonRate || 0).toFixed(1)}%`}
                    trendValue={analytics?.abandonRate && analytics.abandonRate > 5 ? 'Above target' : 'Within target'}
                    trend={analytics?.abandonRate && analytics.abandonRate > 5 ? 'up' : 'down'}
                    icon={LogOut}
                />
                <StatCard
                    label="Emergency Flags"
                    value={analytics?.emergencyFlags?.toString() || '0'}
                    trendValue={`${analytics?.activeEmergencies || 0} Active`}
                    icon={AlertTriangle}
                    alert={!!analytics?.activeEmergencies && analytics.activeEmergencies > 0}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Call Volume & Sentiment" className="lg:col-span-2 min-h-[350px]">
                    {callVolumeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={callVolumeData}>
                                <defs>
                                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.88 0.01 90)" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.45 0.02 35)', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.45 0.02 35)', fontSize: 12 }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="calls" stroke={COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                            No call data available for today
                        </div>
                    )}
                </Card>

                <Card title="Intent Breakdown" className="min-h-[350px]">
                    {intentData.length > 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={intentData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {intentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-full mt-4 space-y-3">
                                {intentData.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-muted-foreground">{item.name}</span>
                                        </div>
                                        <span className="font-medium text-foreground">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No intent data available
                        </div>
                    )}
                </Card>
            </div>

            {/* Live Status & Recent Calls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Live Status" className="lg:col-span-1">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Agents Online</span>
                            <span className="text-lg font-bold text-foreground">-</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Queue Length</span>
                            <span className="text-lg font-bold text-foreground">-</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Est. Wait</span>
                            <span className="text-lg font-bold text-foreground">-</span>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-border">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">System Health</h4>
                        <div className="flex items-center text-sm text-emerald-600">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Telephony Gateway Operational
                        </div>
                    </div>
                </Card>

                <Card title="Recent Calls" className="lg:col-span-2"
                    action={<Link href="/dashboard/calls"><Button variant="ghost" className="text-xs">View All</Button></Link>}>
                    {recentCalls.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Caller</th>
                                        <th className="px-4 py-3 font-medium">Intent</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium text-right">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentCalls.map((call) => (
                                        <tr key={call.id} className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{call.name}</div>
                                                <div className="text-xs text-muted-foreground">{call.caller}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge type={call.emergency ? 'danger' : 'primary'} text={call.intent} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`flex items-center ${call.status === CallStatus.COMPLETED ? 'text-emerald-600' :
                                                        call.status === CallStatus.ABANDONED ? 'text-red-600' :
                                                            'text-muted-foreground'
                                                    }`}>
                                                    {call.status === CallStatus.ABANDONED && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                    {call.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground font-mono">
                                                {call.duration}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-muted-foreground">
                            No recent calls
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
