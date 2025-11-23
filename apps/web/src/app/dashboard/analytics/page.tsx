"use client";

import React, { useState } from 'react';
import {
    Activity, AlertTriangle, Calendar, Download, BrainCircuit, RefreshCw, X
} from 'lucide-react';
import {
    ComposedChart, LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
    ResponsiveContainer, Cell
} from 'recharts';
import { Card, StatCard, Button } from "@/components/dashboard/shared";

const COLORS = {
    primary: '#0d9488', // teal-600
    secondary: '#64748b', // slate-500
    danger: '#e11d48', // rose-600
    warning: '#d97706', // amber-600
    success: '#10b981', // emerald-500
    bg: '#f8fafc' // slate-50
};

const ANALYTICS_OPS_DATA = [
    { date: 'Mon', volume: 850, aht: 320, sentiment: 72 },
    { date: 'Tue', volume: 920, aht: 340, sentiment: 68 },
    { date: 'Wed', volume: 890, aht: 310, sentiment: 75 },
    { date: 'Thu', volume: 950, aht: 330, sentiment: 70 },
    { date: 'Fri', volume: 1020, aht: 360, sentiment: 65 },
    { date: 'Sat', volume: 600, aht: 290, sentiment: 82 },
    { date: 'Sun', volume: 550, aht: 280, sentiment: 85 },
];

const SAFETY_RISK_DATA = [
    { time: '08:00', emergency: 2, escalation: 5 },
    { time: '10:00', emergency: 5, escalation: 8 },
    { time: '12:00', emergency: 3, escalation: 12 },
    { time: '14:00', emergency: 6, escalation: 10 },
    { time: '16:00', emergency: 4, escalation: 7 },
    { time: '18:00', emergency: 8, escalation: 4 },
];

const AI_CONFIDENCE_DATA = [
    { range: '90-100%', count: 450 },
    { range: '80-89%', count: 320 },
    { range: '70-79%', count: 150 },
    { range: '60-69%', count: 80 },
    { range: '<60%', count: 40 },
];

const SCHEDULING_DATA = [
    { name: 'General Practice', booked: 120, noshow: 12 },
    { name: 'Pediatrics', booked: 85, noshow: 5 },
    { name: 'Cardiology', booked: 45, noshow: 2 },
    { name: 'Dermatology', booked: 60, noshow: 8 },
    { name: 'Radiology', booked: 90, noshow: 4 },
];

