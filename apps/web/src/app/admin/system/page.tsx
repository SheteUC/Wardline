"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Building2, Phone, GitBranch, Activity, Server, CheckCircle, AlertTriangle,
    XCircle, Clock, ChevronRight, ExternalLink, RefreshCw, Settings, FileText,
    TrendingUp, Users, Zap
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type {
    SystemOverview,
    WorkflowSummary,
    PhoneNumberRouting,
    IntegrationHealth,
    ConfigAuditEntry
} from '@/lib/patient-types';

/**
 * System Admin Dashboard
 * High-level control panel for IVR/AI workflow setup and platform configuration
 */

// Mock data for demonstration
const mockSystemOverview: SystemOverview = {
    totalHospitals: 12,
    activePhoneNumbers: 34,
    publishedWorkflows: 28,
    todayCallsTotal: 1847,
};

const mockWorkflows: WorkflowSummary[] = [
    {
        id: 'wf-001',
        hospitalId: 'h-001',
        hospitalName: 'Memorial General Hospital',
        name: 'Main Triage Flow',
        status: 'published',
        lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        activeVersion: 3,
    },
    {
        id: 'wf-002',
        hospitalId: 'h-002',
        hospitalName: 'City Medical Center',
        name: 'After Hours Support',
        status: 'draft',
        lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        activeVersion: undefined,
    },
    {
        id: 'wf-003',
        hospitalId: 'h-001',
        hospitalName: 'Memorial General Hospital',
        name: 'Emergency Screening',
        status: 'published',
        lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        activeVersion: 5,
    },
    {
        id: 'wf-004',
        hospitalId: 'h-003',
        hospitalName: 'Riverside Health',
        name: 'Appointment Booking',
        status: 'published',
        lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        activeVersion: 2,
    },
];

const mockPhoneNumbers: PhoneNumberRouting[] = [
    {
        id: 'pn-001',
        phoneNumber: '+1 (800) 555-0101',
        hospitalId: 'h-001',
        hospitalName: 'Memorial General Hospital',
        workflowId: 'wf-001',
        workflowName: 'Main Triage Flow',
        status: 'active',
    },
    {
        id: 'pn-002',
        phoneNumber: '+1 (800) 555-0102',
        hospitalId: 'h-002',
        hospitalName: 'City Medical Center',
        workflowId: 'wf-002',
        workflowName: 'After Hours Support',
        status: 'active',
    },
    {
        id: 'pn-003',
        phoneNumber: '+1 (800) 555-0103',
        hospitalId: 'h-003',
        hospitalName: 'Riverside Health',
        workflowId: undefined,
        workflowName: undefined,
        status: 'inactive',
    },
];

const mockIntegrations: IntegrationHealth[] = [
    {
        name: 'Twilio',
        status: 'ok',
        lastCheck: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        message: 'All systems operational',
    },
    {
        name: 'Azure OpenAI',
        status: 'ok',
        lastCheck: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        message: 'GPT-4 responding normally',
    },
    {
        name: 'TimeTap Scheduling',
        status: 'degraded',
        lastCheck: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        message: 'Elevated response times (avg 2.3s)',
    },
    {
        name: 'Stripe Billing',
        status: 'ok',
        lastCheck: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        message: 'Payment processing normal',
    },
];

const mockAuditLog: ConfigAuditEntry[] = [
    {
        id: 'audit-001',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        userId: 'u-001',
        userName: 'John Admin',
        action: 'Published workflow',
        entityType: 'Workflow',
        entityId: 'wf-001',
        hospitalId: 'h-001',
        hospitalName: 'Memorial General Hospital',
        details: 'Main Triage Flow v3',
    },
    {
        id: 'audit-002',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        userId: 'u-002',
        userName: 'Sarah Config',
        action: 'Changed routing',
        entityType: 'PhoneNumber',
        entityId: 'pn-002',
        hospitalId: 'h-002',
        hospitalName: 'City Medical Center',
        details: '+1 (800) 555-0102 → After Hours Support',
    },
    {
        id: 'audit-003',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        userId: 'u-001',
        userName: 'John Admin',
        action: 'Onboarded hospital',
        entityType: 'Hospital',
        entityId: 'h-004',
        hospitalName: 'Valley Care Center',
    },
    {
        id: 'audit-004',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        userId: 'u-003',
        userName: 'Mike Ops',
        action: 'Updated integration',
        entityType: 'Integration',
        entityId: 'int-001',
        details: 'Refreshed Twilio API credentials',
    },
];

