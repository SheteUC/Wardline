"use client";

import React from 'react';
import {
    Phone, Clock, LogOut, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
    AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';
import { Card, StatCard, Badge, Button } from "@/components/dashboard/shared";
import Link from 'next/link';

const COLORS = {
    primary: '#0d9488', // teal-600
    secondary: '#64748b', // slate-500
    danger: '#e11d48', // rose-600
    warning: '#d97706', // amber-600
    success: '#10b981', // emerald-500
    bg: '#f8fafc' // slate-50
};

const MOCK_CALLS_DATA = [
    { time: '09:00', calls: 24, sentiment: 85 },
    { time: '10:00', calls: 45, sentiment: 78 },
    { time: '11:00', calls: 67, sentiment: 72 },
    { time: '12:00', calls: 55, sentiment: 80 },
    { time: '13:00', calls: 30, sentiment: 88 },
    { time: '14:00', calls: 42, sentiment: 82 },
    { time: '15:00', calls: 60, sentiment: 75 },
];

const INTENT_DATA = [
    { name: 'Scheduling', value: 400, color: '#0d9488' },
    { name: 'Billing', value: 300, color: '#64748b' },
    { name: 'Clinical Triage', value: 150, color: '#e11d48' },
    { name: 'Refill', value: 100, color: '#d97706' },
];

const RECENT_CALLS = [
    { id: 101, caller: '(555) 123-4567', name: 'Sarah J.', time: '2 min ago', duration: '4:12', intent: 'Scheduling', status: 'Completed', sentiment: 'High', emergency: false },
    { id: 102, caller: '(555) 987-6543', name: 'Unknown', time: '5 min ago', duration: '1:30', intent: 'Triage', status: 'Escalated', sentiment: 'Low', emergency: true },
    { id: 103, caller: '(555) 456-7890', name: 'Mike R.', time: '12 min ago', duration: '2:45', intent: 'Billing', status: 'Completed', sentiment: 'Neutral', emergency: false },
    { id: 104, caller: '(555) 222-3333', name: 'Elena D.', time: '18 min ago', duration: '0:00', intent: 'Unknown', status: 'Abandoned', sentiment: 'N/A', emergency: false },
];

export default function DashboardPage() {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Calls Today" value="842" trendValue="+12%" trend="up" icon={Phone} />
                <StatCard label="Avg Hold Time" value="45s" trendValue="-5%" trend="down" icon={Clock} alert />
                <StatCard label="Abandon Rate" value="2.1%" trendValue="+0.4%" trend="up" icon={LogOut} />
                <StatCard label="Emergency Flags" value="14" trendValue="3 Active" icon={AlertTriangle} alert />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Call Volume & Sentiment" className="lg:col-span-2 min-h-[350px]">
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={MOCK_CALLS_DATA}>
                            <defs>
                                <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area type="monotone" dataKey="calls" stroke={COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                <Card title="Intent Breakdown" className="min-h-[350px]">
                    <div className="flex flex-col items-center justify-center h-full">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={INTENT_DATA}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {INTENT_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="w-full mt-4 space-y-3">
                            {INTENT_DATA.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-slate-600">{item.name}</span>
                                    </div>
                                    <span className="font-medium text-slate-900">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Live Status & Recent Calls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Live Status" className="lg:col-span-1">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm font-medium text-slate-600">Agents Online</span>
                            <span className="text-lg font-bold text-teal-600">12</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm font-medium text-slate-600">Queue Length</span>
                            <span className="text-lg font-bold text-amber-500">4</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm font-medium text-slate-600">Est. Wait</span>
                            <span className="text-lg font-bold text-slate-700">~2m</span>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">System Health</h4>
                        <div className="flex items-center text-sm text-emerald-600">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Telephony Gateway Operational
                        </div>
                    </div>
                </Card>

                <Card title="Recent Calls" className="lg:col-span-2"
                    action={<Link href="/dashboard/calls"><Button variant="ghost" className="text-xs">View All</Button></Link>}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Caller</th>
                                    <th className="px-4 py-3 font-medium">Intent</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium text-right">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RECENT_CALLS.map((call) => (
                                    <tr key={call.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900">{call.name}</div>
                                            <div className="text-xs text-slate-500">{call.caller}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge type={call.emergency ? 'danger' : 'primary'} text={call.intent} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`flex items-center ${call.status === 'Escalated' ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {call.status === 'Escalated' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                {call.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500 font-mono">
                                            {call.duration}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
