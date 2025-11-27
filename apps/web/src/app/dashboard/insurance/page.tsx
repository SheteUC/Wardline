"use client";

import React, { useState, useMemo } from 'react';
import {
    Shield, CheckCircle, XCircle, Clock, Search,
    Plus, AlertTriangle, TrendingUp, FileText,
    Building, Loader2, ChevronRight, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHospital } from '@/lib/hospital-context';
import { useApiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface InsurancePlan {
    id: string;
    hospitalId: string;
    planName: string;
    carrierId: string;
    carrierName: string;
    planType?: string;
    isAccepted: boolean;
    effectiveDate?: string;
    terminationDate?: string;
    notes?: string;
    createdAt: string;
    _count?: { inquiries: number; verifications: number };
}

interface InsuranceVerification {
    id: string;
    hospitalId: string;
    insurancePlanId: string;
    patientId?: string;
    patientName: string;
    memberNumber: string;
    groupNumber?: string;
    verificationDate: string;
    eligibilityStatus: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'PENDING' | 'EXPIRED';
    authorizationRequired: boolean;
    authorizationNumber?: string;
    copay?: number;
    deductible?: number;
    deductibleMet?: number;
    notes?: string;
    insurancePlan?: InsurancePlan;
}

interface InsuranceInquiry {
    id: string;
    patientName?: string;
    carrierName?: string;
    planName?: string;
    inquiryType: string;
    resolved: boolean;
    outcome?: string;
    createdAt: string;
}

const ELIGIBILITY_CONFIG = {
    ELIGIBLE: { label: 'Eligible', variant: 'default' as const, color: 'text-emerald-600 bg-emerald-100', icon: CheckCircle },
    NOT_ELIGIBLE: { label: 'Not Eligible', variant: 'destructive' as const, color: 'text-red-600 bg-red-100', icon: XCircle },
    PENDING: { label: 'Pending', variant: 'secondary' as const, color: 'text-amber-600 bg-amber-100', icon: Clock },
    EXPIRED: { label: 'Expired', variant: 'outline' as const, color: 'text-gray-600 bg-gray-100', icon: AlertTriangle },
};

const PLAN_TYPES = ['HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'Medicare', 'Medicaid', 'Other'];

export default function InsurancePage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const api = useApiClient();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('plans');
    const [showNewPlanForm, setShowNewPlanForm] = useState(false);
    const [showVerificationForm, setShowVerificationForm] = useState(false);
    const [planData, setPlanData] = useState({
        planName: '',
        carrierId: '',
        carrierName: '',
        planType: '',
        isAccepted: true,
        notes: ''
    });
    const [verificationData, setVerificationData] = useState({
        insurancePlanId: '',
        patientName: '',
        memberNumber: '',
        groupNumber: '',
        eligibilityStatus: 'PENDING' as const,
        authorizationRequired: false,
        copay: '',
        deductible: '',
        notes: ''
    });

    // Fetch insurance plans
    const { data: plans, isLoading: plansLoading } = useQuery({
        queryKey: ['insurance-plans', hospitalId, searchQuery],
        queryFn: () => api.get<InsurancePlan[]>(
            `/insurance/plans?hospitalId=${hospitalId}${searchQuery ? `&search=${searchQuery}` : ''}`
        ),
        enabled: !!hospitalId,
    });

    // Fetch verifications
    const { data: verificationsData } = useQuery({
        queryKey: ['insurance-verifications', hospitalId],
        queryFn: () => api.get<{ data: InsuranceVerification[]; total: number }>(
            `/insurance/verifications?hospitalId=${hospitalId}&limit=20`
        ),
        enabled: !!hospitalId,
    });

    // Fetch inquiries
    const { data: inquiriesData } = useQuery({
        queryKey: ['insurance-inquiries', hospitalId],
        queryFn: () => api.get<{ data: InsuranceInquiry[]; total: number }>(
            `/insurance/inquiries?hospitalId=${hospitalId}&limit=20`
        ),
        enabled: !!hospitalId,
    });

    // Fetch stats
    const { data: stats } = useQuery({
        queryKey: ['insurance-stats', hospitalId],
        queryFn: () => api.get<any>(`/insurance/stats?hospitalId=${hospitalId}`),
        enabled: !!hospitalId,
    });

    // Create plan mutation
    const createPlan = useMutation({
        mutationFn: (data: typeof planData) =>
            api.post('/insurance/plans', { ...data, hospitalId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['insurance-plans'] });
            setShowNewPlanForm(false);
            setPlanData({ planName: '', carrierId: '', carrierName: '', planType: '', isAccepted: true, notes: '' });
        },
    });

    // Create verification mutation
    const createVerification = useMutation({
        mutationFn: (data: any) =>
            api.post('/insurance/verifications', { ...data, hospitalId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['insurance-verifications'] });
            queryClient.invalidateQueries({ queryKey: ['insurance-stats'] });
            setShowVerificationForm(false);
            setVerificationData({
                insurancePlanId: '',
                patientName: '',
                memberNumber: '',
                groupNumber: '',
                eligibilityStatus: 'PENDING',
                authorizationRequired: false,
                copay: '',
                deductible: '',
                notes: ''
            });
        },
    });

    const acceptedPlans = useMemo(() => {
        if (!plans) return [];
        return plans.filter(p => p.isAccepted);
    }, [plans]);

    const isLoading = hospitalLoading || plansLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Insurance Verification</h1>
                    <p className="text-muted-foreground">
                        Verify eligibility and prevent up to 75% of claim denials
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowNewPlanForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Plan
                    </Button>
                    <Button onClick={() => setShowVerificationForm(true)}>
                        <Shield className="h-4 w-4 mr-2" />
                        New Verification
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Accepted Plans</CardDescription>
                        <CardTitle className="text-2xl">{stats?.acceptedPlans || acceptedPlans.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Verifications</CardDescription>
                        <CardTitle className="text-2xl">{stats?.totalVerifications || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>Eligible</CardDescription>
                        <CardTitle className="text-2xl text-emerald-600">{stats?.eligibleCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>Auth Required</CardDescription>
                        <CardTitle className="text-2xl text-amber-600">{stats?.authorizationRequiredCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>Denial Prevention</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">{stats?.claimDenialPreventionRate?.toFixed(0) || 0}%</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Claim Denial Prevention Alert */}
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-transparent">
                <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium">Claim Denial Prevention Impact</p>
                            <p className="text-sm text-muted-foreground">
                                {stats?.estimatedDenialsPreventedDescription || 'Verify eligibility upfront to prevent claim denials and improve patient access.'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="plans">Insurance Plans</TabsTrigger>
                    <TabsTrigger value="verifications">Verifications</TabsTrigger>
                    <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
                </TabsList>

                <TabsContent value="plans" className="space-y-4">
                    {/* Search */}
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by carrier or plan name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {/* Plans Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {!plans?.length ? (
                            <Card className="col-span-full">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>No insurance plans configured</p>
                                    <Button variant="outline" className="mt-4" onClick={() => setShowNewPlanForm(true)}>
                                        Add First Plan
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            plans.map(plan => (
                                <Card key={plan.id} className="hover:border-primary transition-colors">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Building className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{plan.carrierName}</CardTitle>
                                                    <p className="text-sm text-muted-foreground">{plan.planName}</p>
                                                </div>
                                            </div>
                                            <Badge variant={plan.isAccepted ? "default" : "destructive"}>
                                                {plan.isAccepted ? 'Accepted' : 'Not Accepted'}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {plan.planType && (
                                                <Badge variant="outline">{plan.planType}</Badge>
                                            )}
                                            {plan._count && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {plan._count.verifications} verifications
                                                </Badge>
                                            )}
                                        </div>
                                        {plan.notes && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">{plan.notes}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="verifications" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Verifications</CardTitle>
                            <CardDescription>Eligibility checks and authorization tracking</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!verificationsData?.data?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>No verifications yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {verificationsData.data.map((verification: InsuranceVerification) => {
                                        const eligConfig = ELIGIBILITY_CONFIG[verification.eligibilityStatus];
                                        const EligIcon = eligConfig.icon;
                                        return (
                                            <div
                                                key={verification.id}
                                                className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-lg ${eligConfig.color}`}>
                                                        <EligIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{verification.patientName}</p>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <span>Member: {verification.memberNumber}</span>
                                                            {verification.groupNumber && (
                                                                <span>• Group: {verification.groupNumber}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {verification.authorizationRequired && (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                            Auth Required
                                                        </Badge>
                                                    )}
                                                    {verification.copay && (
                                                        <div className="text-right text-sm">
                                                            <p className="text-muted-foreground">Copay</p>
                                                            <p className="font-medium">${verification.copay}</p>
                                                        </div>
                                                    )}
                                                    <Badge variant={eligConfig.variant}>
                                                        {eligConfig.label}
                                                    </Badge>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="inquiries" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Insurance Inquiries</CardTitle>
                            <CardDescription>Questions about plan acceptance and coverage</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!inquiriesData?.data?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>No inquiries recorded</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {inquiriesData.data.map((inquiry: InsuranceInquiry) => (
                                        <div
                                            key={inquiry.id}
                                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${inquiry.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {inquiry.resolved ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{inquiry.carrierName || 'Unknown Carrier'} - {inquiry.inquiryType}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {inquiry.patientName || 'Unknown caller'} • {new Date(inquiry.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant={inquiry.resolved ? "default" : "secondary"}>
                                                {inquiry.resolved ? 'Resolved' : 'Pending'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* New Plan Form Modal */}
            {showNewPlanForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg mx-4">
                        <CardHeader>
                            <CardTitle>Add Insurance Plan</CardTitle>
                            <CardDescription>Configure an accepted insurance plan</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Carrier Name *</label>
                                <Input
                                    value={planData.carrierName}
                                    onChange={(e) => setPlanData({ ...planData, carrierName: e.target.value, carrierId: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                    placeholder="e.g., Blue Cross Blue Shield"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Plan Name *</label>
                                <Input
                                    value={planData.planName}
                                    onChange={(e) => setPlanData({ ...planData, planName: e.target.value })}
                                    placeholder="e.g., PPO Gold"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Plan Type</label>
                                <select
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={planData.planType}
                                    onChange={(e) => setPlanData({ ...planData, planType: e.target.value })}
                                >
                                    <option value="">Select type...</option>
                                    {PLAN_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isAccepted"
                                    checked={planData.isAccepted}
                                    onChange={(e) => setPlanData({ ...planData, isAccepted: e.target.checked })}
                                    className="rounded border-input"
                                />
                                <label htmlFor="isAccepted" className="text-sm">This plan is accepted at our facility</label>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Notes</label>
                                <textarea
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                                    value={planData.notes}
                                    onChange={(e) => setPlanData({ ...planData, notes: e.target.value })}
                                    placeholder="Coverage notes, limitations, etc."
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setShowNewPlanForm(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => createPlan.mutate(planData)}
                                    disabled={!planData.carrierName || !planData.planName || createPlan.isPending}
                                >
                                    {createPlan.isPending ? 'Saving...' : 'Add Plan'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Verification Form Modal */}
            {showVerificationForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>New Insurance Verification</CardTitle>
                            <CardDescription>Verify patient eligibility and authorization</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Insurance Plan *</label>
                                <select
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={verificationData.insurancePlanId}
                                    onChange={(e) => setVerificationData({ ...verificationData, insurancePlanId: e.target.value })}
                                >
                                    <option value="">Select plan...</option>
                                    {plans?.map(p => (
                                        <option key={p.id} value={p.id}>{p.carrierName} - {p.planName}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Patient Name *</label>
                                <Input
                                    value={verificationData.patientName}
                                    onChange={(e) => setVerificationData({ ...verificationData, patientName: e.target.value })}
                                    placeholder="Enter patient name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Member Number *</label>
                                    <Input
                                        value={verificationData.memberNumber}
                                        onChange={(e) => setVerificationData({ ...verificationData, memberNumber: e.target.value })}
                                        placeholder="Member ID"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Group Number</label>
                                    <Input
                                        value={verificationData.groupNumber}
                                        onChange={(e) => setVerificationData({ ...verificationData, groupNumber: e.target.value })}
                                        placeholder="Group ID"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Eligibility Status *</label>
                                <select
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={verificationData.eligibilityStatus}
                                    onChange={(e) => setVerificationData({ ...verificationData, eligibilityStatus: e.target.value as any })}
                                >
                                    {Object.entries(ELIGIBILITY_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>{config.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="authRequired"
                                    checked={verificationData.authorizationRequired}
                                    onChange={(e) => setVerificationData({ ...verificationData, authorizationRequired: e.target.checked })}
                                    className="rounded border-input"
                                />
                                <label htmlFor="authRequired" className="text-sm">Authorization required for services</label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Copay ($)</label>
                                    <Input
                                        type="number"
                                        value={verificationData.copay}
                                        onChange={(e) => setVerificationData({ ...verificationData, copay: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Deductible ($)</label>
                                    <Input
                                        type="number"
                                        value={verificationData.deductible}
                                        onChange={(e) => setVerificationData({ ...verificationData, deductible: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Notes</label>
                                <textarea
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                                    value={verificationData.notes}
                                    onChange={(e) => setVerificationData({ ...verificationData, notes: e.target.value })}
                                    placeholder="Additional verification details..."
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setShowVerificationForm(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => createVerification.mutate({
                                        ...verificationData,
                                        copay: verificationData.copay ? parseFloat(verificationData.copay) : undefined,
                                        deductible: verificationData.deductible ? parseFloat(verificationData.deductible) : undefined,
                                    })}
                                    disabled={!verificationData.insurancePlanId || !verificationData.patientName || !verificationData.memberNumber || createVerification.isPending}
                                >
                                    {createVerification.isPending ? 'Saving...' : 'Save Verification'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

