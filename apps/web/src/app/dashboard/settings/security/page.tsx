"use client";

import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { Card, Toggle, Button } from "@/components/dashboard/shared";

export default function SecuritySettingsPage() {
    const [twoFactor, setTwoFactor] = useState(true);

    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Security</h1>
                <p className="text-slate-500">Protect your account and organization data.</p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        <Card title="Security Health">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <Shield className="w-8 h-8 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-slate-900">Your account is secure</div>
                                    <div className="text-sm text-slate-500">No security issues detected in the last 30 days.</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-sm font-medium text-slate-700">Two-Factor Authentication</span>
                                    <Toggle checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-sm font-medium text-slate-700">Password Expiration (90 days)</span>
                                    <Toggle checked={true} onChange={() => { }} />
                                </div>
                            </div>
                        </Card>

                        <Card title="Recent Login History">
                            <div className="overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3">Device</th>
                                            <th className="px-4 py-3">Location</th>
                                            <th className="px-4 py-3">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {[
                                            { device: 'Chrome on Mac OS X', loc: 'Boston, MA', date: 'Just now' },
                                            { device: 'Safari on iPhone', loc: 'Boston, MA', date: '2 hours ago' },
                                            { device: 'Chrome on Windows', loc: 'New York, NY', date: '3 days ago' },
                                        ].map((log, i) => (
                                            <tr key={i}>
                                                <td className="px-4 py-3 font-medium text-slate-900">{log.device}</td>
                                                <td className="px-4 py-3 text-slate-500">{log.loc}</td>
                                                <td className="px-4 py-3 text-slate-500">{log.date}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-semibold text-slate-800 mb-4">Change Password</h3>
                            <div className="space-y-3">
                                <input type="password" placeholder="Current Password" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                                <input type="password" placeholder="New Password" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                                <input type="password" placeholder="Confirm Password" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                                <Button variant="secondary" className="w-full">Update</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
