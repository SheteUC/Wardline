"use client";

import { Download } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { Button, Card } from "@/components/dashboard/shared";
import { UserRole } from '@wardline/types';

export default function BillingSettingsPage() {
    return (
        <RoleGuard allowedRoles={[UserRole.OWNER, UserRole.ADMIN]}>
            <div className="mx-auto max-w-4xl pb-10">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
                    <p className="text-muted-foreground">View invoices and manage your subscription.</p>
                </div>

                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-3xl bg-[var(--background)] p-8 neo-raised">
                        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                            <div>
                                <div className="mb-4 inline-flex items-center rounded-full border-0 bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-800 neo-inset">
                                    Active subscription
                                </div>
                                <h2 className="text-3xl font-semibold text-foreground">Enterprise Plan</h2>
                                <p className="mt-1 text-muted-foreground">Next billing date: November 1, 2023</p>
                            </div>
                            <div className="text-left sm:text-right">
                                <div className="text-4xl font-bold tracking-tight text-foreground">$499</div>
                                <div className="text-sm text-muted-foreground">per month</div>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-border/40 pt-8 sm:grid-cols-3">
                            <div>
                                <div className="mb-1 text-sm text-muted-foreground">Voice minutes</div>
                                <div className="text-lg font-semibold text-foreground">8,420 / 10k</div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--background)] neo-inset">
                                    <div className="h-full w-[84%] rounded-full bg-primary" />
                                </div>
                            </div>
                            <div>
                                <div className="mb-1 text-sm text-muted-foreground">Seats used</div>
                                <div className="text-lg font-semibold text-foreground">12 / unlimited</div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--background)] neo-inset">
                                    <div className="h-full w-[12%] rounded-full bg-sky-500/80" />
                                </div>
                            </div>
                            <div className="flex items-end justify-start sm:justify-end">
                                <button
                                    type="button"
                                    className="text-sm font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                                >
                                    Change plan
                                </button>
                            </div>
                        </div>
                    </div>

                    <Card className="overflow-hidden p-0">
                        <div className="border-b border-border/40 px-6 py-4">
                            <h3 className="font-semibold text-foreground">Billing history</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[var(--background)] text-xs uppercase text-muted-foreground neo-inset">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Invoice</th>
                                        <th className="px-6 py-3 font-semibold">Date</th>
                                        <th className="px-6 py-3 font-semibold">Amount</th>
                                        <th className="px-6 py-3 font-semibold">Status</th>
                                        <th className="px-6 py-3 text-right font-semibold">Download</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {[
                                        { id: 'INV-2023-010', date: 'Oct 01, 2023', amount: '$499.00', status: 'Paid' },
                                        { id: 'INV-2023-009', date: 'Sep 01, 2023', amount: '$499.00', status: 'Paid' },
                                        { id: 'INV-2023-008', date: 'Aug 01, 2023', amount: '$499.00', status: 'Paid' },
                                    ].map((invoice) => (
                                        <tr key={invoice.id} className="transition-colors hover:bg-[var(--background)]/50">
                                            <td className="px-6 py-4 font-medium text-foreground">{invoice.id}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{invoice.date}</td>
                                            <td className="px-6 py-4 text-foreground">{invoice.amount}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                                    {invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" className="h-9 w-9 p-0" aria-label="Download invoice">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </RoleGuard>
    );
}
