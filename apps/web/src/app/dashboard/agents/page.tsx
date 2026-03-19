'use client';

import React, { useState } from 'react';
import { Card, Badge, Button } from '@/components/dashboard/shared';
import {
    Calendar, CreditCard, Shield, HelpCircle, Pill,
    Plus, Settings, ChevronRight, CheckCircle, AlertCircle,
    Zap, X, Eye, EyeOff, Info,
} from 'lucide-react';

// ─── Catalog data (mirrors seed-agents.ts for display) ───────────────────────

const CATALOG = [
    {
        catalogId: 'scheduling',
        name: 'Appointment Scheduling',
        description: 'Books, reschedules, and cancels appointments. Checks availability and confirms with a reference number.',
        scopeBoundary: 'Does not ask about or respond to symptoms, clinical questions, or reasons beyond service type.',
        icon: Calendar,
        color: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
        tags: ['Appointments', 'Calendar', 'Scheduling'],
        toolConfigSchema: [
            { key: 'provider', label: 'Scheduling Provider', type: 'select', required: true, options: ['TimeTap', 'NexHealth', 'Google Calendar', 'Manual'] },
            { key: 'apiKey', label: 'API Key', type: 'password', required: true },
            { key: 'locationId', label: 'Location ID', type: 'text', required: false },
            { key: 'reminderEnabled', label: 'Send Reminders', type: 'boolean', required: false },
        ],
    },
    {
        catalogId: 'billing',
        name: 'Billing & Payments',
        description: 'Answers balance questions and takes payments. Looks up account balances and processes card payments via secure IVR.',
        scopeBoundary: 'Does not negotiate payment plans, handle disputes, or process refunds — those go to a human.',
        icon: CreditCard,
        color: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
        tags: ['Billing', 'Payments', 'Balance'],
        toolConfigSchema: [
            { key: 'practiceManagementSystem', label: 'Practice Management System', type: 'select', required: true, options: ['Dentrix', 'Eaglesoft', 'Open Dental', 'Kareo', 'AdvancedMD', 'Other'] },
            { key: 'apiEndpoint', label: 'API Endpoint', type: 'url', required: true },
            { key: 'apiKey', label: 'API Key', type: 'password', required: true },
            { key: 'paymentEnabled', label: 'Enable Phone Payments', type: 'boolean', required: false },
        ],
    },
    {
        catalogId: 'insurance',
        name: 'Insurance Verification',
        description: 'Tells callers whether the clinic accepts their insurance and provides basic coverage information.',
        scopeBoundary: 'Does not handle claim denials, appeals, or billing disputes. Cannot interpret specific procedure coverage.',
        icon: Shield,
        color: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
        tags: ['Insurance', 'Coverage', 'Eligibility'],
        toolConfigSchema: [
            { key: 'verificationApi', label: 'Eligibility Service', type: 'select', required: false, options: ['Availity', 'Change Healthcare', 'Waystar', 'None (manual lookup)'] },
            { key: 'apiKey', label: 'API Key', type: 'password', required: false },
            { key: 'npi', label: 'Practice NPI Number', type: 'text', required: false },
        ],
    },
    {
        catalogId: 'faq',
        name: 'General FAQ & Info',
        description: 'Answers anything a caller might ask — hours, location, services, providers, new patient process, prep instructions.',
        scopeBoundary: 'Does not answer symptom questions, clinical advice, or anything requiring medical interpretation.',
        icon: HelpCircle,
        color: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
        tags: ['FAQ', 'Information', 'Hours', 'Location'],
        toolConfigSchema: [
            { key: 'knowledgeBaseProvider', label: 'Knowledge Base', type: 'select', required: true, options: ['Wardline Built-in', 'Notion', 'Google Docs', 'Custom URL'] },
            { key: 'knowledgeBaseUrl', label: 'Knowledge Base URL / ID', type: 'url', required: false },
            { key: 'apiKey', label: 'API Key', type: 'password', required: false },
        ],
    },
    {
        catalogId: 'prescription-refill',
        name: 'Prescription Refill Request',
        description: 'Logs refill requests and routes them to the prescribing provider. Can also check status of an existing refill.',
        scopeBoundary: 'Does not approve, deny, or advise on prescriptions. New prescriptions always go to a human.',
        icon: Pill,
        color: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
        tags: ['Prescription', 'Refill', 'Medication'],
        toolConfigSchema: [
            { key: 'ehrSystem', label: 'EHR / Practice System', type: 'select', required: true, options: ['Epic', 'Cerner', 'Athenahealth', 'Dentrix', 'Eaglesoft', 'Custom Webhook', 'Email Only'] },
            { key: 'apiEndpoint', label: 'API / Webhook Endpoint', type: 'url', required: false },
            { key: 'apiKey', label: 'API Key / Token', type: 'password', required: false },
            { key: 'notifyEmail', label: 'Notification Email', type: 'text', required: false },
        ],
    },
];

