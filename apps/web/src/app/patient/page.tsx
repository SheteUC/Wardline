"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Calendar, CreditCard, FileText, Shield, Clock, MapPin,
    ChevronRight, AlertCircle, CheckCircle, ExternalLink,
    Phone, Building2
} from 'lucide-react';
import { format, formatDistanceToNow, addDays, addHours } from 'date-fns';
import type {
    PatientDashboardData,
    PatientAppointment,
    PatientBill,
    InsurancePlanInfo,
    TestResult
} from '@/lib/patient-types';

/**
 * Patient Dashboard - Mobile-First Design
 * Main landing page for patients to see overview of their health info
 */

// Mock data for demonstration
const mockPatientData: PatientDashboardData = {
    patient: {
        id: 'p-001',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '(555) 123-4567',
    },
    insurance: {
        id: 'ins-001',
        planName: 'Blue Cross Premium',
        payerName: 'Blue Cross Blue Shield',
        planType: 'PPO',
        memberId: 'XYZ123456789',
        groupNumber: 'GRP-98765',
        effectiveDate: '2024-01-01',
        copay: 30,
        deductible: 1500,
        deductibleMet: 850,
    },
    bills: [
        {
            id: 'bill-001',
            description: 'Office Visit - Dr. Martinez',
            serviceDate: '2025-11-15',
            amountDue: 45.00,
            dueDate: '2025-12-15',
            status: 'pending',
            providerName: 'Dr. Martinez',
        },
        {
            id: 'bill-002',
            description: 'Lab Work - Blood Panel',
            serviceDate: '2025-11-10',
            amountDue: 125.50,
            dueDate: '2025-12-10',
            status: 'overdue',
            providerName: 'Quest Diagnostics',
        },
    ],
    appointments: [
        {
            id: 'apt-001',
            scheduledAt: addDays(new Date(), 3).toISOString(),
            duration: 30,
            providerName: 'Dr. Emily Chen',
            serviceType: 'Annual Physical',
            department: 'Primary Care',
            location: 'Main Campus - Building A',
            address: '123 Medical Center Dr, Suite 200',
            status: 'confirmed',
        },
        {
            id: 'apt-002',
            scheduledAt: addDays(new Date(), 10).toISOString(),
            duration: 15,
            providerName: 'Dr. James Wilson',
            serviceType: 'Follow-up Visit',
            department: 'Cardiology',
            location: 'Heart Center',
            address: '456 Cardiac Way, Floor 3',
            status: 'scheduled',
        },
    ],
    testResults: [
        {
            id: 'test-001',
            testName: 'Complete Blood Count (CBC)',
            testDate: '2025-11-20',
            status: 'available',
            category: 'Blood Work',
            orderedBy: 'Dr. Martinez',
            summary: 'Results within normal range',
        },
        {
            id: 'test-002',
            testName: 'Lipid Panel',
            testDate: '2025-11-20',
            status: 'available',
            category: 'Blood Work',
            orderedBy: 'Dr. Martinez',
        },
        {
            id: 'test-003',
            testName: 'Chest X-Ray',
            testDate: '2025-11-25',
            status: 'pending',
            category: 'Imaging',
            orderedBy: 'Dr. Chen',
        },
    ],
};

// Get next appointment
mockPatientData.nextAppointment = mockPatientData.appointments[0];

export default function PatientDashboardPage() {
    const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
    const data = mockPatientData;
    
    const totalDue = data.bills.reduce((sum, bill) => 
        bill.status !== 'paid' ? sum + bill.amountDue : sum, 0
    );
    const overdueCount = data.bills.filter(b => b.status === 'overdue').length;

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Welcome Header Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 md:p-6 text-white shadow-lg">
                <h1 className="text-xl md:text-2xl font-bold">
                    Welcome back, {data.patient.name.split(' ')[0]}!
                </h1>
                
                {data.nextAppointment && (
                    <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-xl p-4">
                        <p className="text-emerald-100 text-sm font-medium">Next Appointment</p>
                        <div className="mt-2 flex items-start gap-3">
                            <div className="bg-white/20 rounded-lg p-2">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white">
                                    {data.nextAppointment.serviceType}
                                </p>
                                <p className="text-emerald-100 text-sm">
                                    {data.nextAppointment.providerName}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-sm text-emerald-100">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>
                                        {format(new Date(data.nextAppointment.scheduledAt), 'EEE, MMM d')} at{' '}
                                        {format(new Date(data.nextAppointment.scheduledAt), 'h:mm a')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-sm text-emerald-100">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span className="truncate">{data.nextAppointment.location}</span>
                                </div>
                            </div>
                        </div>
                        <Link 
                            href={`/patient/appointments/${data.nextAppointment.id}`}
                            className="mt-3 inline-flex items-center text-sm font-medium text-white hover:text-emerald-100"
                        >
                            View Details
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                    </div>
                )}
            </div>

            {/* Insurance Card */}
            {data.insurance && (
                <InsuranceCard insurance={data.insurance} />
            )}

            {/* Bills & Payments Card */}
            <BillsCard 
                bills={data.bills} 
                totalDue={totalDue} 
                overdueCount={overdueCount} 
            />

            {/* Appointments Card */}
            <AppointmentsCard appointments={data.appointments} />

            {/* Test Results Card */}
            <TestResultsCard 
                results={data.testResults}
                selectedResult={selectedResult}
                onSelectResult={setSelectedResult}
            />
        </div>
    );
}

