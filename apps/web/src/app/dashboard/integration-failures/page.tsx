'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PlugZap, RefreshCcw, Save } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { Button, Card, neoFieldClass, neoSelectClass } from '@/components/dashboard/shared';
import type { BusinessIntegration, IntegrationHealthCheckResult } from '@/lib/api-types';
import { useIntegrations, useTestIntegration, useUpsertIntegration } from '@/lib/hooks/query-hooks';
import { UserRole } from '@wardline/types';

type IntegrationFormState = {
    vendor: string;
    credentialsRef: string;
    baseUrl: string;
    healthPath: string;
    timeoutMs: string;
    practiceId: string;
    departmentId: string;
    actionPath: string;
};

const CATEGORY_LABELS: Record<string, string> = {
    SCHEDULING: 'Scheduling',
    EHR_REFILL: 'EHR / Refills',
    BILLING: 'Billing',
    INSURANCE: 'Insurance',
    KNOWLEDGE: 'Knowledge',
};

const CATEGORY_HINTS: Record<string, string> = {
    SCHEDULING: 'Appointment requests, reschedules, and cancellations during the call.',
    EHR_REFILL: 'Medication refill requests and patient-record lookups that support staff follow-up.',
    BILLING: 'Live billing questions or captured follow-ups when billing needs staff review.',
    INSURANCE: 'Coverage and acceptance checks Wardline can complete during the call.',
    KNOWLEDGE: 'Internal FAQ and policy answers powered by Wardline knowledge content.',
};

