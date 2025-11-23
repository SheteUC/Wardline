"use client";

import React from 'react';
import { Download } from 'lucide-react';
import { Card, Button } from "@/components/dashboard/shared";

export default function BillingSettingsPage() {
    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
                <p className="text-slate-500">View invoices and manage your subscription.</p>
            </div>

            <div className="space-y-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-4">
                                Active Subscription
                            </div>
                            <h2 className="text-3xl font-bold">Enterprise Plan</h2>
                            <p className="text-slate-400 mt-1">Next billing date: November 1, 2023</p>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold tracking-tight">$499</div>
                            <div className="text-sm text-slate-400">per month</div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Voice Minutes</div>
                            <div className="text-lg font-semibold">8,420 / 10k</div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-teal-400 h-full w-[84%]"></div>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Seats Used</div>
                            <div className="text-lg font-semibold">12 / ∞</div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-blue-400 h-full w-[12%]"></div>
                            </div>
                        </div>
                        <div className="flex items-end justify-end">
                            <button className="text-sm font-medium text-white hover:text-teal-300 transition-colors underline underline-offset-4">Change Plan</button>
                        </div>
                    </div>
                </div>

                <Card title="Billing History">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-3">Invoice</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Amount</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Download</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[
                                    { id: 'INV-2023-010', date: 'Oct 01, 2023', amount: '$499.00', status: 'Paid' },
                                    { id: 'INV-2023-009', date: 'Sep 01, 2023', amount: '$499.00', status: 'Paid' },
                                    { id: 'INV-2023-008', date: 'Aug 01, 2023', amount: '$499.00', status: 'Paid' },
                                ].map((inv) => (
                                    <tr key={inv.id}>
                                        <td className="px-6 py-4 font-medium text-slate-900">{inv.id}</td>
                                        <td className="px-6 py-4 text-slate-500">{inv.date}</td>
                                        <td className="px-6 py-4 text-slate-900">{inv.amount}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" icon={Download} className="h-8 w-8 p-0" />
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
