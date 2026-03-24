'use client';

import React, { useMemo, useState } from 'react';
import {
    Calendar,
    CheckCircle,
    CreditCard,
    Eye,
    EyeOff,
    HelpCircle,
    Info,
    Pill,
    Plus,
    Settings,
    Shield,
    X,
} from 'lucide-react';
import { Button, Card, Toggle, neoFieldClass, neoSelectClass } from '@/components/dashboard/shared';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/lib/business-context';
import {
    useAgentCatalog,
    useAgents,
    useDeployAgent,
    useUndeployAgent,
    useUpdateAgentStatus,
    useUpdateAgentToolConfig,
} from '@/lib/hooks/query-hooks';
import type { AgentCatalogItem, AgentListItem } from '@/lib/api-types';

const CATALOG_VISUALS: Record<string, { icon: React.ElementType; text: string; badge: string }> = {
    scheduling: {
        icon: Calendar,
        text: 'text-emerald-700',
        badge: 'bg-emerald-500/12 text-emerald-900',
    },
    billing: {
        icon: CreditCard,
        text: 'text-sky-700',
        badge: 'bg-sky-500/12 text-sky-900',
    },
    insurance: {
        icon: Shield,
        text: 'text-violet-700',
        badge: 'bg-violet-500/12 text-violet-900',
    },
    faq: {
        icon: HelpCircle,
        text: 'text-amber-800',
        badge: 'bg-amber-500/12 text-amber-950',
    },
    'prescription-refill': {
        icon: Pill,
        text: 'text-rose-800',
        badge: 'bg-rose-500/12 text-rose-950',
    },
};