const CATEGORY_ACTION_FIELDS: Partial<Record<string, { key: keyof IntegrationFormState; label: string }>> = {
    SCHEDULING: { key: 'actionPath', label: 'Appointment Request Path' },
    EHR_REFILL: { key: 'actionPath', label: 'Refill Request Path' },
    BILLING: { key: 'actionPath', label: 'Billing Request Path' },
    INSURANCE: { key: 'actionPath', label: 'Insurance Check Path' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
    return typeof value === 'string' ? value : '';
}

function buildFormState(integration: BusinessIntegration): IntegrationFormState {
    const settings = isRecord(integration.settings) ? integration.settings : {};
    const endpoints = isRecord(settings.endpoints) ? settings.endpoints : {};
    const categoryField = CATEGORY_ACTION_FIELDS[integration.category];
    const actionValue = categoryField
        ? asString(
              categoryField.key === 'actionPath'
                  ? endpoints[
                        integration.category === 'SCHEDULING'
                            ? 'appointmentRequest'
                            : integration.category === 'EHR_REFILL'
                              ? 'refillRequest'
                              : integration.category === 'BILLING'
                                ? 'billingRequest'
                                : 'insuranceCheck'
                    ]
                  : '',
          )
        : '';

    return {
        vendor: integration.vendor ?? '',
        credentialsRef: integration.credentialsRef ?? '',
        baseUrl: asString(settings.baseUrl),
        healthPath: asString(settings.healthPath || endpoints.health),
        timeoutMs: settings.timeoutMs ? String(settings.timeoutMs) : '3500',
        practiceId: asString(settings.practiceId),
        departmentId: asString(settings.departmentId),
        actionPath: actionValue,
    };
}

function capabilityBadges(capabilities: Record<string, unknown> | undefined) {
    if (!capabilities) return [];

    return Object.entries(capabilities)
        .filter(([, value]) => typeof value === 'boolean' ? value : value !== undefined && value !== null && value !== '')
        .map(([key, value]) => {
            if (key === 'lastHealthCheckLatencyMs' && typeof value === 'number') {
                return `Health check latency: ${value}ms`;
            }
            if (typeof value === 'boolean') {
                return key.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim();
            }
            return `${key.replace(/([A-Z])/g, ' $1')}: ${String(value)}`;
        });
}

function IntegrationCard({
    integration,
    onSaved,
    onTested,
    savePending,
    testPending,
}: {
    integration: BusinessIntegration;
    onSaved: (category: string, data: IntegrationFormState) => Promise<unknown>;
    onTested: (category: string, data: IntegrationFormState) => Promise<IntegrationHealthCheckResult>;
    savePending: boolean;
    testPending: boolean;
}) {
    const [draft, setDraft] = useState<IntegrationFormState>(() => buildFormState(integration));
    const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

    const categoryActionField = CATEGORY_ACTION_FIELDS[integration.category];
    const disabled = savePending || testPending;
    const capabilities = useMemo(
        () => capabilityBadges(isRecord(integration.capabilities) ? integration.capabilities : undefined),
        [integration.capabilities],
    );

    const updateField = (field: keyof IntegrationFormState, value: string) => {
        setDraft((current) => ({ ...current, [field]: value }));
    };

    const save = async () => {
        try {
            setFlash(null);
            await onSaved(integration.category, draft);
            setFlash({
                tone: 'success',
                message: 'Settings saved. Run a health check to validate the live connector.',
            });
        } catch (error) {
            setFlash({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Failed to save integration settings.',
            });
        }
    };

    const test = async () => {
        try {
            setFlash(null);
            const result = await onTested(integration.category, draft);
            setFlash({
                tone: result.ok ? 'success' : 'error',
                message: result.latencyMs ? `${result.message} (${result.latencyMs}ms)` : result.message,
            });
        } catch (error) {
            setFlash({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Integration test failed.',
            });
        }
    };

    return (
        <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        {CATEGORY_LABELS[integration.category] ?? integration.category}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {CATEGORY_HINTS[integration.category] ?? 'Configure the live runtime connector for this category.'}
                    </p>
                </div>
                <div className="space-y-1 text-right">
                    <span
                        className={[
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                            integration.status === 'CONNECTED'
                                ? 'bg-emerald-500/12 text-emerald-700'
                                : integration.status === 'ERROR'
                                  ? 'bg-red-500/12 text-red-700'
                                  : 'bg-amber-500/12 text-amber-700',
                        ].join(' ')}
                    >
                        {integration.status}
                    </span>
                    <p className="text-xs text-muted-foreground">
                        {integration.lastHealthCheckAt
                            ? `Last checked ${formatDistanceToNow(new Date(integration.lastHealthCheckAt), { addSuffix: true })}`
                            : 'Not tested yet'}
                    </p>
                </div>
            </div>

            {flash && (
                <div
                    className={[
                        'rounded-2xl px-3 py-2 text-sm',
                        flash.tone === 'success'
                            ? 'bg-emerald-500/12 text-emerald-800'
                            : 'bg-red-500/12 text-red-800',
                    ].join(' ')}
                >
                    {flash.message}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor</span>
                    <select
                        className={neoSelectClass}
                        value={draft.vendor}
                        onChange={(event) => updateField('vendor', event.target.value)}
                        disabled={disabled || integration.category === 'KNOWLEDGE'}
                    >
                        <option value={integration.category === 'KNOWLEDGE' ? 'wardline' : 'athenahealth'}>
                            {integration.category === 'KNOWLEDGE' ? 'wardline' : 'athenahealth'}
                        </option>
                    </select>
                </label>

                {integration.category !== 'KNOWLEDGE' ? (
                    <>
                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credentials Ref</span>
                            <input
                                className={neoFieldClass}
                                value={draft.credentialsRef}
                                onChange={(event) => updateField('credentialsRef', event.target.value)}
                                placeholder="e.g. MOCK_ATHENAHEALTH_TOKEN"
                                disabled={disabled}
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base URL</span>
                            <input
                                className={neoFieldClass}
                                value={draft.baseUrl}
                                onChange={(event) => updateField('baseUrl', event.target.value)}
                                placeholder="e.g. http://127.0.0.1:4010/scenario/success"
                                disabled={disabled}
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Health Path</span>
                            <input
                                className={neoFieldClass}
                                value={draft.healthPath}
                                onChange={(event) => updateField('healthPath', event.target.value)}
                                placeholder="/metadata"
                                disabled={disabled}
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeout (ms)</span>
                            <input
                                className={neoFieldClass}
                                value={draft.timeoutMs}
                                onChange={(event) => updateField('timeoutMs', event.target.value)}
                                inputMode="numeric"
                                placeholder="3500"
                                disabled={disabled}
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Practice ID</span>
                            <input
                                className={neoFieldClass}
                                value={draft.practiceId}
                                onChange={(event) => updateField('practiceId', event.target.value)}
                                placeholder="Optional practice scope"
                                disabled={disabled}
                            />
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Department ID</span>
                            <input
                                className={neoFieldClass}
                                value={draft.departmentId}
                                onChange={(event) => updateField('departmentId', event.target.value)}
                                placeholder="Optional department scope"
                                disabled={disabled}
                            />
                        </label>
                    </>
                ) : (
                    <div className="md:col-span-2 xl:col-span-4 rounded-2xl bg-[var(--background)] p-4 text-sm text-muted-foreground neo-inset">
                        Knowledge does not use an external base URL or credential ref. Those fields are omitted here so empty values are not mistaken for saved configuration.
                    </div>
                )}

                {categoryActionField ? (
                    <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {categoryActionField.label}
                        </span>
                        <input
                            className={neoFieldClass}
                            value={draft.actionPath}
                            onChange={(event) => updateField('actionPath', event.target.value)}
                            placeholder="/resource/path"
                            disabled={disabled}
                        />
                    </label>
                ) : (
                    <div className="rounded-2xl bg-[var(--background)] p-4 text-sm text-muted-foreground neo-inset">
                        Knowledge remains on the internal Wardline source in this phase. No external credential or endpoint configuration is required.
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {capabilities.length > 0 ? (
                    capabilities.map((label) => (
                        <span
                            key={label}
                            className="rounded-full bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-muted-foreground neo-inset"
                        >
                            {label}
                        </span>
                    ))
                ) : (
                    <span className="text-xs text-muted-foreground">
                        Capability metadata will populate after a successful test.
                    </span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" className="h-10 text-xs" onClick={save} disabled={disabled}>
                    <Save className="mr-1 h-3 w-3" />
                    Save settings
                </Button>
                <Button variant="ghost" className="h-10 text-xs" onClick={test} disabled={disabled}>
                    <RefreshCcw className="mr-1 h-3 w-3" />
                    Run health check
                </Button>
            </div>
        </Card>
    );
}

export default function IntegrationFailuresPage() {
    const integrationsQuery = useIntegrations();
    const upsertIntegration = useUpsertIntegration();
    const testIntegration = useTestIntegration();

    const integrations = useMemo(
        () => [...(integrationsQuery.data ?? [])].sort((left, right) => left.category.localeCompare(right.category)),
        [integrationsQuery.data],
    );

    const persistDraft = async (category: string, draft: IntegrationFormState) => {
        const settings =
            category === 'KNOWLEDGE'
                ? { source: 'wardline', category, enabled: true }
                : {
                      baseUrl: draft.baseUrl || undefined,
                      healthPath: draft.healthPath || undefined,
                      timeoutMs: draft.timeoutMs ? Number(draft.timeoutMs) : undefined,
                      practiceId: draft.practiceId || undefined,
                      departmentId: draft.departmentId || undefined,
                      endpoints: {
                          health: draft.healthPath || undefined,
                          appointmentRequest: category === 'SCHEDULING' ? draft.actionPath || undefined : undefined,
                          refillRequest: category === 'EHR_REFILL' ? draft.actionPath || undefined : undefined,
                          billingRequest: category === 'BILLING' ? draft.actionPath || undefined : undefined,
                          insuranceCheck: category === 'INSURANCE' ? draft.actionPath || undefined : undefined,
                      },
                  };

        return upsertIntegration.mutateAsync({
            category,
            data: {
                vendor: draft.vendor || (category === 'KNOWLEDGE' ? 'wardline' : 'athenahealth'),
                status: category === 'KNOWLEDGE' ? 'CONNECTED' : 'DISCONNECTED',
                credentialsRef: draft.credentialsRef || undefined,
                settings,
            },
        });
    };

    const persistAndTest = async (category: string, draft: IntegrationFormState) => {
        await persistDraft(category, draft);
        return testIntegration.mutateAsync(category);
    };

    return (
        <RoleGuard allowedRoles={[UserRole.OWNER, UserRole.ADMIN, UserRole.SUPERVISOR]}>
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] text-primary neo-inset">
                        <PlugZap className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Integrations</h2>
                        <p className="text-sm text-muted-foreground">
                            Configure the single live connector per category, test its health, and inspect which runtime capabilities are available to the live call runtime.
                        </p>
                    </div>
                </div>

                {integrationsQuery.isLoading ? (
                    <Card>
                        <div className="py-16 text-center text-sm text-muted-foreground">Loading integrations...</div>
                    </Card>
                ) : integrationsQuery.isError ? (
                    <Card>
                        <div className="py-16 text-center text-sm text-destructive">
                            Failed to load integration settings.
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {integrations.map((integration) => (
                            <IntegrationCard
                                key={`${integration.category}:${integration.updatedAt}:${integration.status}`}
                                integration={integration}
                                onSaved={persistDraft}
                                onTested={persistAndTest}
                                savePending={upsertIntegration.isPending}
                                testPending={testIntegration.isPending}
                            />
                        ))}
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
