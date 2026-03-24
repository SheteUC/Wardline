"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, neoFieldClass } from "@/components/dashboard/shared";
import { useBusiness } from '@/lib/business-context';
import { useBusinesses } from '@/lib/hooks/query-hooks';
import { useApiClient } from '@/lib/api-client';
import { CheckCircle, Building2, Plus } from 'lucide-react';

export default function GeneralSettingsPage() {
    const { businessId, setBusinessId, isLoading: businessContextLoading } = useBusiness();
    const { data: businesses, isLoading: businessesLoading, refetch } = useBusinesses();
    const api = useApiClient();

    const [isCreating, setIsCreating] = useState(false);
    const [newBusinessName, setNewBusinessName] = useState('');
    const [newBusinessSlug, setNewBusinessSlug] = useState('');
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState(false);

    // Auto-generate slug from name
    useEffect(() => {
        setNewBusinessSlug(newBusinessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }, [newBusinessName]);

    const handleCreateBusiness = async () => {
        if (!newBusinessName.trim()) {
            setCreateError('Practice name is required');
            return;
        }

        setCreateError('');
        setIsCreating(true);

        try {
            const result = await api.post<{ id: string }>('/businesses', {
                name: newBusinessName,
                slug: newBusinessSlug || newBusinessName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                timeZone: 'America/New_York',
            });

            setBusinessId(result.id);
            setCreateSuccess(true);
            setNewBusinessName('');
            setNewBusinessSlug('');
            refetch();
        } catch (error: any) {
            setCreateError(error?.message || 'Failed to create practice');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectBusiness = (id: string) => {
        setBusinessId(id);
    };

    const isLoading = businessContextLoading || businessesLoading;

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground">General Settings</h1>
                <p className="text-muted-foreground">Manage your practice and organization settings.</p>
            </div>

            <div className="space-y-6">
                <Card title="Practice Selection" className="relative">
                    {createSuccess && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700">
                            <CheckCircle className="w-5 h-5" />
                            Practice created successfully!
                        </div>
                    )}

                    {!businessId && !isLoading && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                            No business selected. Please select or create a practice to continue.
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                                Your Practices
                            </label>
                            
                            {isLoading ? (
                                <div className="text-center py-4 text-muted-foreground">Loading practices...</div>
                            ) : businesses && businesses.length > 0 ? (
                                <div className="space-y-2">
                                    {businesses.map((business: any) => (
                                        <div
                                            key={business.id}
                                            onClick={() => handleSelectBusiness(business.id)}
                                            className={`flex cursor-pointer items-center justify-between rounded-2xl p-4 transition-all ${
                                                businessId === business.id
                                                    ? 'bg-[var(--background)] text-foreground neo-raised'
                                                    : 'bg-[var(--background)] neo-inset hover:opacity-95'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground">{business.name}</div>
                                                    <div className="text-xs text-muted-foreground">{business.slug}</div>
                                                </div>
                                            </div>
                                            {businessId === business.id && (
                                                <CheckCircle className="w-5 h-5 text-primary" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border-2 border-dashed border-transparent py-8 text-center text-muted-foreground neo-inset">
                                    <Building2 className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
                                    <p>No practices found. Create one below.</p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border/40 pt-6">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">
                                Create New Practice
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
                                        placeholder="Practice Name"
                                        value={newBusinessName}
                                        onChange={(e) => setNewBusinessName(e.target.value)}
                                        className={neoFieldClass}
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Slug (auto-generated)"
                                        value={newBusinessSlug}
                                        onChange={(e) => setNewBusinessSlug(e.target.value)}
                                        className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="mt-3">
                                <Button
                                    variant="primary"
                                    onClick={handleCreateBusiness}
                                    disabled={isCreating || !newBusinessName.trim()}
                                    icon={Plus}
                                >
                                    {isCreating ? 'Creating...' : 'Create Practice'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Profile Card */}
                <Card title="Profile Information">
                    <div className="flex flex-col items-start gap-6 md:flex-row">
                        <div className="flex-shrink-0">
                            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--background)] text-xl font-bold text-muted-foreground neo-inset">
                                JD
                            </div>
                            <button type="button" className="mt-2 w-full text-center text-xs font-semibold text-primary hover:underline">
                                Change avatar
                            </button>
                        </div>
                        <div className="grid w-full flex-1 grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Full name</label>
                                <input type="text" defaultValue="Jane Doe" className={neoFieldClass} />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Email address</label>
                                <input type="email" defaultValue="jane.doe@stmarys.org" className={neoFieldClass} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Role</label>
                                <input type="text" defaultValue="Operations Director" disabled className={`${neoFieldClass} cursor-not-allowed opacity-70`} />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