// Insurance Card Component
function InsuranceCard({ insurance }: { insurance: InsurancePlanInfo }) {
    const [showDetails, setShowDetails] = useState(false);
    const deductiblePercent = insurance.deductible && insurance.deductibleMet 
        ? Math.round((insurance.deductibleMet / insurance.deductible) * 100)
        : 0;

    return (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2.5 rounded-xl">
                            <Shield className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">Insurance</h2>
                            <p className="text-sm text-muted-foreground">{insurance.payerName}</p>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                        {insurance.planType}
                    </span>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Plan</span>
                        <span className="text-sm font-medium text-foreground">{insurance.planName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Member ID</span>
                        <span className="text-sm font-mono text-foreground">{insurance.memberId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Effective From</span>
                        <span className="text-sm text-foreground">
                            {format(new Date(insurance.effectiveDate), 'MMM d, yyyy')}
                        </span>
                    </div>
                    
                    {insurance.deductible && (
                        <div className="pt-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-muted-foreground">Deductible</span>
                                <span className="text-sm text-foreground">
                                    ${insurance.deductibleMet?.toFixed(2)} / ${insurance.deductible.toFixed(2)}
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${deductiblePercent}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                    {showDetails ? 'Hide Details' : 'View Details'}
                    <ChevronRight className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
                </button>
            </div>

            {showDetails && (
                <div className="px-4 pb-4 md:px-5 md:pb-5 border-t border-border pt-4 bg-muted/30">
                    <div className="space-y-3">
                        {insurance.groupNumber && (
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Group Number</span>
                                <span className="text-sm font-mono">{insurance.groupNumber}</span>
                            </div>
                        )}
                        {insurance.copay && (
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Copay</span>
                                <span className="text-sm font-medium">${insurance.copay}</span>
                            </div>
                        )}
                        <div className="pt-2">
                            <Link
                                href="/patient/insurance"
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                View Full Coverage
                                <ExternalLink className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Bills Card Component
function BillsCard({ 
    bills, 
    totalDue, 
    overdueCount 
}: { 
    bills: PatientBill[]; 
    totalDue: number; 
    overdueCount: number;
}) {
    const pendingBills = bills.filter(b => b.status !== 'paid');

    return (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-50 p-2.5 rounded-xl">
                            <CreditCard className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">Bills & Payments</h2>
                            <p className="text-sm text-muted-foreground">
                                {pendingBills.length} outstanding
                            </p>
                        </div>
                    </div>
                    {overdueCount > 0 && (
                        <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {overdueCount} overdue
                        </span>
                    )}
                </div>

                {pendingBills.length > 0 ? (
                    <>
                        <div className="bg-amber-50 rounded-xl p-4 mb-4">
                            <p className="text-sm text-amber-800">Total Amount Due</p>
                            <p className="text-2xl font-bold text-amber-900">${totalDue.toFixed(2)}</p>
                        </div>

                        <div className="space-y-3">
                            {pendingBills.slice(0, 3).map((bill) => (
                                <div 
                                    key={bill.id}
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {bill.description}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Due {format(new Date(bill.dueDate), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 ml-3">
                                        <span className={`text-sm font-semibold ${
                                            bill.status === 'overdue' ? 'text-red-600' : 'text-foreground'
                                        }`}>
                                            ${bill.amountDue.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex gap-3">
                            <Link
                                href="/patient/bills"
                                className="flex-1 py-2.5 text-center text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                            >
                                View All Bills
                            </Link>
                            <button
                                className="flex-1 py-2.5 text-center text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                                onClick={() => alert('Payment flow would open here')}
                            >
                                Pay Now
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-6">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No outstanding bills</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Appointments Card Component
function AppointmentsCard({ appointments }: { appointments: PatientAppointment[] }) {
    const upcomingAppointments = appointments.filter(
        apt => new Date(apt.scheduledAt) > new Date() && apt.status !== 'cancelled'
    );

    return (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-50 p-2.5 rounded-xl">
                            <Calendar className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">Appointments</h2>
                            <p className="text-sm text-muted-foreground">
                                {upcomingAppointments.length} upcoming
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/patient/appointments/new"
                        className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                        + Book New
                    </Link>
                </div>

                {upcomingAppointments.length > 0 ? (
                    <div className="space-y-3">
                        {upcomingAppointments.map((apt) => (
                            <div 
                                key={apt.id}
                                className="p-3 border border-border rounded-xl hover:border-purple-200 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-foreground">
                                            {apt.serviceType}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {apt.providerName}
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {format(new Date(apt.scheduledAt), 'EEE, MMM d')} • {format(new Date(apt.scheduledAt), 'h:mm a')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span className="truncate">{apt.location}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                        apt.status === 'confirmed' 
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                                    </span>
                                </div>
                                
                                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                                    <Link
                                        href={`/patient/appointments/${apt.id}`}
                                        className="flex-1 py-2 text-center text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                                    >
                                        View Details
                                    </Link>
                                    <button
                                        className="flex-1 py-2 text-center text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-1"
                                        onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(apt.address || apt.location || '')}`, '_blank')}
                                    >
                                        <MapPin className="w-3.5 h-3.5" />
                                        Directions
                                    </button>
                                    <button
                                        className="flex-1 py-2 text-center text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                                        onClick={() => alert('Reschedule flow would open here')}
                                    >
                                        Reschedule
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No upcoming appointments</p>
                        <Link
                            href="/patient/appointments/new"
                            className="mt-3 inline-block text-sm font-medium text-purple-600 hover:text-purple-700"
                        >
                            Book an appointment
                        </Link>
                    </div>
                )}

                {upcomingAppointments.length > 0 && (
                    <Link
                        href="/patient/appointments"
                        className="mt-4 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                        View All Appointments
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                )}
            </div>
        </div>
    );
}

// Test Results Card Component
function TestResultsCard({ 
    results, 
    selectedResult,
    onSelectResult 
}: { 
    results: TestResult[];
    selectedResult: TestResult | null;
    onSelectResult: (result: TestResult | null) => void;
}) {
    const availableResults = results.filter(r => r.status === 'available');
    const pendingResults = results.filter(r => r.status === 'pending');

    return (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-50 p-2.5 rounded-xl">
                            <FileText className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">Test Results</h2>
                            <p className="text-sm text-muted-foreground">
                                {availableResults.length} available, {pendingResults.length} pending
                            </p>
                        </div>
                    </div>
                </div>

                {results.length > 0 ? (
                    <div className="space-y-2">
                        {results.map((result) => (
                            <button
                                key={result.id}
                                onClick={() => onSelectResult(result.status === 'available' ? result : null)}
                                disabled={result.status !== 'available'}
                                className={`w-full p-3 rounded-lg text-left transition-colors ${
                                    result.status === 'available'
                                        ? 'bg-cyan-50 hover:bg-cyan-100 cursor-pointer'
                                        : 'bg-muted/50 cursor-not-allowed'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground">
                                            {result.testName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {result.category} • {format(new Date(result.testDate), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                        result.status === 'available'
                                            ? 'bg-cyan-100 text-cyan-700'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {result.status === 'available' ? 'View' : 'Pending'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No test results</p>
                    </div>
                )}

                <Link
                    href="/patient/results"
                    className="mt-4 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                >
                    View All Results
                    <ChevronRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Result Detail Modal/Drawer */}
            {selectedResult && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => onSelectResult(null)}
                    />
                    <div className="relative w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl p-5 md:p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{selectedResult.testName}</h3>
                            <button
                                onClick={() => onSelectResult(null)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <span className="sr-only">Close</span>
                                ✕
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-sm text-muted-foreground">Category</span>
                                <span className="text-sm font-medium">{selectedResult.category}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-sm text-muted-foreground">Test Date</span>
                                <span className="text-sm font-medium">
                                    {format(new Date(selectedResult.testDate), 'MMMM d, yyyy')}
                                </span>
                            </div>
                            {selectedResult.orderedBy && (
                                <div className="flex justify-between py-2 border-b border-border">
                                    <span className="text-sm text-muted-foreground">Ordered By</span>
                                    <span className="text-sm font-medium">{selectedResult.orderedBy}</span>
                                </div>
                            )}
                            {selectedResult.summary && (
                                <div className="py-2">
                                    <span className="text-sm text-muted-foreground block mb-2">Summary</span>
                                    <p className="text-sm">{selectedResult.summary}</p>
                                </div>
                            )}
                            
                            {/* Disclaimer */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">Important Notice</p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            This is information only. For interpretation of these results 
                                            and medical advice, please talk to your care team.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => onSelectResult(null)}
                                    className="flex-1 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    className="flex-1 py-2.5 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                                    onClick={() => alert('Contact care team flow would open here')}
                                >
                                    <Phone className="w-4 h-4" />
                                    Contact Care Team
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

