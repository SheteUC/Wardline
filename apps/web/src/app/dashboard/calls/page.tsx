"use client";

import React, { useState } from 'react';
import {
    Search, Filter, Download, ChevronRight, AlertTriangle
} from 'lucide-react';
import { Card, Badge, Button } from "@/components/dashboard/shared";
import Link from 'next/link';

const CALLS_HISTORY_MOCK = [
    { id: 101, caller: '(555) 123-4567', name: 'Sarah J.', time: '2 min ago', duration: '4:12', intent: 'Scheduling', status: 'Completed', sentiment: 'High', emergency: false },
    { id: 102, caller: '(555) 987-6543', name: 'Unknown', time: '5 min ago', duration: '1:30', intent: 'Triage', status: 'Escalated', sentiment: 'Low', emergency: true },
    { id: 103, caller: '(555) 456-7890', name: 'Mike R.', time: '12 min ago', duration: '2:45', intent: 'Billing', status: 'Completed', sentiment: 'Neutral', emergency: false },
    { id: 104, caller: '(555) 222-3333', name: 'Elena D.', time: '18 min ago', duration: '0:00', intent: 'Unknown', status: 'Abandoned', sentiment: 'N/A', emergency: false },
    { id: 105, caller: '(555) 333-4444', name: 'John D.', time: '45 min ago', duration: '5:20', intent: 'Clinical Triage', status: 'Completed', sentiment: 'Neutral', emergency: false },
    { id: 106, caller: '(555) 777-8888', name: 'Amanda L.', time: '1 hr ago', duration: '2:15', intent: 'Refill', status: 'Completed', sentiment: 'High', emergency: false },
    { id: 107, caller: '(555) 999-0000', name: 'Robert K.', time: '1.5 hrs ago', duration: '0:45', intent: 'Scheduling', status: 'Abandoned', sentiment: 'N/A', emergency: false },
    { id: 108, caller: '(555) 111-2222', name: 'Patricia M.', time: '2 hrs ago', duration: '6:10', intent: 'Clinical Triage', status: 'Escalated', sentiment: 'Low', emergency: true },
    { id: 109, caller: '(555) 444-5555', name: 'Greg S.', time: '3 hrs ago', duration: '3:30', intent: 'Billing', status: 'Completed', sentiment: 'High', emergency: false },
];

export default function CallsPage() {
    const [filter, setFilter] = useState('all');

    const filteredCalls = CALLS_HISTORY_MOCK.filter(call => {
        if (filter === 'all') return true;
        if (filter === 'emergency') return call.emergency;
        if (filter === 'escalated') return call.status === 'Escalated';
        if (filter === 'completed') return call.status === 'Completed';
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <Card className="min-h-[600px]">
                {/* Filters & Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg w-fit">
                        {['all', 'emergency', 'completed', 'escalated'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all
                    ${filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}
                  `}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-full md:w-64"
                            />
                        </div>
                        <Button variant="secondary" icon={Filter} className="hidden md:flex">Filters</Button>
                        <Button variant="secondary" icon={Download} className="hidden md:flex">Export</Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
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
                        <tbody className="divide-y divide-slate-50">
                            {filteredCalls.map((call) => (
                                <tr key={call.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                        <div className="font-medium text-slate-900">{call.time}</div>
                                        <div className="text-xs">Oct 24, 2023</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                {call.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{call.name}</div>
                                                <div className="text-xs text-slate-500">{call.caller}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge type={call.emergency ? 'danger' : 'primary'} text={call.intent} />
                                    </td>
                                    <td className="px-6 py-4">
                                        {call.sentiment !== 'N/A' ? (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${call.sentiment === 'High' ? 'bg-emerald-500' :
                                                        call.sentiment === 'Low' ? 'bg-rose-500' : 'bg-slate-400'
                                                    }`}></div>
                                                <span className="text-slate-700">{call.sentiment}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                         ${call.status === 'Escalated' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                call.status === 'Abandoned' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                                    'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                            }
                       `}>
                                            {call.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-600">
                                        {call.duration}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href={`/dashboard/calls/${call.id}`}>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Mock */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-4">
                    <div className="text-sm text-slate-500">Showing <span className="font-medium">1-{filteredCalls.length}</span> of <span className="font-medium">1,240</span> results</div>
                    <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" disabled>Previous</Button>
                        <Button variant="secondary" className="h-8 px-3 text-xs">Next</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
