"use client";

import React, { useState } from 'react';
import {
    Plus, Search, Play, Edit, Archive, CheckCircle, Clock
} from 'lucide-react';
import { Card, Button, Badge } from "@/components/dashboard/shared";
import Link from 'next/link';
import { useWorkflows } from '@/lib/hooks/query-hooks';
import { useHospital } from '@/lib/hospital-context';
import { formatDistanceToNow } from 'date-fns';
import { WorkflowStatus } from '@wardline/types';

function getStatusBadge(status: WorkflowStatus) {
    if (status === WorkflowStatus.PUBLISHED) return { type: 'success' as const, text: 'Published' };
    if (status === WorkflowStatus.DRAFT) return { type: 'secondary' as const, text: 'Draft' };
    return { type: 'secondary' as const, text: 'Archived' };
}

export default function WorkflowsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const { data: workflows, isLoading, error } = useWorkflows();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredWorkflows = React.useMemo(() => {
        if (!workflows) return [];
        return workflows.filter(workflow =>
            workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            workflow.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [workflows, searchTerm]);

    if (hospitalLoading || !hospitalId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-muted-foreground">Loading workflows...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Workflows</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Design and manage call routing workflows
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search workflows..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring w-64"
                        />
                    </div>
                    <Link href="/dashboard/workflows/new">
                        <Button variant="primary" icon={Plus}>Create Workflow</Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-muted-foreground">Loading workflows...</div>
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-red-600">Error loading workflows. Please try again.</div>
                </div>
            ) : filteredWorkflows.length === 0 ? (
                <Card className="min-h-[400px]">
                    <div className="flex flex-col items-center justify-center h-96 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Plus className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">No workflows found</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md">
                            Create your first workflow to automate call routing and triage
                        </p>
                        <Link href="/dashboard/workflows/new">
                            <Button variant="primary" icon={Plus}>Create Workflow</Button>
                        </Link>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredWorkflows.map((workflow) => {
                        const statusBadge = getStatusBadge(workflow.status);
                        const hasActiveVersion = !!workflow.activeVersionId;

                        return (
                            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                                <div className="flex flex-col h-full">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-foreground mb-1">{workflow.name}</h3>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {workflow.description || 'No description'}
                                            </p>
                                        </div>
                                        <Badge {...statusBadge} />
                                    </div>

                                    <div className="flex-1 space-y-2 mb-4">
                                        {hasActiveVersion ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                <span>Version {workflow.activeVersion?.version}</span>
                                                {workflow.activeVersion?.publishedAt && (
                                                    <span className="text-xs">
                                                        · Published {formatDistanceToNow(new Date(workflow.activeVersion.publishedAt), { addSuffix: true })}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="w-4 h-4" />
                                                <span>No active version</span>
                                            </div>
                                        )}

                                        <div className="text-xs text-muted-foreground">
                                            Updated {formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true })}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-4 border-t border-border">
                                        <Link href={`/dashboard/workflows/${workflow.id}`} className="flex-1">
                                            <Button variant="secondary" icon={Edit} className="w-full text-xs">
                                                Edit
                                            </Button>
                                        </Link>
                                        {hasActiveVersion && (
                                            <Button variant="ghost" icon={Play} className="text-xs">
                                                Test
                                            </Button>
                                        )}
                                        <Button variant="ghost" icon={Archive} className="text-xs">
                                            Archive
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
