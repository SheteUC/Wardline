"use client";

import React from 'react';
import { Download } from 'lucide-react';
import { Card, Button } from "@/components/dashboard/shared";

export default function BillingSettingsPage() {
    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">Billing</h1>
                <p className="text-muted-foreground">View invoices and manage your subscription.</p>
            </div>

            <div className="space-y-6">
                <div className="bg-card rounded-xl p-8 border border-border shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 mb-4">
                                Active Subscription
                            </div>
                            <h2 className="text-3xl font-bold text-foreground">Enterprise Plan</h2>
                            <p className="text-muted-foreground mt-1">Next billing date: November 1, 2023</p>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold tracking-tight text-foreground">$499</div>
                            <div className="text-sm text-muted-foreground">per month</div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6">
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Voice Minutes</div>
                            <div className="text-lg font-semibold text-foreground">8,420 / 10k</div>
                            <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-accent h-full w-[84%]"></div>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Seats Used</div>
                            <div className="text-lg font-semibold text-foreground">12 / ∞</div>
                            <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-blue-400 h-full w-[12%]"></div>
                            </div>
                        </div>
                        <div className="flex items-end justify-end">
                            <button className="text-sm font-medium text-foreground hover:text-accent transition-colors underline underline-offset-4">Change Plan</button>
                        </div>
                    </div>
                </div>

                <Card title="Billing History">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3">Invoice</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Amount</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Download</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {[
                                    { id: 'INV-2023-010', date: 'Oct 01, 2023', amount: '$499.00', status: 'Paid' },
                                    { id: 'INV-2023-009', date: 'Sep 01, 2023', amount: '$499.00', status: 'Paid' },
                                    { id: 'INV-2023-008', date: 'Aug 01, 2023', amount: '$499.00', status: 'Paid' },
                                ].map((inv) => (
                                    <tr key={inv.id}>
                                        <td className="px-6 py-4 font-medium text-foreground">{inv.id}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{inv.date}</td>
                                        <td className="px-6 py-4 text-foreground">{inv.amount}</td>
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
