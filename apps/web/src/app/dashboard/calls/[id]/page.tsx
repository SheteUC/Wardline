"use client";

import React from 'react';
import {
    ChevronRight, User, AlertTriangle, Download, Activity, BrainCircuit, Play
} from 'lucide-react';
import { Card, Badge, Button } from "@/components/dashboard/shared";
import Link from 'next/link';

const TRANSCRIPT_MOCK = [
    { speaker: 'AI', text: "Hello, you've reached St. Mary's General. I am an automated assistant. How can I help you today?", time: '0:00', type: 'system' },
    { speaker: 'Caller', text: "I... I'm having these sharp pains in my chest and I can't breathe well.", time: '0:05', type: 'caller', sentiment: 'panic' },
    { speaker: 'AI', text: "I understand. Are you experiencing chest pain right now?", time: '0:09', type: 'system' },
    { speaker: 'Caller', text: "Yes, it hurts a lot.", time: '0:12', type: 'caller', sentiment: 'panic' },
    { speaker: 'AI', text: "I am connecting you to a triage nurse immediately. Please stay on the line.", time: '0:14', type: 'system', alert: true },
];

export default function CallDetailPage({ params }: { params: { id: string } }) {
    return (
        <div className="h-[calc(100vh-100px)] animate-fade-in flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar: Metadata */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
                <Link href="/dashboard/calls">
                    <Button variant="secondary" icon={ChevronRight} className="rotate-180 mb-2">
                        Back to List
                    </Button>
                </Link>

                <Card className="bg-white">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <User className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-slate-900">04:12</div>
                            <div className="text-sm text-slate-500">Duration</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase">Caller</label>
                            <div className="font-medium text-slate-900">Sarah J.</div>
                            <div className="text-sm text-slate-600">(555) 123-4567</div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase">Intent Detected</label>
                            <div className="mt-1 flex flex-wrap gap-2">
                                <Badge type="danger" text="Chest Pain" />
                                <Badge type="warning" text="Triage" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase">AI Confidence</label>
                            <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '92%' }}></div>
                            </div>
                            <div className="text-xs text-right mt-1 text-slate-500">92% Match</div>
                        </div>
                    </div>
                </Card>

                <Card title="Action Items">
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-rose-800">Clinical Escalation</div>
                                <div className="text-xs text-rose-600">Forwarded to Dr. Chen (On Call)</div>
                            </div>
                        </div>
                        <Button variant="secondary" className="w-full" icon={Download}>Export Summary PDF</Button>
                    </div>
                </Card>
            </div>

            {/* Center: Transcript */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" /> Live Transcript
                    </h3>
                    <div className="flex gap-2">
                        <Badge type="neutral" text="ID: #8823-A" />
                        <Badge type="danger" text="High Emotion" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                    {TRANSCRIPT_MOCK.map((line, idx) => (
                        <div key={idx} className={`flex gap-4 ${line.type === 'system' ? '' : 'flex-row-reverse'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 
                ${line.type === 'system' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'}`}>
                                {line.type === 'system' ? <BrainCircuit className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div className={`flex flex-col max-w-[70%] ${line.type === 'caller' ? 'items-end' : 'items-start'}`}>
                                <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm border 
                    ${line.type === 'system' ? 'bg-white border-slate-100 text-slate-700 rounded-tl-none' : 'bg-white border-slate-100 text-slate-800 rounded-tr-none'}
                    ${line.alert ? 'border-l-4 border-l-rose-500' : ''}
                 `}>
                                    {line.text}
                                </div>
                                <span className="text-xs text-slate-400 mt-1 px-1">{line.time}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center text-white">
                        <Play className="w-4 h-4 ml-0.5" />
                    </div>
                    <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-teal-500"></div>
                    </div>
                    <span className="text-xs font-mono text-slate-500">0:14 / 0:45</span>
                </div>
            </div>
        </div>
    );
}
