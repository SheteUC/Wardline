"use client";

import React, { useState, useMemo } from 'react';
import {
    Building2, Phone, Mail, MapPin, Clock, Search,
    Plus, Edit, ChevronRight, PhoneCall, CheckCircle,
    AlertCircle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useHospital } from '@/lib/hospital-context';
import { useApiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Department {
    id: string;
    hospitalId: string;
    name: string;
    description?: string;
    serviceTypes: string[];
    phoneNumber: string;
    extension?: string;
    emailAddress?: string;
    location?: string;
    hoursOfOperation?: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: { directoryInquiries: number };
}

interface DirectoryInquiry {
    id: string;
    serviceType: string;
    patientName?: string;
    patientPhone?: string;
    resolved: boolean;
    createdAt: string;
    department?: Department;
}

const SERVICE_TYPES = [
    'X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'Laboratory',
    'Emergency', 'Cardiology', 'Orthopedics', 'Pediatrics',
    'Pharmacy', 'Billing', 'Records', 'Admissions'
];

export default function DepartmentsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const api = useApiClient();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedService, setSelectedService] = useState<string | null>(null);
    const [showInquiryForm, setShowInquiryForm] = useState(false);
    const [inquiryData, setInquiryData] = useState({
        serviceType: '',
        patientName: '',
        patientPhone: '',
        notes: ''
    });

    // Fetch departments
    const { data: departments, isLoading: depsLoading } = useQuery({
        queryKey: ['departments', hospitalId],
        queryFn: () => api.get<Department[]>(`/departments?hospitalId=${hospitalId}`),
        enabled: !!hospitalId,
    });

    // Fetch recent inquiries
    const { data: inquiriesData } = useQuery({
        queryKey: ['directory-inquiries', hospitalId],
        queryFn: () => api.get<{ data: DirectoryInquiry[]; total: number }>(`/departments/inquiries?hospitalId=${hospitalId}&limit=10`),
        enabled: !!hospitalId,
    });

    // Fetch stats
    const { data: stats } = useQuery({
        queryKey: ['department-stats', hospitalId],
        queryFn: () => api.get<any>(`/departments/stats?hospitalId=${hospitalId}`),
        enabled: !!hospitalId,
    });

    // Create inquiry mutation
    const createInquiry = useMutation({
        mutationFn: (data: typeof inquiryData) =>
            api.post('/departments/inquiries', { ...data, hospitalId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['directory-inquiries'] });
            setShowInquiryForm(false);
            setInquiryData({ serviceType: '', patientName: '', patientPhone: '', notes: '' });
        },
    });

    const filteredDepartments = useMemo(() => {
        if (!departments) return [];
        return departments.filter(dept => {
            const matchesSearch = !searchQuery ||
                dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dept.serviceTypes.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesService = !selectedService ||
                dept.serviceTypes.includes(selectedService);
            return matchesSearch && matchesService;
        });
    }, [departments, searchQuery, selectedService]);

    const isLoading = hospitalLoading || depsLoading;

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
                    <h1 className="text-3xl font-bold tracking-tight">Department Directory</h1>
                    <p className="text-muted-foreground">
                        Route patients to the right department for appointments and services
                    </p>
                </div>
                <Button onClick={() => setShowInquiryForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Log Inquiry
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Departments</CardDescription>
                        <CardTitle className="text-2xl">{departments?.length || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Inquiries</CardDescription>
                        <CardTitle className="text-2xl">{stats?.totalInquiries || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Resolved</CardDescription>
                        <CardTitle className="text-2xl text-emerald-600">{stats?.resolvedCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Resolution Rate</CardDescription>
                        <CardTitle className="text-2xl">{(stats?.resolutionRate || 0).toFixed(1)}%</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Search and Filter */}
            <Card>
                <CardHeader>
                    <CardTitle>Find a Department</CardTitle>
                    <CardDescription>Search by name or service type to route patients correctly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search departments or services..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={selectedService === null ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedService(null)}
                        >
                            All Services
                        </Button>
                        {SERVICE_TYPES.slice(0, 8).map(service => (
                            <Button
                                key={service}
                                variant={selectedService === service ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedService(selectedService === service ? null : service)}
                            >
                                {service}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Departments Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDepartments.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No departments found matching your search</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredDepartments.map(dept => (
                        <Card key={dept.id} className="hover:border-primary transition-colors">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Building2 className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{dept.name}</CardTitle>
                                            {dept.location && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" /> {dept.location}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant={dept.isActive ? "default" : "secondary"}>
                                        {dept.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-wrap gap-1">
                                    {dept.serviceTypes.slice(0, 4).map(service => (
                                        <Badge key={service} variant="outline" className="text-xs">
                                            {service}
                                        </Badge>
                                    ))}
                                    {dept.serviceTypes.length > 4 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{dept.serviceTypes.length - 4} more
                                        </Badge>
                                    )}
                                </div>
                                <div className="space-y-1 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="h-4 w-4" />
                                        <span>{dept.phoneNumber}</span>
                                        {dept.extension && <span className="text-xs">(ext. {dept.extension})</span>}
                                    </div>
                                    {dept.emailAddress && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Mail className="h-4 w-4" />
                                            <span className="truncate">{dept.emailAddress}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-2 flex gap-2">
                                    <Button size="sm" className="flex-1" asChild>
                                        <a href={`tel:${dept.phoneNumber}`}>
                                            <PhoneCall className="h-4 w-4 mr-1" />
                                            Call
                                        </a>
                                    </Button>
                                    <Button size="sm" variant="outline">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Recent Inquiries */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Recent Directory Inquiries</CardTitle>
                            <CardDescription>Track patient routing requests</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!inquiriesData?.data?.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No inquiries recorded yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {inquiriesData.data.map((inquiry: DirectoryInquiry) => (
                                <div
                                    key={inquiry.id}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${inquiry.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {inquiry.resolved ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="font-medium">{inquiry.serviceType}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {inquiry.patientName || 'Unknown caller'} • {new Date(inquiry.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {inquiry.department && (
                                            <Badge variant="outline">{inquiry.department.name}</Badge>
                                        )}
                                        <Badge variant={inquiry.resolved ? "default" : "secondary"}>
                                            {inquiry.resolved ? 'Resolved' : 'Pending'}
                                        </Badge>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Inquiry Form Modal */}
            {showInquiryForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>Log Directory Inquiry</CardTitle>
                            <CardDescription>Record a patient routing request</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Service Type</label>
                                <select
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={inquiryData.serviceType}
                                    onChange={(e) => setInquiryData({ ...inquiryData, serviceType: e.target.value })}
                                >
                                    <option value="">Select service...</option>
                                    {SERVICE_TYPES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Patient Name (optional)</label>
                                <Input
                                    value={inquiryData.patientName}
                                    onChange={(e) => setInquiryData({ ...inquiryData, patientName: e.target.value })}
                                    placeholder="Enter patient name"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Patient Phone (optional)</label>
                                <Input
                                    value={inquiryData.patientPhone}
                                    onChange={(e) => setInquiryData({ ...inquiryData, patientPhone: e.target.value })}
                                    placeholder="Enter phone number"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Notes</label>
                                <textarea
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                                    value={inquiryData.notes}
                                    onChange={(e) => setInquiryData({ ...inquiryData, notes: e.target.value })}
                                    placeholder="Additional details..."
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowInquiryForm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => createInquiry.mutate(inquiryData)}
                                    disabled={!inquiryData.serviceType || createInquiry.isPending}
                                >
                                    {createInquiry.isPending ? 'Saving...' : 'Save Inquiry'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