function ToolConfigPanel({
    agent,
    catalogItem,
    onClose,
    onSave,
}: {
    agent: AgentListItem;
    catalogItem: AgentCatalogItem;
    onClose: () => void;
    onSave: (config: Record<string, unknown>) => void;
}) {
    const [config, setConfig] = useState<Record<string, string>>(
        Object.entries(agent.toolConfig || {}).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = String(value ?? '');
            return acc;
        }, {}),
    );
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const visual = CATALOG_VISUALS[catalogItem.catalogId] || CATALOG_VISUALS.faq;
    const Icon = visual.icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl bg-[var(--background)] neo-raised">
                <div className="flex items-center justify-between border-b border-border/40 p-6">
                    <div className="flex items-center gap-3">
                        <div className={cn('flex items-center justify-center rounded-2xl bg-[var(--background)] p-2.5 neo-inset', visual.text)}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">{agent.name}</h2>
                            <p className="text-xs text-muted-foreground">Vendor configuration</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-foreground neo-inset"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {catalogItem.scopeBoundary && (
                    <div className="mx-6 mt-4 flex gap-2 rounded-2xl bg-amber-500/10 p-3 neo-inset">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <p className="text-xs text-amber-950">{catalogItem.scopeBoundary}</p>
                    </div>
                )}

                <div className="space-y-4 p-6">
                    {(catalogItem.toolConfigSchema || []).map((field) => (
                        <div key={field.key}>
                            <label className="mb-1 block text-sm font-medium text-foreground">
                                {field.label}
                                {field.required && <span className="ml-1 text-red-500">*</span>}
                            </label>
                            {field.type === 'select' ? (
                                <select
                                    value={config[field.key] ?? ''}
                                    onChange={(event) => setConfig({ ...config, [field.key]: event.target.value })}
                                    className={neoSelectClass}
                                >
                                    <option value="">Select...</option>
                                    {field.options?.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            ) : field.type === 'boolean' ? (
                                <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config[field.key] === 'true'}
                                        onChange={(event) =>
                                            setConfig({ ...config, [field.key]: String(event.target.checked) })
                                        }
                                        className="rounded"
                                    />
                                    <span className="text-sm text-muted-foreground">Enabled</span>
                                </label>
                            ) : (
                                <div className="relative">
                                    <input
                                        type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                                        value={config[field.key] ?? ''}
                                        onChange={(event) => setConfig({ ...config, [field.key]: event.target.value })}
                                        placeholder={field.type === 'url' ? 'https://...' : ''}
                                        className={`${neoFieldClass} pr-10`}
                                    />
                                    {field.type === 'password' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowSecrets((current) => ({ ...current, [field.key]: !current[field.key] }))
                                            }
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

                <div className="flex justify-end gap-3 p-6 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="filled" onClick={() => { onSave(config); onClose(); }}>
                        <Settings className="mr-2 h-4 w-4" />
                        Save configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function AgentsPage() {
    const { businessId, isLoading: businessLoading } = useBusiness();
    const agentsQuery = useAgents();
    const catalogQuery = useAgentCatalog();
    const deployAgent = useDeployAgent();
    const updateAgentStatus = useUpdateAgentStatus();
    const updateAgentToolConfig = useUpdateAgentToolConfig();
    const undeployAgent = useUndeployAgent();
    const [configAgent, setConfigAgent] = useState<AgentListItem | null>(null);

    const deployedAgents = agentsQuery.data ?? [];
    const catalog = catalogQuery.data ?? [];

    const deployedOrdered = useMemo(() => {
        const copy = [...deployedAgents];
        copy.sort((left, right) => {
            if (left.status === 'ACTIVE' && right.status !== 'ACTIVE') return -1;
            if (left.status !== 'ACTIVE' && right.status === 'ACTIVE') return 1;
            return left.name.localeCompare(right.name);
        });
        return copy;
    }, [deployedAgents]);

    const availableCatalog = useMemo(() => {
        const deployedIds = new Set(deployedAgents.map((agent) => agent.catalogId));
        return catalog.filter((item) => !deployedIds.has(item.catalogId));
    }, [catalog, deployedAgents]);

    const summary = useMemo(() => {
        const active = deployedAgents.filter((agent) => agent.status === 'ACTIVE').length;
        const configured = deployedAgents.filter((agent) => Object.keys(agent.toolConfig || {}).length > 0).length;
        const paused = deployedAgents.filter((agent) => agent.status === 'PAUSED').length;
        return { total: deployedAgents.length, active, configured, paused };
    }, [deployedAgents]);

    if (!businessLoading && !businessId) {
        return (
            <Card>
                <div className="py-16 text-center">
                    <h2 className="text-xl font-semibold text-foreground">Choose a practice before deploying agents</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Agents are deployed per business so the correct workflow and integrations are used on each line.
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            <div className="rounded-3xl bg-[var(--background)] p-6 sm:p-8 neo-raised">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
                    Agents
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Deploy business-specific receptionist agents, connect their vendor tools, and control which ones are live on the phone line.
                </p>
            </div>

            <section className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Deployed agents</h3>
                {agentsQuery.isLoading || catalogQuery.isLoading ? (
                    <Card>
                        <div className="py-12 text-center text-sm text-muted-foreground">Loading agents...</div>
                    </Card>
                ) : agentsQuery.isError || catalogQuery.isError ? (
                    <Card>
                        <div className="py-12 text-center text-sm text-destructive">Failed to load agents.</div>
                    </Card>
                ) : deployedOrdered.length === 0 ? (
                    <Card>
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            No agents deployed yet. Add one from <span className="font-medium text-foreground">Available agents</span> below.
                        </div>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {deployedOrdered.map((agent) => {
                            const catalogItem = catalog.find((item) => item.catalogId === agent.catalogId);
                            const visual = CATALOG_VISUALS[agent.catalogId] || CATALOG_VISUALS.faq;
                            const Icon = visual.icon;
                            const isLive = agent.status === 'ACTIVE';
                            const configured = Object.keys(agent.toolConfig || {}).length > 0;

                            return (
                                <Card key={agent.id} className="flex flex-col overflow-hidden !p-0">
                                    <div className="p-6 pb-4">
                                        <div className="mb-4 flex items-start gap-4">
                                            <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[var(--background)] neo-inset', visual.text)}>
                                                <Icon className="h-7 w-7" />
                                            </div>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="text-lg font-semibold leading-snug text-foreground">
                                                                {agent.name}
                                                            </h4>
                                                            {isLive ? (
                                                                <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Active" />
                                                            ) : (
                                                                <span className="text-xs font-medium text-muted-foreground">{agent.status}</span>
                                                            )}
                                                        </div>
                                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                                            {catalogItem?.description || agent.description || 'Configured agent for this business.'}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 pt-0.5">
                                                        <Toggle
                                                            checked={isLive}
                                                            onChange={() =>
                                                                updateAgentStatus.mutate({
                                                                    agentId: agent.id,
                                                                    status: isLive ? 'PAUSED' : 'ACTIVE',
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-4 flex flex-wrap gap-1.5">
                                            {(catalogItem?.tags || []).map((tag) => (
                                                <span key={tag} className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', visual.badge)}>
                                                    {tag}
                                                </span>
                                            ))}
                                            <span className={cn(
                                                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                                configured
                                                    ? 'bg-emerald-500/12 text-emerald-900'
                                                    : 'bg-amber-500/12 text-amber-900',
                                            )}>
                                                {configured ? 'Configured' : 'Needs setup'}
                                            </span>
                                        </div>

                                        {catalogItem?.scopeBoundary && (
                                            <div className="flex gap-2 rounded-2xl bg-[var(--background)] p-3 text-xs leading-relaxed text-muted-foreground neo-inset">
                                                <span>{catalogItem.scopeBoundary}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 border-t border-border/30 bg-[var(--background)]/80 p-4">
                                        <Button
                                            variant="ghost"
                                            className="h-10 flex-1 text-sm"
                                            onClick={() => setConfigAgent(agent)}
                                        >
                                            <Settings className="mr-2 h-4 w-4" />
                                            Configure
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="h-10 flex-1 text-sm text-muted-foreground hover:text-destructive"
                                            onClick={() => undeployAgent.mutate(agent.id)}
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Remove
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="space-y-3" id="available-agents">
                <h3 className="text-lg font-semibold text-foreground">Available agents</h3>
                {availableCatalog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All catalog agents are already deployed.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {availableCatalog.map((catalogItem) => {
                            const visual = CATALOG_VISUALS[catalogItem.catalogId] || CATALOG_VISUALS.faq;
                            const Icon = visual.icon;
                            return (
                                <Card key={catalogItem.catalogId} className="flex flex-col overflow-hidden !p-0">
                                    <div className="p-6 pb-4">
                                        <div className="mb-4 flex items-start gap-4">
                                            <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[var(--background)] neo-inset', visual.text)}>
                                                <Icon className="h-7 w-7" />
                                            </div>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <h4 className="text-lg font-semibold leading-snug text-foreground">{catalogItem.name}</h4>
                                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                                    {catalogItem.description}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mb-4 flex flex-wrap gap-1.5">
                                            {(catalogItem.tags || []).map((tag) => (
                                                <span key={tag} className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', visual.badge)}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        {catalogItem.scopeBoundary && (
                                            <div className="rounded-2xl bg-[var(--background)] p-3 text-xs leading-relaxed text-muted-foreground neo-inset">
                                                {catalogItem.scopeBoundary}
                                            </div>
                                        )}
                                    </div>
                                    <div className="border-t border-border/30 bg-[var(--background)]/80 p-4">
                                        <Button
                                            variant="filled"
                                            className="h-10 w-full rounded-2xl text-sm"
                                            onClick={() => deployAgent.mutate(catalogItem.catalogId)}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Deploy agent
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            {configAgent && (
                <ToolConfigPanel
                    agent={configAgent}
                    catalogItem={catalog.find((item) => item.catalogId === configAgent.catalogId)!}
                    onClose={() => setConfigAgent(null)}
                    onSave={(config) => updateAgentToolConfig.mutate({ agentId: configAgent.id, toolConfig: config })}
                />
            )}

            <div className="flex flex-wrap items-center justify-center gap-6 rounded-3xl px-4 py-5 text-center sm:gap-10 neo-inset">
                <div>
                    <div className="text-2xl font-semibold text-foreground">{summary.total}</div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Deployed agents
                    </div>
                </div>
                <div className="hidden h-10 w-px bg-border sm:block" />
                <div>
                    <div className="text-2xl font-semibold text-emerald-600">{summary.active}</div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Active now
                    </div>
                </div>
                <div className="hidden h-10 w-px bg-border sm:block" />
                <div>
                    <div className="text-2xl font-semibold text-primary">{summary.configured}</div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Configured tools
                    </div>
                </div>
                <div className="hidden h-10 w-px bg-border sm:block" />
                <div>
                    <div className="text-2xl font-semibold text-orange-600">{summary.paused}</div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Paused agents
                    </div>
                </div>
            </div>
        </div>
    );
}
