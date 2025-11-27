"use client";

import React, { useState, useMemo } from 'react';
import {
    Pill, CheckCircle, XCircle, Clock, User, Phone,
    Plus, Search, AlertTriangle, UserPlus, Building2,
    Loader2, Filter, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useHospital } from '@/lib/hospital-context';
import { useApiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PrescriptionRefill {
    id: string;
    hospitalId: string;
    callId?: string;
    patientId?: string;
    patientName: string;
    patientPhone: string;
    patientDOB?: string;
    medicationName: string;
    prescriberId?: string;
    prescriberName?: string;
    pharmacyName?: string;
    pharmacyPhone?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
    verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'FAILED';
    isNewPatient: boolean;
    assignedProviderId?: string;
    notes?: string;
    rejectionReason?: string;
    createdAt: string;
    updatedAt: string;
    patient?: any;
}

const STATUS_CONFIG = {
    PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock, color: 'text-amber-600 bg-amber-100' },
    APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-100' },
    REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600 bg-red-100' },
    COMPLETED: { label: 'Completed', variant: 'default' as const, icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
};

const VERIFICATION_CONFIG = {
    UNVERIFIED: { label: 'Unverified', variant: 'secondary' as const },
    VERIFIED: { label: 'Verified', variant: 'default' as const },
    FAILED: { label: 'Failed', variant: 'destructive' as const },
};

export default function PrescriptionsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const api = useApiClient();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewRefillForm, setShowNewRefillForm] = useState(false);
    const [selectedRefill, setSelectedRefill] = useState<PrescriptionRefill | null>(null);
    const [refillData, setRefillData] = useState({
        patientName: '',
        patientPhone: '',
        patientDOB: '',
        medicationName: '',
        prescriberName: '',
        pharmacyName: '',
        pharmacyPhone: '',
        notes: ''
    });

    // Fetch refills
    const { data: refillsData, isLoading: refillsLoading } = useQuery({
        queryKey: ['prescription-refills', hospitalId, statusFilter],
        queryFn: () => api.get<{ data: PrescriptionRefill[]; total: number }>(
            `/prescription-refills?hospitalId=${hospitalId}${statusFilter ? `&status=${statusFilter}` : ''}&limit=50`
        ),
        enabled: !!hospitalId,
    });

    // Fetch stats
    const { data: stats } = useQuery({
        queryKey: ['prescription-stats', hospitalId],
        queryFn: () => api.get<any>(`/prescription-refills/stats?hospitalId=${hospitalId}`),
        enabled: !!hospitalId,
    });

    // Create refill mutation
    const createRefill = useMutation({
        mutationFn: (data: typeof refillData) =>
            api.post('/prescription-refills', { ...data, hospitalId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prescription-refills'] });
            queryClient.invalidateQueries({ queryKey: ['prescription-stats'] });
            setShowNewRefillForm(false);
            setRefillData({
                patientName: '',
                patientPhone: '',
                patientDOB: '',
                medicationName: '',
                prescriberName: '',
                pharmacyName: '',
                pharmacyPhone: '',
                notes: ''
            });
        },
    });

    // Update status mutation
    const updateStatus = useMutation({
        mutationFn: ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) =>
            api.patch(`/prescription-refills/${id}/status`, { status, rejectionReason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prescription-refills'] });
            queryClient.invalidateQueries({ queryKey: ['prescription-stats'] });
            setSelectedRefill(null);
        },
    });

    const filteredRefills = useMemo(() => {
        if (!refillsData?.data) return [];
        return refillsData.data.filter(refill => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                refill.patientName.toLowerCase().includes(query) ||
                refill.medicationName.toLowerCase().includes(query) ||
                refill.patientPhone.includes(query)
            );
        });
    }, [refillsData, searchQuery]);

    const isLoading = hospitalLoading || refillsLoading;

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
                    <h1 className="text-3xl font-bold tracking-tight">Prescription Refills</h1>
                    <p className="text-muted-foreground">
                        Handle medication refill requests with patient verification
                    </p>
                </div>
                <Button onClick={() => setShowNewRefillForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Refill Request
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Requests</CardDescription>
                        <CardTitle className="text-2xl">{stats?.totalRequests || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>Pending</CardDescription>
                        <CardTitle className="text-2xl text-amber-600">{stats?.pendingCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>Approved</CardDescription>
                        <CardTitle className="text-2xl text-emerald-600">{stats?.approvedCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>New Patients</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">{stats?.newPatientCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Approval Rate</CardDescription>
                        <CardTitle className="text-2xl">{(stats?.approvalRate || 0).toFixed(1)}%</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* New Patient Conversion Alert */}
            {(stats?.newPatientCount || 0) > 0 && (
                <Card className="border-blue-200 bg-blue-50/30">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <UserPlus className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium">New Patient Conversion Opportunity</p>
                                <p className="text-sm text-muted-foreground">
                                    {stats?.newPatientCount} callers are not existing patients. Assign a provider to establish care and prevent patient leakage.
                                </p>
                            </div>
                            <Button size="sm" variant="outline">
                                View New Patients
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search and Filter */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by patient name, medication, or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={statusFilter === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(null)}
                    >
                        All
                    </Button>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <Button
                            key={key}
                            variant={statusFilter === key ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                        >
                            {config.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Refills List */}
            <Card>
                <CardHeader>
                    <CardTitle>Refill Requests</CardTitle>
                    <CardDescription>
                        {filteredRefills.length} request{filteredRefills.length !== 1 ? 's' : ''} found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredRefills.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Pill className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No refill requests found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredRefills.map(refill => {
                                const statusConfig = STATUS_CONFIG[refill.status];
                                const StatusIcon = statusConfig.icon;
                                return (
                                    <div
                                        key={refill.id}
                                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedRefill(refill)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                                                <StatusIcon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{refill.medicationName}</p>
                                                    {refill.isNewPatient && (
                                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                            <UserPlus className="h-3 w-3 mr-1" />
                                                            New Patient
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" /> {refill.patientName}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3" /> {refill.patientPhone}
                                                    </span>
                                                    {refill.prescriberName && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                <Building2 className="h-3 w-3" /> {refill.prescriberName}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right text-sm">
                                                <p className="text-muted-foreground">
                                                    {new Date(refill.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <Badge variant={VERIFICATION_CONFIG[refill.verificationStatus].variant}>
                                                {VERIFICATION_CONFIG[refill.verificationStatus].label}
                                            </Badge>
                                            <Badge variant={statusConfig.variant}>
                                                {statusConfig.label}
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

            {/* New Refill Form Modal */}
            {showNewRefillForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>New Prescription Refill Request</CardTitle>
                            <CardDescription>Record a patient refill request from a call</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Patient Name *</label>
                                    <Input
                                        value={refillData.patientName}
                                        onChange={(e) => setRefillData({ ...refillData, patientName: e.target.value })}
                                        placeholder="Enter patient name"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Phone Number *</label>
                                    <Input
                                        value={refillData.patientPhone}
                                        onChange={(e) => setRefillData({ ...refillData, patientPhone: e.target.value })}
                                        placeholder="555-123-4567"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Date of Birth</label>
                                    <Input
                                        type="date"
                                        value={refillData.patientDOB}
                                        onChange={(e) => setRefillData({ ...refillData, patientDOB: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Medication Name *</label>
                                    <Input
                                        value={refillData.medicationName}
                                        onChange={(e) => setRefillData({ ...refillData, medicationName: e.target.value })}
                                        placeholder="Enter medication name"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Prescribing Physician</label>
                                    <Input
                                        value={refillData.prescriberName}
                                        onChange={(e) => setRefillData({ ...refillData, prescriberName: e.target.value })}
                                        placeholder="Dr. Name"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Pharmacy Name</label>
                                    <Input
                                        value={refillData.pharmacyName}
                                        onChange={(e) => setRefillData({ ...refillData, pharmacyName: e.target.value })}
                                        placeholder="Pharmacy name"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Pharmacy Phone</label>
                                    <Input
                                        value={refillData.pharmacyPhone}
                                        onChange={(e) => setRefillData({ ...refillData, pharmacyPhone: e.target.value })}
                                        placeholder="555-456-7890"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Notes</label>
                                    <textarea
                                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                                        value={refillData.notes}
                                        onChange={(e) => setRefillData({ ...refillData, notes: e.target.value })}
                                        placeholder="Additional details..."
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowNewRefillForm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => createRefill.mutate(refillData)}
                                    disabled={!refillData.patientName || !refillData.patientPhone || !refillData.medicationName || createRefill.isPending}
                                >
                                    {createRefill.isPending ? 'Saving...' : 'Submit Request'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Refill Detail Modal */}
            {selectedRefill && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-lg mx-4">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{selectedRefill.medicationName}</CardTitle>
                                    <CardDescription>Refill Request Details</CardDescription>
                                </div>
                                <Badge variant={STATUS_CONFIG[selectedRefill.status].variant}>
                                    {STATUS_CONFIG[selectedRefill.status].label}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Patient</p>
                                    <p className="font-medium">{selectedRefill.patientName}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Phone</p>
                                    <p className="font-medium">{selectedRefill.patientPhone}</p>
                                </div>
                                {selectedRefill.prescriberName && (
                                    <div>
                                        <p className="text-muted-foreground">Prescriber</p>
                                        <p className="font-medium">{selectedRefill.prescriberName}</p>
                                    </div>
                                )}
                                {selectedRefill.pharmacyName && (
                                    <div>
                                        <p className="text-muted-foreground">Pharmacy</p>
                                        <p className="font-medium">{selectedRefill.pharmacyName}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-muted-foreground">Patient Status</p>
                                    <Badge variant={selectedRefill.isNewPatient ? "outline" : "default"}>
                                        {selectedRefill.isNewPatient ? 'New Patient' : 'Existing Patient'}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Verification</p>
                                    <Badge variant={VERIFICATION_CONFIG[selectedRefill.verificationStatus].variant}>
                                        {VERIFICATION_CONFIG[selectedRefill.verificationStatus].label}
                                    </Badge>
                                </div>
                            </div>
                            {selectedRefill.notes && (
                                <div>
                                    <p className="text-muted-foreground text-sm">Notes</p>
                                    <p className="text-sm bg-muted p-2 rounded">{selectedRefill.notes}</p>
                                </div>
                            )}
                            {selectedRefill.rejectionReason && (
                                <div className="bg-red-50 p-3 rounded-lg">
                                    <p className="text-sm font-medium text-red-700">Rejection Reason</p>
                                    <p className="text-sm text-red-600">{selectedRefill.rejectionReason}</p>
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setSelectedRefill(null)}
                                >
                                    Close
                                </Button>
                                {selectedRefill.status === 'PENDING' && (
                                    <>
                                        <Button
                                            variant="destructive"
                                            onClick={() => updateStatus.mutate({ id: selectedRefill.id, status: 'REJECTED', rejectionReason: 'Request denied by supervisor' })}
                                            disabled={updateStatus.isPending}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            onClick={() => updateStatus.mutate({ id: selectedRefill.id, status: 'APPROVED' })}
                                            disabled={updateStatus.isPending}
                                        >
                                            Approve
                                        </Button>
                                    </>
                                )}
                                {selectedRefill.status === 'APPROVED' && (
                                    <Button
                                        onClick={() => updateStatus.mutate({ id: selectedRefill.id, status: 'COMPLETED' })}
                                        disabled={updateStatus.isPending}
                                    >
                                        Mark Complete
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