export default function SystemAdminDashboardPage() {
    const [editingRouting, setEditingRouting] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            {/* System Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <OverviewCard
                    icon={Building2}
                    label="Hospitals Onboarded"
                    value={mockSystemOverview.totalHospitals}
                    color="indigo"
                />
                <OverviewCard
                    icon={Phone}
                    label="Active Phone Numbers"
                    value={mockSystemOverview.activePhoneNumbers}
                    color="emerald"
                />
                <OverviewCard
                    icon={GitBranch}
                    label="Published Workflows"
                    value={mockSystemOverview.publishedWorkflows}
                    color="purple"
                />
                <OverviewCard
                    icon={Activity}
                    label="Today's Calls (System)"
                    value={mockSystemOverview.todayCallsTotal.toLocaleString()}
                    color="amber"
                    trend="+12%"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* IVR & Workflow Configuration */}
                <div className="bg-white rounded-xl border border-border shadow-sm">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-50 p-2 rounded-lg">
                                <GitBranch className="w-5 h-5 text-purple-600" />
                            </div>
                            <h2 className="font-semibold text-foreground">Workflow Configuration</h2>
                        </div>
                        <Link
                            href="/admin/system/workflows"
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            View All
                        </Link>
                    </div>
                    <div className="p-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-muted-foreground border-b border-border">
                                        <th className="pb-3 font-medium">Workflow</th>
                                        <th className="pb-3 font-medium">Hospital</th>
                                        <th className="pb-3 font-medium">Status</th>
                                        <th className="pb-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {mockWorkflows.slice(0, 4).map((workflow) => (
                                        <tr key={workflow.id} className="hover:bg-muted/30">
                                            <td className="py-3">
                                                <div className="font-medium text-foreground">{workflow.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Updated {formatDistanceToNow(new Date(workflow.lastUpdated), { addSuffix: true })}
                                                </div>
                                            </td>
                                            <td className="py-3 text-muted-foreground">
                                                {workflow.hospitalName}
                                            </td>
                                            <td className="py-3">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                    workflow.status === 'published'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : workflow.status === 'draft'
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                                                    {workflow.activeVersion && ` v${workflow.activeVersion}`}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/dashboard/workflows/${workflow.id}`}
                                                        className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        title="Open Workflow Builder"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        title="View Version History"
                                                    >
                                                        <Clock className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Phone Numbers & Routing */}
                <div className="bg-white rounded-xl border border-border shadow-sm">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-50 p-2 rounded-lg">
                                <Phone className="w-5 h-5 text-emerald-600" />
                            </div>
                            <h2 className="font-semibold text-foreground">Phone Numbers & Routing</h2>
                        </div>
                        <Link
                            href="/admin/system/phone-numbers"
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            View All
                        </Link>
                    </div>
                    <div className="p-4">
                        <div className="space-y-3">
                            {mockPhoneNumbers.map((pn) => (
                                <div 
                                    key={pn.id}
                                    className="p-3 border border-border rounded-lg hover:border-indigo-200 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2 h-2 rounded-full ${
                                                pn.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground'
                                            }`} />
                                            <div>
                                                <p className="font-mono text-sm font-medium">{pn.phoneNumber}</p>
                                                <p className="text-xs text-muted-foreground">{pn.hospitalName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                pn.workflowName 
                                                    ? 'bg-indigo-50 text-indigo-700' 
                                                    : 'bg-amber-50 text-amber-700'
                                            }`}>
                                                {pn.workflowName || 'No workflow'}
                                            </span>
                                            <button
                                                onClick={() => setEditingRouting(pn.id)}
                                                className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="Edit Routing"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Integration Health */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-50 p-2 rounded-lg">
                            <Server className="w-5 h-5 text-cyan-600" />
                        </div>
                        <h2 className="font-semibold text-foreground">Integration Health</h2>
                    </div>
                    <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {mockIntegrations.map((integration) => (
                            <IntegrationTile key={integration.name} integration={integration} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Config Change Audit */}
            <div className="bg-white rounded-xl border border-border shadow-sm">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg">
                            <FileText className="w-5 h-5 text-slate-600" />
                        </div>
                        <h2 className="font-semibold text-foreground">Recent Configuration Changes</h2>
                    </div>
                    <Link
                        href="/admin/system/audit-log"
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                        View Full Log
                    </Link>
                </div>
                <div className="p-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted-foreground border-b border-border">
                                    <th className="pb-3 font-medium">Time</th>
                                    <th className="pb-3 font-medium">User</th>
                                    <th className="pb-3 font-medium">Action</th>
                                    <th className="pb-3 font-medium">Hospital</th>
                                    <th className="pb-3 font-medium">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {mockAuditLog.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-muted/30">
                                        <td className="py-3 text-muted-foreground">
                                            {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                                        </td>
                                        <td className="py-3 font-medium">{entry.userName}</td>
                                        <td className="py-3">
                                            <span className="px-2 py-1 bg-muted text-foreground text-xs rounded">
                                                {entry.action}
                                            </span>
                                        </td>
                                        <td className="py-3 text-muted-foreground">
                                            {entry.hospitalName || '—'}
                                        </td>
                                        <td className="py-3 text-muted-foreground truncate max-w-[200px]">
                                            {entry.details || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit Routing Modal */}
            {editingRouting && (
                <EditRoutingModal
                    phoneNumber={mockPhoneNumbers.find(pn => pn.id === editingRouting)!}
                    workflows={mockWorkflows}
                    onClose={() => setEditingRouting(null)}
                    onSave={(data) => {
                        console.log('Save routing:', data);
                        setEditingRouting(null);
                    }}
                />
            )}
        </div>
    );
}

// Overview Card Component
function OverviewCard({ 
    icon: Icon, 
    label, 
    value, 
    color, 
    trend 
}: { 
    icon: React.ElementType; 
    label: string; 
    value: string | number; 
    color: 'indigo' | 'emerald' | 'purple' | 'amber';
    trend?: string;
}) {
    const colorClasses = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
    );
}

// Integration Tile Component
function IntegrationTile({ integration }: { integration: IntegrationHealth }) {
    const statusConfig = {
        ok: {
            icon: CheckCircle,
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
            iconColor: 'text-emerald-500',
            label: 'Operational',
        },
        degraded: {
            icon: AlertTriangle,
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            iconColor: 'text-amber-500',
            label: 'Degraded',
        },
        error: {
            icon: XCircle,
            bg: 'bg-red-50',
            text: 'text-red-700',
            iconColor: 'text-red-500',
            label: 'Error',
        },
    };

    const config = statusConfig[integration.status];
    const StatusIcon = config.icon;

    return (
        <div className={`p-4 rounded-xl border ${
            integration.status === 'ok' ? 'border-emerald-200 bg-emerald-50/50' :
            integration.status === 'degraded' ? 'border-amber-200 bg-amber-50/50' :
            'border-red-200 bg-red-50/50'
        }`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground">{integration.name}</h3>
                <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                {config.label}
            </span>
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {integration.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
                Last check: {formatDistanceToNow(new Date(integration.lastCheck), { addSuffix: true })}
            </p>
            <button className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                View Logs →
            </button>
        </div>
    );
}

// Edit Routing Modal
function EditRoutingModal({ 
    phoneNumber, 
    workflows,
    onClose, 
    onSave 
}: { 
    phoneNumber: PhoneNumberRouting;
    workflows: WorkflowSummary[];
    onClose: () => void;
    onSave: (data: { workflowId: string | null; status: 'active' | 'inactive' }) => void;
}) {
    const [selectedWorkflow, setSelectedWorkflow] = useState(phoneNumber.workflowId || '');
    const [status, setStatus] = useState(phoneNumber.status);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Edit Phone Routing</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Phone Number
                        </label>
                        <p className="font-mono text-foreground">{phoneNumber.phoneNumber}</p>
                        <p className="text-sm text-muted-foreground">{phoneNumber.hospitalName}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Assigned Workflow
                        </label>
                        <select
                            value={selectedWorkflow}
                            onChange={(e) => setSelectedWorkflow(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">No workflow assigned</option>
                            {workflows
                                .filter(w => w.hospitalId === phoneNumber.hospitalId)
                                .map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name} {w.status === 'published' ? `(v${w.activeVersion})` : '(Draft)'}
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Status
                        </label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStatus('active')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                                    status === 'active'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : 'border-border text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                Active
                            </button>
                            <button
                                onClick={() => setStatus('inactive')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                                    status === 'inactive'
                                        ? 'bg-red-50 border-red-200 text-red-700'
                                        : 'border-border text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                Inactive
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave({ 
                            workflowId: selectedWorkflow || null, 
                            status 
                        })}
                        className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

