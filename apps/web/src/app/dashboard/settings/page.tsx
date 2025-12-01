"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from "@/components/dashboard/shared";
import { useHospital } from '@/lib/hospital-context';
import { useHospitals } from '@/lib/hooks/query-hooks';
import { useApiClient } from '@/lib/api-client';
import { CheckCircle, Building2, Plus } from 'lucide-react';

export default function GeneralSettingsPage() {
    const { hospitalId, setHospitalId, isLoading: hospitalContextLoading } = useHospital();
    const { data: hospitals, isLoading: hospitalsLoading, refetch } = useHospitals();
    const api = useApiClient();

    const [isCreating, setIsCreating] = useState(false);
    const [newHospitalName, setNewHospitalName] = useState('');
    const [newHospitalSlug, setNewHospitalSlug] = useState('');
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState(false);

    // Auto-generate slug from name
    useEffect(() => {
        setNewHospitalSlug(newHospitalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }, [newHospitalName]);

    const handleCreateHospital = async () => {
        if (!newHospitalName.trim()) {
            setCreateError('Hospital name is required');
            return;
        }

        setCreateError('');
        setIsCreating(true);

        try {
            const result = await api.post<{ id: string }>('/hospitals', {
                name: newHospitalName,
                slug: newHospitalSlug || newHospitalName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                timezone: 'America/New_York',
            });

            setHospitalId(result.id);
            setCreateSuccess(true);
            setNewHospitalName('');
            setNewHospitalSlug('');
            refetch();
        } catch (error: any) {
            setCreateError(error?.message || 'Failed to create hospital');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectHospital = (id: string) => {
        setHospitalId(id);
    };

    const isLoading = hospitalContextLoading || hospitalsLoading;

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">General Settings</h1>
                <p className="text-muted-foreground">Manage your hospital and organization settings.</p>
            </div>

            <div className="space-y-6">
                {/* Hospital Selection Card */}
                <Card title="Hospital Selection" className="relative">
                    {createSuccess && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700">
                            <CheckCircle className="w-5 h-5" />
                            Hospital created successfully!
                        </div>
                    )}

                    {!hospitalId && !isLoading && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                            No hospital selected. Please select or create a hospital to continue.
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                                Your Hospitals
                            </label>
                            
                            {isLoading ? (
                                <div className="text-center py-4 text-muted-foreground">Loading hospitals...</div>
                            ) : hospitals && hospitals.length > 0 ? (
                                <div className="space-y-2">
                                    {hospitals.map((hospital: any) => (
                                        <div
                                            key={hospital.id}
                                            onClick={() => handleSelectHospital(hospital.id)}
                                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                                                hospitalId === hospital.id
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Building2 className="w-5 h-5 text-muted-foreground" />
                                                <div>
                                                    <div className="font-medium text-foreground">{hospital.name}</div>
                                                    <div className="text-xs text-muted-foreground">{hospital.slug}</div>
                                                </div>
                                            </div>
                                            {hospitalId === hospital.id && (
                                                <CheckCircle className="w-5 h-5 text-primary" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
                                    <Building2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                                    <p>No hospitals found. Create one below.</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-border">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                                Create New Hospital
                            </label>
                            
                            {createError && (
                                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {createError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Hospital Name"
                                        value={newHospitalName}
                                        onChange={(e) => setNewHospitalName(e.target.value)}
                                        className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Slug (auto-generated)"
                                        value={newHospitalSlug}
                                        onChange={(e) => setNewHospitalSlug(e.target.value)}
                                        className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="mt-3">
                                <Button
                                    variant="primary"
                                    onClick={handleCreateHospital}
                                    disabled={isCreating || !newHospitalName.trim()}
                                    icon={Plus}
                                >
                                    {isCreating ? 'Creating...' : 'Create Hospital'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Profile Card */}
                <Card title="Profile Information">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="flex-shrink-0">
                            <div className="w-20 h-20 rounded-full bg-slate-200 border-4 border-white shadow-sm overflow-hidden flex items-center justify-center text-xl font-bold text-slate-500">
                                JD
                            </div>
                            <button className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700 w-full text-center">Change Avatar</button>
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Full Name</label>
                                <input type="text" defaultValue="Jane Doe" className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none bg-muted/50 focus:bg-card transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Email Address</label>
                                <input type="email" defaultValue="jane.doe@stmarys.org" className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none bg-muted/50 focus:bg-card transition-colors" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Role</label>
                                <input type="text" defaultValue="Operations Director" disabled className="w-full p-2.5 border border-border rounded-lg text-sm text-muted-foreground bg-muted cursor-not-allowed" />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