const TOP_INTENTS_TABLE = [
    { intent: 'Schedule Appt', volume: 412, aht: '3m 12s', automation: '92%' },
    { intent: 'Billing Inquiry', volume: 285, aht: '5m 45s', automation: '45%' },
    { intent: 'Refill Request', volume: 190, aht: '1m 30s', automation: '98%' },
    { intent: 'Symptom Triage', volume: 145, aht: '8m 20s', automation: '12%' },
    { intent: 'Lab Results', volume: 98, aht: '2m 10s', automation: '85%' },
];

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState('ops');
    const [dateRange, setDateRange] = useState('7d');

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors font-medium text-sm
        ${activeTab === id
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Tabs */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-1">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <TabButton id="ops" label="Operations" icon={Activity} />
                    <TabButton id="safety" label="Safety & Risk" icon={AlertTriangle} />
                    <TabButton id="scheduling" label="Scheduling Outcomes" icon={Calendar} />
                </nav>
                <div className="flex items-center gap-2 mb-2 lg:mb-0">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                        <option value="today">Today</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                    <Button variant="secondary" icon={Download}>Export Report</Button>
                </div>
            </div>

            {/* OPERATIONS TAB */}
            {activeTab === 'ops' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card title="Call Volume & Handle Time" className="lg:col-span-2 min-h-[400px]">
                            <ResponsiveContainer width="100%" height={350}>
                                <ComposedChart data={ANALYTICS_OPS_DATA}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} unit="s" />
                                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="volume" name="Call Volume" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={30} />
                                    <Line yAxisId="right" type="monotone" dataKey="aht" name="Avg Handle Time (s)" stroke={COLORS.warning} strokeWidth={2} dot={{ r: 4 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </Card>

                        <div className="space-y-6">
                            <Card title="Sentiment Trends">
                                <div className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={ANALYTICS_OPS_DATA}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" hide />
                                            <YAxis domain={[0, 100]} hide />
                                            <RechartsTooltip />
                                            <Line type="monotone" dataKey="sentiment" stroke={COLORS.primary} strokeWidth={3} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="text-sm text-slate-500">Avg Sentiment Score</div>
                                    <div className="text-xl font-bold text-teal-700">74/100</div>
                                </div>
                            </Card>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="text-xs text-slate-500 uppercase font-bold">SLA Met</div>
                                    <div className="text-2xl font-bold text-emerald-600 mt-1">94.2%</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Abandons</div>
                                    <div className="text-2xl font-bold text-slate-700 mt-1">2.1%</div>
                                </div>
                            </div>
                        </div>

                        <Card title="Top Intents Breakdown" className="lg:col-span-3">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                                        <tr>
                                            <th className="px-4 py-3">Intent Name</th>
                                            <th className="px-4 py-3">Volume</th>
                                            <th className="px-4 py-3">Avg Duration</th>
                                            <th className="px-4 py-3">Automation Rate</th>
                                            <th className="px-4 py-3">Trend</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {TOP_INTENTS_TABLE.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3 font-medium text-slate-800">{row.intent}</td>
                                                <td className="px-4 py-3 text-slate-600">{row.volume}</td>
                                                <td className="px-4 py-3 text-slate-600">{row.aht}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                                            <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: row.automation }}></div>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{row.automation}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">+2.4%</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* SAFETY TAB */}
            {activeTab === 'safety' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard
                            label="Emergency Triggers"
                            value="142"
                            subtext="Last 7 days"
                            icon={AlertTriangle}
                            alert
                            trend="up" trendValue="+12%"
                        />
                        <StatCard
                            label="Clinical Escalations"
                            value="38"
                            subtext="Handoffs to MD/RN"
                            icon={Activity}
                            trend="down" trendValue="-5%"
                        />
                        <StatCard
                            label="Low Confidence AI"
                            value="2.1%"
                            subtext="Requires Review"
                            icon={BrainCircuit}
                            trend="flat" trendValue="0%"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card title="Risk Events by Time of Day" className="min-h-[400px]">
                            <ResponsiveContainer width="100%" height={350}>
                                <AreaChart data={SAFETY_RISK_DATA}>
                                    <defs>
                                        <linearGradient id="colorEmerg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.1} />
                                            <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                    <Legend />
                                    <Area type="monotone" dataKey="emergency" name="Emergency Flags" stroke={COLORS.danger} fillOpacity={1} fill="url(#colorEmerg)" />
                                    <Line type="monotone" dataKey="escalation" name="Clinical Handoffs" stroke={COLORS.secondary} strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Card>

                        <Card title="AI Confidence Distribution">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={AI_CONFIDENCE_DATA} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="range" type="category" width={80} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="count" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={20}>
                                        <Cell fill="#10b981" />
                                        <Cell fill="#10b981" />
                                        <Cell fill="#f59e0b" />
                                        <Cell fill="#f59e0b" />
                                        <Cell fill="#ef4444" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="mt-4 text-sm text-slate-500 text-center">
                                Most calls fall within high confidence ranges, ensuring patient safety.
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* SCHEDULING TAB */}
            {activeTab === 'scheduling' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard label="Appointments Booked" value="980" trend="up" trendValue="+8%" icon={Calendar} />
                        <StatCard label="Rescheduled" value="145" trend="down" trendValue="-2%" icon={RefreshCw} />
                        <StatCard label="Cancellations" value="42" trend="down" trendValue="-12%" icon={X} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card title="Booking Performance by Clinic" className="min-h-[400px]">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart layout="vertical" data={SCHEDULING_DATA} margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                    <Legend />
                                    <Bar dataKey="booked" name="Appointments Booked" stackId="a" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={20} />
                                    <Bar dataKey="noshow" name="Predicted No-Shows" stackId="a" fill={COLORS.secondary} radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Card>

                        <Card title="Scheduling Funnel">
                            <div className="flex flex-col h-full justify-center space-y-8 px-8">
                                <div className="relative">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-medium text-slate-700">Intent: "Schedule Appointment"</span>
                                        <span className="font-bold text-slate-900">1,240</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                        <div className="bg-teal-600 h-full w-full"></div>
                                    </div>
                                </div>

                                <div className="relative pl-4 border-l-2 border-slate-200">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-medium text-slate-700">Slots Offered</span>
                                        <span className="font-bold text-slate-900">1,100</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                        <div className="bg-teal-500 h-full w-[88%]"></div>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">88% success rate</div>
                                </div>

                                <div className="relative pl-8 border-l-2 border-slate-200">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-medium text-slate-700">Confirmed Bookings</span>
                                        <span className="font-bold text-slate-900">980</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                        <div className="bg-teal-400 h-full w-[79%]"></div>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">79% conversion</div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
