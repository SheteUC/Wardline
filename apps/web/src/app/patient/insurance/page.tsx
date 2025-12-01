"use client";

import React from 'react';
import { Shield, CreditCard, FileText, Phone, Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

// Mock insurance data
const mockInsurance = {
    id: 'ins-001',
    planName: 'Blue Cross Premium',
    payerName: 'Blue Cross Blue Shield',
    planType: 'PPO' as const,
    memberId: 'XYZ123456789',
    groupNumber: 'GRP-98765',
    effectiveDate: '2024-01-01',
    terminationDate: null,
    copay: 30,
    deductible: 1500,
    deductibleMet: 850,
    outOfPocketMax: 5000,
    outOfPocketMet: 1200,
    primaryCareVisit: 30,
    specialistVisit: 50,
    urgentCare: 75,
    emergencyRoom: 250,
    prescriptionGeneric: 10,
    prescriptionBrand: 35,
    prescriptionSpecialty: 100,
};

export default function PatientInsurancePage() {
    const deductiblePercent = Math.round((mockInsurance.deductibleMet / mockInsurance.deductible) * 100);
    const oopPercent = Math.round((mockInsurance.outOfPocketMet / mockInsurance.outOfPocketMax) * 100);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Insurance</h1>
                <p className="text-muted-foreground text-sm">View your insurance coverage details</p>
            </div>

            {/* Plan Overview Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-blue-100 text-sm font-medium">Insurance Plan</p>
                        <h2 className="text-2xl font-bold mt-1">{mockInsurance.planName}</h2>
                        <p className="text-blue-100 mt-1">{mockInsurance.payerName}</p>
                    </div>
                    <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                        {mockInsurance.planType}
                    </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
                    <div>
                        <p className="text-blue-100 text-xs">Member ID</p>
                        <p className="font-mono font-medium">{mockInsurance.memberId}</p>
                    </div>
                    <div>
                        <p className="text-blue-100 text-xs">Group Number</p>
                        <p className="font-mono font-medium">{mockInsurance.groupNumber}</p>
                    </div>
                </div>
            </div>

            {/* Deductible & Out of Pocket */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">Deductible</h3>
                        <span className="text-sm text-muted-foreground">
                            ${mockInsurance.deductibleMet} / ${mockInsurance.deductible}
                        </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${deductiblePercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        ${mockInsurance.deductible - mockInsurance.deductibleMet} remaining
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">Out-of-Pocket Max</h3>
                        <span className="text-sm text-muted-foreground">
                            ${mockInsurance.outOfPocketMet} / ${mockInsurance.outOfPocketMax}
                        </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${oopPercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        ${mockInsurance.outOfPocketMax - mockInsurance.outOfPocketMet} remaining
                    </p>
                </div>
            </div>

            {/* Coverage Details */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <h3 className="font-semibold text-foreground">Coverage Details</h3>
                </div>
                
                <div className="divide-y divide-border">
                    <CoverageSection title="Medical Visits">
                        <CoverageItem label="Primary Care Visit" value={`$${mockInsurance.primaryCareVisit} copay`} />
                        <CoverageItem label="Specialist Visit" value={`$${mockInsurance.specialistVisit} copay`} />
                        <CoverageItem label="Urgent Care" value={`$${mockInsurance.urgentCare} copay`} />
                        <CoverageItem label="Emergency Room" value={`$${mockInsurance.emergencyRoom} copay`} />
                    </CoverageSection>

                    <CoverageSection title="Prescriptions">
                        <CoverageItem label="Generic Drugs" value={`$${mockInsurance.prescriptionGeneric} copay`} />
                        <CoverageItem label="Brand Name" value={`$${mockInsurance.prescriptionBrand} copay`} />
                        <CoverageItem label="Specialty" value={`$${mockInsurance.prescriptionSpecialty} copay`} />
                    </CoverageSection>

                    <CoverageSection title="Plan Information">
                        <CoverageItem 
                            label="Effective Date" 
                            value={format(new Date(mockInsurance.effectiveDate), 'MMMM d, yyyy')} 
                        />
                        <CoverageItem 
                            label="Status" 
                            value={
                                <span className="flex items-center gap-1 text-emerald-600">
                                    <CheckCircle className="w-4 h-4" />
                                    Active
                                </span>
                            } 
                        />
                    </CoverageSection>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-border hover:border-blue-300 transition-colors">
                    <Download className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-foreground">Download Card</span>
                </button>
                <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-border hover:border-blue-300 transition-colors">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-foreground">View Benefits</span>
                </button>
                <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-border hover:border-blue-300 transition-colors">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-foreground">Contact Insurer</span>
                </button>
            </div>
        </div>
    );
}

function CoverageSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="p-5">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">{title}</h4>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}

function CoverageItem({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    );
}

