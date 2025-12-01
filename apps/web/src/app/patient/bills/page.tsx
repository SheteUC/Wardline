"use client";

import React from 'react';
import { CreditCard, AlertCircle, CheckCircle, Clock, Download, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

// Mock bills data
const mockBills = [
    {
        id: 'bill-001',
        description: 'Office Visit - Dr. Martinez',
        serviceDate: '2025-11-15',
        amountDue: 45.00,
        dueDate: '2025-12-15',
        status: 'pending' as const,
        providerName: 'Dr. Martinez',
    },
    {
        id: 'bill-002',
        description: 'Lab Work - Blood Panel',
        serviceDate: '2025-11-10',
        amountDue: 125.50,
        dueDate: '2025-12-10',
        status: 'overdue' as const,
        providerName: 'Quest Diagnostics',
    },
    {
        id: 'bill-003',
        description: 'Annual Physical Exam',
        serviceDate: '2025-10-20',
        amountDue: 0,
        dueDate: '2025-11-20',
        status: 'paid' as const,
        providerName: 'Dr. Chen',
        paidDate: '2025-11-05',
    },
];

export default function PatientBillsPage() {
    const pendingBills = mockBills.filter(b => b.status !== 'paid');
    const paidBills = mockBills.filter(b => b.status === 'paid');
    const totalDue = pendingBills.reduce((sum, bill) => sum + bill.amountDue, 0);
    const overdueCount = pendingBills.filter(b => b.status === 'overdue').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Bills & Payments</h1>
                <p className="text-muted-foreground text-sm">View and pay your medical bills</p>
            </div>

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-amber-100 text-sm font-medium">Total Amount Due</p>
                        <p className="text-3xl font-bold mt-1">${totalDue.toFixed(2)}</p>
                        {overdueCount > 0 && (
                            <p className="text-amber-100 text-sm mt-2 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {overdueCount} overdue bill{overdueCount > 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                    <button className="px-4 py-2.5 bg-white text-amber-600 text-sm font-semibold rounded-lg hover:bg-amber-50 transition-colors">
                        Pay All
                    </button>
                </div>
            </div>

            {/* Outstanding Bills */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Outstanding Bills</h2>
                {pendingBills.length > 0 ? (
                    <div className="space-y-3">
                        {pendingBills.map((bill) => (
                            <div
                                key={bill.id}
                                className={`bg-white rounded-xl border p-4 ${
                                    bill.status === 'overdue' ? 'border-red-200' : 'border-border'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl ${
                                            bill.status === 'overdue' ? 'bg-red-50' : 'bg-amber-50'
                                        }`}>
                                            <CreditCard className={`w-5 h-5 ${
                                                bill.status === 'overdue' ? 'text-red-600' : 'text-amber-600'
                                            }`} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">{bill.description}</h3>
                                            <p className="text-sm text-muted-foreground">{bill.providerName}</p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                                <span>Service: {format(new Date(bill.serviceDate), 'MMM d, yyyy')}</span>
                                                <span className={bill.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                                                    Due: {format(new Date(bill.dueDate), 'MMM d, yyyy')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${
                                            bill.status === 'overdue' ? 'text-red-600' : 'text-foreground'
                                        }`}>
                                            ${bill.amountDue.toFixed(2)}
                                        </p>
                                        <span className={`inline-block mt-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                                            bill.status === 'overdue' 
                                                ? 'bg-red-50 text-red-700'
                                                : 'bg-amber-50 text-amber-700'
                                        }`}>
                                            {bill.status === 'overdue' ? 'Overdue' : 'Pending'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                                    <button className="flex-1 py-2 text-center text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" />
                                        View Details
                                    </button>
                                    <button className="flex-1 py-2 text-center text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors">
                                        Pay Now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-border p-8 text-center">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="text-foreground font-medium">All caught up!</p>
                        <p className="text-muted-foreground text-sm">No outstanding bills</p>
                    </div>
                )}
            </div>

            {/* Payment History */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Payment History</h2>
                {paidBills.length > 0 ? (
                    <div className="space-y-3">
                        {paidBills.map((bill) => (
                            <div
                                key={bill.id}
                                className="bg-white rounded-xl border border-border p-4 opacity-75"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-emerald-50 p-3 rounded-xl">
                                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-foreground">{bill.description}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Paid on {format(new Date(bill.paidDate!), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                    <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                                        <Download className="w-4 h-4" />
                                        Receipt
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-border p-8 text-center">
                        <p className="text-muted-foreground">No payment history</p>
                    </div>
                )}
            </div>
        </div>
    );
}