// ─── Simulated deployed agents state ─────────────────────────────────────────

type DeployedAgent = {
    id: string;
    catalogId: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
    toolConfig: Record<string, string>;
    callStats: { totalCalls: number; resolutionRate: number; escalatedCalls: number };
};

const INITIAL_DEPLOYED: DeployedAgent[] = [
    {
        id: 'dep-scheduling',
        catalogId: 'scheduling',
        name: 'Appointment Scheduling',
        status: 'ACTIVE',
        toolConfig: { provider: 'NexHealth', apiKey: '••••••••' },
        callStats: { totalCalls: 142, resolutionRate: 87, escalatedCalls: 18 },
    },
    {
        id: 'dep-faq',
        catalogId: 'faq',
        name: 'General FAQ & Info',
        status: 'ACTIVE',
        toolConfig: { knowledgeBaseProvider: 'Wardline Built-in' },
        callStats: { totalCalls: 98, resolutionRate: 94, escalatedCalls: 6 },
    },
];

// ─── Tool Config Panel ────────────────────────────────────────────────────────

function ToolConfigPanel({
    agent,
    catalogItem,
    onClose,
    onSave,
}: {
    agent: DeployedAgent;
    catalogItem: typeof CATALOG[0];
    onClose: () => void;
    onSave: (config: Record<string, string>) => void;
}) {
    const [config, setConfig] = useState<Record<string, string>>({ ...agent.toolConfig });
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    const Icon = catalogItem.icon;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${catalogItem.color.bg} border ${catalogItem.color.border}`}>
                            <Icon className={`h-5 w-5 ${catalogItem.color.text}`} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">{agent.name}</h2>
                            <p className="text-xs text-muted-foreground">Tool Configuration</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Scope boundary notice */}
                <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-2">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{catalogItem.scopeBoundary}</p>
                </div>

                {/* Fields */}
                <div className="p-6 space-y-4">
                    {catalogItem.toolConfigSchema.map(field => (
                        <div key={field.key}>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {field.type === 'select' ? (
                                <select
                                    value={config[field.key] ?? ''}
                                    onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                    <option value="">Select...</option>
                                    {field.options?.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : field.type === 'boolean' ? (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config[field.key] === 'true'}
                                        onChange={e => setConfig({ ...config, [field.key]: String(e.target.checked) })}
                                        className="rounded"
                                    />
                                    <span className="text-sm text-muted-foreground">Enabled</span>
                                </label>
                            ) : (
                                <div className="relative">
                                    <input
                                        type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                                        value={config[field.key] ?? ''}
                                        onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                                        placeholder={field.type === 'url' ? 'https://...' : field.type === 'password' ? '••••••••' : ''}
                                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                                    />
                                    {field.type === 'password' && (
                                        <button
                                            type="button"
                                            onClick={() => setShowSecrets(s => ({ ...s, [field.key]: !s[field.key] }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                        >
                                            {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3 justify-end">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => { onSave(config); onClose(); }}>
                        <Zap className="h-4 w-4 mr-2" />
                        Save Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
    const [activeTab, setActiveTab] = useState<'active' | 'catalog'>('active');
    const [deployedAgents, setDeployedAgents] = useState<DeployedAgent[]>(INITIAL_DEPLOYED);
    const [configAgent, setConfigAgent] = useState<DeployedAgent | null>(null);

    const deployedIds = new Set(deployedAgents.map(a => a.catalogId));

    const handleDeploy = (catalogId: string) => {
        const cat = CATALOG.find(c => c.catalogId === catalogId)!;
        const newAgent: DeployedAgent = {
            id: `dep-${catalogId}-${Date.now()}`,
            catalogId,
            name: cat.name,
            status: 'INACTIVE',
            toolConfig: {},
            callStats: { totalCalls: 0, resolutionRate: 0, escalatedCalls: 0 },
        };
        setDeployedAgents(prev => [...prev, newAgent]);
        setActiveTab('active');
    };

    const handleToggleStatus = (id: string) => {
        setDeployedAgents(prev =>
            prev.map(a => a.id === id
                ? { ...a, status: a.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }
                : a
            )
        );
    };

    const handleSaveConfig = (id: string, config: Record<string, string>) => {
        setDeployedAgents(prev =>
            prev.map(a => a.id === id ? { ...a, toolConfig: config } : a)
        );
    };

    const handleUndeploy = (id: string) => {
        setDeployedAgents(prev => prev.filter(a => a.id !== id));
    };

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                    Deploy and configure AI agents that handle your inbound calls.
                </p>
                <div className="flex bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'active' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                        Active Agents
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            {deployedAgents.filter(a => a.status === 'ACTIVE').length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('catalog')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'catalog' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                        Agent Catalog
                    </button>
                </div>
            </div>

            {/* Active Agents Tab */}
            {activeTab === 'active' && (
                <div className="space-y-4">
                    {deployedAgents.length === 0 ? (
                        <Card>
                            <div className="text-center py-16">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Plus className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">No agents deployed</h3>
                                <p className="text-muted-foreground mb-4">
                                    Deploy agents from the catalog to start handling inbound calls.
                                </p>
                                <Button onClick={() => setActiveTab('catalog')}>
                                    Browse Agent Catalog
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        deployedAgents.map(agent => {
                            const cat = CATALOG.find(c => c.catalogId === agent.catalogId)!;
                            if (!cat) return null;
                            const Icon = cat.icon;
                            const isActive = agent.status === 'ACTIVE';
                            const toolConnected = Object.keys(agent.toolConfig).length > 0;

                            return (
                                <Card key={agent.id} className="hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className={`p-3 rounded-xl ${cat.color.bg} border ${cat.color.border} shrink-0`}>
                                            <Icon className={`h-6 w-6 ${cat.color.text}`} />
                                        </div>

                                        {/* Main content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-foreground">{agent.name}</h3>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                            {agent.status}
                                                        </span>
                                                        {!toolConnected && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                                                                <AlertCircle className="h-3 w-3" />
                                                                Tool not configured
                                                            </span>
                                                        )}
                                                        {toolConnected && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-700">
                                                                <CheckCircle className="h-3 w-3" />
                                                                Tool connected
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                                                </div>

                                                {/* Toggle */}
                                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isActive}
                                                        onChange={() => handleToggleStatus(agent.id)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                                                </label>
                                            </div>

                                            {/* Stats */}
                                            {agent.callStats.totalCalls > 0 && (
                                                <div className="flex gap-4 my-3 p-3 bg-muted/50 rounded-lg">
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-foreground">{agent.callStats.totalCalls}</div>
                                                        <div className="text-xs text-muted-foreground">Total Calls</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-emerald-600">{agent.callStats.resolutionRate}%</div>
                                                        <div className="text-xs text-muted-foreground">Resolution Rate</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-orange-600">{agent.callStats.escalatedCalls}</div>
                                                        <div className="text-xs text-muted-foreground">Escalated</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 text-xs"
                                                    onClick={() => setConfigAgent(agent)}
                                                >
                                                    <Settings className="h-3 w-3 mr-1" />
                                                    Configure Tool
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 text-xs text-red-600 hover:text-red-700"
                                                    onClick={() => handleUndeploy(agent.id)}
                                                >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    )}

                    {deployedAgents.length > 0 && (
                        <button
                            onClick={() => setActiveTab('catalog')}
                            className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Deploy another agent from catalog
                        </button>
                    )}
                </div>
            )}

            {/* Catalog Tab */}
            {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {CATALOG.map(cat => {
                        const Icon = cat.icon;
                        const isDeployed = deployedIds.has(cat.catalogId);

                        return (
                            <Card key={cat.catalogId} className="flex flex-col">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className={`p-3 rounded-xl ${cat.color.bg} border ${cat.color.border} shrink-0`}>
                                        <Icon className={`h-6 w-6 ${cat.color.text}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-foreground text-sm">{cat.name}</h3>
                                            {isDeployed && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                                                    <CheckCircle className="h-3 w-3" />
                                                    Deployed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{cat.description}</p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {cat.tags.map(tag => (
                                        <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color.badge}`}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Scope boundary */}
                                <div className="flex gap-2 p-2.5 bg-muted/60 rounded-lg mb-4 text-xs text-muted-foreground">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    <span>{cat.scopeBoundary}</span>
                                </div>

                                <div className="mt-auto">
                                    {isDeployed ? (
                                        <Button
                                            variant="ghost"
                                            className="w-full h-9 text-sm"
                                            onClick={() => setActiveTab('active')}
                                        >
                                            <Settings className="h-4 w-4 mr-2" />
                                            Manage
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full h-9 text-sm"
                                            onClick={() => handleDeploy(cat.catalogId)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Deploy Agent
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Tool Config Modal */}
            {configAgent && (
                <ToolConfigPanel
                    agent={configAgent}
                    catalogItem={CATALOG.find(c => c.catalogId === configAgent.catalogId)!}
                    onClose={() => setConfigAgent(null)}
                    onSave={(config) => handleSaveConfig(configAgent.id, config)}
                />
            )}
        </div>
    );
}
