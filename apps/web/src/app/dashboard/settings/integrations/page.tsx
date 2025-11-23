"use client";

import React from 'react';
import { Phone, Activity, CreditCard, BellRing, RefreshCw } from 'lucide-react';
import { Card, Button } from "@/components/dashboard/shared";

export default function IntegrationSettingsPage() {
    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
                <p className="text-slate-500">Connect Wardline with your existing software stack.</p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { name: 'Twilio', desc: 'Voice & SMS Gateway', status: 'Connected', color: 'bg-[#F22F46]', icon: Phone },
                        { name: 'Epic EHR', desc: 'Patient Records Sync', status: 'Connected', color: 'bg-[#CE1126]', icon: Activity },
                        { name: 'Stripe', desc: 'Billing & Invoicing', status: 'Connected', color: 'bg-[#635BFF]', icon: CreditCard },
                        { name: 'Slack', desc: 'Team Notifications', status: 'Disconnected', color: 'bg-[#4A154B]', icon: BellRing },
                    ].map((app, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow h-40">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${app.color} flex items-center justify-center text-white font-bold shadow-sm`}>
                                        {app.icon ? <app.icon className="w-5 h-5" /> : app.name[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">{app.name}</div>
                                        <div className="text-xs text-slate-500">{app.desc}</div>
                                    </div>
                                </div>
                                <div className={`w-2.5 h-2.5 rounded-full ${app.status === 'Connected' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            </div>
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                                <span className="text-xs font-medium text-slate-500">{app.status}</span>
                                <Button variant="secondary" className="h-8 text-xs px-3">
                                    {app.status === 'Connected' ? 'Configure' : 'Connect'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <Card title="API Access">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Use these keys to authenticate requests to the Wardline API.</p>
                        <div className="flex gap-2">
                            <input type="text" value="pk_live_51Mz...8s9A" disabled className="flex-1 p-2.5 border border-slate-200 rounded-lg bg-slate-50 font-mono text-xs text-slate-600" />
                            <Button variant="secondary" icon={RefreshCw}>Rotate</Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
