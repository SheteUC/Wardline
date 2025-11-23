"use client";

import React, { useState } from 'react';
import { AlertTriangle, Phone, FileText, BellRing } from 'lucide-react';
import { Card, Toggle } from "@/components/dashboard/shared";

export default function NotificationSettingsPage() {
    const [toggles, setToggles] = useState<Record<string, boolean>>({
        emailAlerts: true,
        smsEscalation: true,
        weeklyReport: false,
        marketing: false,
    });

    const handleToggle = (key: string) => {
        setToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
                <p className="text-slate-500">Customize how and when you receive alerts.</p>
            </div>

            <Card title="Preferences" className="overflow-hidden">
                <div className="divide-y divide-slate-100">
                    {[
                        { id: 'emailAlerts', label: 'Critical Alerts', desc: 'Immediate emails for emergency flags and system outages.', icon: AlertTriangle, color: 'text-rose-500 bg-rose-50' },
                        { id: 'smsEscalation', label: 'SMS Escalations', desc: 'Receive texts when hold times exceed SLA thresholds.', icon: Phone, color: 'text-blue-500 bg-blue-50' },
                        { id: 'weeklyReport', label: 'Weekly Digest', desc: 'A summary of key performance metrics sent every Monday.', icon: FileText, color: 'text-teal-500 bg-teal-50' },
                        { id: 'marketing', label: 'Product Updates', desc: 'New features and improvement announcements.', icon: BellRing, color: 'text-purple-500 bg-purple-50' },
                    ].map(item => (
                        <div key={item.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                            <div className="flex gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900">{item.label}</div>
                                    <div className="text-sm text-slate-500">{item.desc}</div>
                                </div>
                            </div>
                            <Toggle checked={toggles[item.id]} onChange={() => handleToggle(item.id)} />
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
