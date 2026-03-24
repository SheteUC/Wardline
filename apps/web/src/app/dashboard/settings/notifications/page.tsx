"use client";

import React, { useState } from 'react';
import { AlertTriangle, Phone, FileText, BellRing } from 'lucide-react';
import { Card, Toggle } from "@/components/dashboard/shared";
import { cn } from '@/lib/utils';

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

    const items = [
        { id: 'emailAlerts', label: 'Critical Alerts', desc: 'Immediate emails for emergency flags and system outages.', icon: AlertTriangle, iconClass: 'text-rose-600' },
        { id: 'smsEscalation', label: 'SMS Escalations', desc: 'Receive texts when hold times exceed SLA thresholds.', icon: Phone, iconClass: 'text-sky-600' },
        { id: 'weeklyReport', label: 'Weekly Digest', desc: 'A summary of key performance metrics sent every Monday.', icon: FileText, iconClass: 'text-teal-600' },
        { id: 'marketing', label: 'Product Updates', desc: 'New features and improvement announcements.', icon: BellRing, iconClass: 'text-violet-600' },
    ] as const;

    return (
        <div className="mx-auto max-w-4xl animate-fade-in pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
                <p className="text-muted-foreground">Customize how and when you receive alerts.</p>
            </div>

            <Card className="overflow-hidden p-0">
                <div className="border-b border-border/40 px-6 py-4">
                    <h3 className="font-semibold text-foreground">Preferences</h3>
                </div>
                <div className="divide-y divide-border/40">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between gap-4 p-6 transition-colors hover:bg-[var(--background)]/40"
                        >
                            <div className="flex min-w-0 gap-4">
                                <div
                                    className={cn(
                                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset',
                                        item.iconClass,
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium text-foreground">{item.label}</div>
                                    <div className="text-sm text-muted-foreground">{item.desc}</div>
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
