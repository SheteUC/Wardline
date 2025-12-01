"use client";

import React, { useMemo, useState } from 'react';
import {
    Activity, AlertTriangle, Calendar, Download
} from 'lucide-react';
import {
    ComposedChart, LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Card, StatCard, Button } from "@/components/dashboard/shared";
import { useCallAnalytics } from '@/lib/hooks/query-hooks';
import { useHospital } from '@/lib/hospital-context';
import { subDays, format } from 'date-fns';

const COLORS = {
    primary: 'oklch(0.25 0.02 35)',
    secondary: 'oklch(0.45 0.02 35)',
    danger: 'oklch(0.65 0.18 25)',
    warning: 'oklch(0.55 0.15 45)',
    success: '#10b981',
    bg: 'oklch(0.96 0.01 90)'
};

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

export default function AnalyticsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const [activeTab, setActiveTab] = useState('ops');
    const [dateRange, setDateRange] = useState('7d');

    // Calculate date range
    const { startDate, endDate } = useMemo(() => {
        const end = new Date();
        let start = new Date();

        if (dateRange === 'today') {
            start.setHours(0, 0, 0, 0);
        } else if (dateRange === '7d') {
            start = subDays(end, 7);
        } else if (dateRange === '30d') {
            start = subDays(end, 30);
        }

        return { startDate: start, endDate: end };
    }, [dateRange]);

    // Fetch analytics data
    const { data: analytics, isLoading, error } = useCallAnalytics(startDate, endDate);

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors font-medium text-sm
        ${activeTab === id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    if (hospitalLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-muted-foreground">Loading...</div>
                </div>
            </div>
        );
    }

    if (!hospitalId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">No Hospital Selected</h2>
                    <p className="text-muted-foreground max-w-md">
                        Please set up your hospital to view analytics.
                    </p>
                </div>
                <a href="/dashboard/settings">
                    <Button>Set Up Hospital</Button>
                </a>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-muted-foreground">Loading analytics...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border pb-1">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <TabButton id="ops" label="Operations" icon={Activity} />
                    <TabButton id="performance" label="Performance" icon={AlertTriangle} />
                    <TabButton id="intents" label="Intent Analysis" icon={Calendar} />
                </nav>
                <div className="flex items-center gap-2 mb-2 lg:mb-0">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="text-sm border border-border rounded-lg p-2 bg-card focus:ring-2 focus:ring-ring focus:outline-none">
                        <option value="today">Today</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                    <Button variant="secondary" icon={Download}>Export Report</Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-muted-foreground">Loading analytics data...</div>
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-red-600">Error loading analytics. Please try again.</div>
                </div>
            ) : !analytics ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-muted-foreground">No analytics data available</div>
                </div>
            ) : (
                <>
                    {/* OPERATIONS TAB */}
                    {activeTab === 'ops' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <StatCard
                                    label="Total Calls"
                                    value={analytics.totalCalls.toString()}
                                    icon={Activity}
                                    trendValue={`${analytics.completedCalls} completed`}
                                    trend="up"
                                />
                                <StatCard
                                    label="Avg Duration"
                                    value={formatDuration(analytics.averageDuration)}
                                    icon={Calendar}
                                />
                                <StatCard
                                    label="Abandon Rate"
                                    value={`${(analytics.abandonRate || 0).toFixed(1)}%`}
                                    icon={AlertTriangle}
                                    alert={(analytics.abandonRate || 0) > 5}
                                    trend={(analytics.abandonRate || 0) > 5 ? 'up' : 'down'}
                                />
                                <StatCard
                                    label="Emergencies"
                                    value={(analytics.emergencyFlags || 0).toString()}
                                    icon={AlertTriangle}
                                    alert={(analytics.activeEmergencies || 0) > 0}
                                    trendValue={`${analytics.activeEmergencies || 0} active`}
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card title="Call Volume by Hour" className="min-h-[400px]">
                                    {analytics.callVolumeByHour && analytics.callVolumeByHour.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={350}>
                                            <AreaChart data={analytics.callVolumeByHour}>
                                                <defs>
                                                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <RechartsTooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="calls"
                                                    stroke={COLORS.primary}
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorCalls)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                            No call volume data available
                                        </div>
                                    )}
                                </Card>

                                <Card title="Sentiment Analysis" className="min-h-[400px]">
                                    {analytics.sentimentTrend && analytics.sentimentTrend.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={350}>
                                            <LineChart data={analytics.sentimentTrend}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                <RechartsTooltip />
                                                <Legend />
                                                <Line type="monotone" dataKey="positive" stroke={COLORS.success} strokeWidth={2} />
                                                <Line type="monotone" dataKey="neutral" stroke={COLORS.secondary} strokeWidth={2} />
                                                <Line type="monotone" dataKey="negative" stroke={COLORS.danger} strokeWidth={2} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                            No sentiment data available
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* PERFORMANCE TAB */}
                    {activeTab === 'performance' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard
                                    label="Completed Calls"
                                    value={analytics.completedCalls.toString()}
                                    trend="up"
                                    trendValue={`${((analytics.completedCalls / analytics.totalCalls) * 100).toFixed(1)}%`}
                                    icon={Activity}
                                />
                                <StatCard
                                    label="Abandoned Calls"
                                    value={analytics.abandonedCalls.toString()}
                                    trend="down"
                                    trendValue={`${(analytics.abandonRate || 0).toFixed(1)}%`}
                                    icon={AlertTriangle}
                                    alert
                                />
                                <StatCard
                                    label="Avg Hold Time"
                                    value={formatDuration(analytics.averageHoldTime || 0)}
                                    icon={Calendar}
                                />
                            </div>

                            <Card title="Performance Metrics" className="min-h-[400px]">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                                    <div className="bg-muted p-4 rounded-lg">
                                        <div className="text-xs text-muted-foreground uppercase font-bold">Total Calls</div>
                                        <div className="text-2xl font-bold text-foreground mt-1">{analytics.totalCalls}</div>
                                    </div>
                                    <div className="bg-muted p-4 rounded-lg">
                                        <div className="text-xs text-muted-foreground uppercase font-bold">Completed</div>
                                        <div className="text-2xl font-bold text-emerald-600 mt-1">{analytics.completedCalls}</div>
                                    </div>
                                    <div className="bg-muted p-4 rounded-lg">
                                        <div className="text-xs text-muted-foreground uppercase font-bold">Abandoned</div>
                                        <div className="text-2xl font-bold text-red-600 mt-1">{analytics.abandonedCalls}</div>
                                    </div>
                                    <div className="bg-muted p-4 rounded-lg">
                                        <div className="text-xs text-muted-foreground uppercase font-bold">Emergencies</div>
                                        <div className="text-2xl font-bold text-warning mt-1">{analytics.emergencyFlags}</div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* INTENT ANALYSIS TAB */}
                    {activeTab === 'intents' && (
                        <div className="space-y-6">
                            <Card title="Intent Breakdown" className="min-h-[400px]">
                                {analytics.intentBreakdown && analytics.intentBreakdown.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <PieChart>
                                                    <Pie
                                                        data={analytics.intentBreakdown}
                                                        dataKey="count"
                                                        nameKey="intent"
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={100}
                                                        label
                                                    >
                                                        {analytics.intentBreakdown.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={[COLORS.primary, COLORS.secondary, COLORS.warning, COLORS.success][index % 4]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-4">
                                            {analytics.intentBreakdown.map((intent, index) => (
                                                <div key={index} className="flex justify-between items-center pb-2 border-b border-border">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: [COLORS.primary, COLORS.secondary, COLORS.warning, COLORS.success][index % 4] }}
                                                        ></div>
                                                        <span className="font-medium">{intent.intent}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold">{intent.count}</div>
                                                        <div className="text-xs text-muted-foreground">{intent.percentage.toFixed(1)}%</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-96 text-muted-foreground">
                                        No intent data available
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
