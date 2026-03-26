"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Building2, CheckCircle, ClipboardList, Clock3, Plus, PlugZap, Shield } from 'lucide-react';
import { Button, Card, Toggle, neoFieldClass, neoSelectClass } from "@/components/dashboard/shared";
import { useApiClient } from '@/lib/api-client';
import { useBusiness } from '@/lib/business-context';
import { useBusinesses, useBusinessSettings, useIntegrations, useUpdateBusiness, useUpdateBusinessSettings } from '@/lib/hooks/query-hooks';
import type { BusinessSettings, OperatingHoursSlot, PracticeAction } from '@/lib/api-types';
import {
    buildPracticeReadiness,
    DEFAULT_AFTER_HOURS_POLICY,
    DEFAULT_BILLING_POLICY,
    DEFAULT_ENABLED_ACTIONS,
    DEFAULT_ESCALATION_CONFIG,
    DEFAULT_INSURANCE_POLICY,
    DEFAULT_KNOWLEDGE_CONFIG,
    DEFAULT_REFILL_POLICY,
    normalizePracticeSetup,
} from '@/lib/practice-setup';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_OPERATING_HOURS: OperatingHoursSlot[] = [
    { dayOfWeek: 0, isClosed: true, startTime: null, endTime: null },
    { dayOfWeek: 1, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 2, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 3, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 4, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 5, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 6, isClosed: true, startTime: null, endTime: null },
];

function normalizeOperatingHours(value?: OperatingHoursSlot[]): OperatingHoursSlot[] {
    const byDay = new Map((value ?? []).map((entry) => [entry.dayOfWeek, entry]));
    return DEFAULT_OPERATING_HOURS.map((fallback) => {
        const current = byDay.get(fallback.dayOfWeek);
        if (!current) return fallback;
        return {
            dayOfWeek: fallback.dayOfWeek,
            isClosed: current.isClosed,
            startTime: current.isClosed ? null : current.startTime ?? fallback.startTime,
            endTime: current.isClosed ? null : current.endTime ?? fallback.endTime,
        };
    });
}

function textList(value: string[] | undefined) {
    return (value ?? []).join(', ');
}

function parseTextList(value: string) {
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function actionLabel(action: PracticeAction) {
    return {
        'appointment-request': 'Appointments',
        'refill-request': 'Prescription Refills',
        'insurance-check': 'Insurance Checks',
        'billing-request': 'Billing Support',
    }[action];
}

function SetupField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">{label}</label>
            {children}
        </div>
    );
}

function SetupTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} className={`${neoFieldClass} min-h-[110px] ${props.className ?? ''}`} />;
}

export default function PracticeSetupPage() {
    const api = useApiClient();
    const { businessId, setBusinessId, isLoading: businessContextLoading } = useBusiness();
    const businessesQuery = useBusinesses();
    const businessQuery = useBusinessSettings();
    const integrationsQuery = useIntegrations();
    const updateBusiness = useUpdateBusiness();
    const updateBusinessSettings = useUpdateBusinessSettings();

    const [newBusinessName, setNewBusinessName] = useState('');
    const [newBusinessSlug, setNewBusinessSlug] = useState('');
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    const [practiceName, setPracticeName] = useState('');
    const [practiceSlug, setPracticeSlug] = useState('');
    const [timeZone, setTimeZone] = useState('America/New_York');
    const [recordingDefault, setRecordingDefault] = useState<'ON' | 'OFF' | 'ASK'>('ON');
    const [transcriptRetentionDays, setTranscriptRetentionDays] = useState(30);
    const [operatingHours, setOperatingHours] = useState<OperatingHoursSlot[]>(DEFAULT_OPERATING_HOURS);
    const [enabledActions, setEnabledActions] = useState<PracticeAction[]>(DEFAULT_ENABLED_ACTIONS);
    const [afterHoursMode, setAfterHoursMode] = useState(DEFAULT_AFTER_HOURS_POLICY.mode);
    const [afterHoursGreeting, setAfterHoursGreeting] = useState(DEFAULT_AFTER_HOURS_POLICY.greeting);
    const [refillPolicyNotes, setRefillPolicyNotes] = useState(DEFAULT_REFILL_POLICY.intakeNotes);
    const [billingPolicyNotes, setBillingPolicyNotes] = useState(DEFAULT_BILLING_POLICY.intakeNotes);
    const [insurancePolicyNotes, setInsurancePolicyNotes] = useState(DEFAULT_INSURANCE_POLICY.intakeNotes);
    const [faqSummary, setFaqSummary] = useState(DEFAULT_KNOWLEDGE_CONFIG.faqSummary);
    const [commonQuestions, setCommonQuestions] = useState(DEFAULT_KNOWLEDGE_CONFIG.commonQuestions.join('\n'));
    const [escalationMessage, setEscalationMessage] = useState(DEFAULT_ESCALATION_CONFIG.escalationMessage);
    const [urgentCallbackWindowMinutes, setUrgentCallbackWindowMinutes] = useState(DEFAULT_ESCALATION_CONFIG.urgentCallbackWindowMinutes);
    const [emergencyKeywords, setEmergencyKeywords] = useState('');
    const [outOfScopeKeywords, setOutOfScopeKeywords] = useState('');

    useEffect(() => {
        setNewBusinessSlug(newBusinessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }, [newBusinessName]);

    useEffect(() => {
        const business = businessQuery.data;
        if (!business) return;
        const practiceSetup = normalizePracticeSetup(business.settings);

        setPracticeName(business.name);
        setPracticeSlug(business.slug);
        setTimeZone(business.timeZone || 'America/New_York');
        setRecordingDefault((business.settings?.recordingDefault as 'ON' | 'OFF' | 'ASK') || 'ON');
        setTranscriptRetentionDays(business.settings?.transcriptRetentionDays ?? 30);
        setOperatingHours(normalizeOperatingHours(business.settings?.operatingHours));
        setEnabledActions(practiceSetup.enabledActions);
        setAfterHoursMode(practiceSetup.afterHoursPolicy.mode);
        setAfterHoursGreeting(practiceSetup.afterHoursPolicy.greeting);
        setRefillPolicyNotes(practiceSetup.refillPolicy.intakeNotes);
        setBillingPolicyNotes(practiceSetup.billingPolicy.intakeNotes);
        setInsurancePolicyNotes(practiceSetup.insurancePolicy.intakeNotes);
        setFaqSummary(practiceSetup.knowledgeConfig.faqSummary);
        setCommonQuestions(practiceSetup.knowledgeConfig.commonQuestions.join('\n'));
        setEscalationMessage(practiceSetup.escalationConfig.escalationMessage);
        setUrgentCallbackWindowMinutes(practiceSetup.escalationConfig.urgentCallbackWindowMinutes);
        setEmergencyKeywords(textList(business.settings?.emergencyKeywords));
        setOutOfScopeKeywords(textList(business.settings?.outOfScopeKeywords));
        setHasChanges(false);
        setSaveMessage(null);
    }, [businessQuery.data]);

    const integrations = integrationsQuery.data ?? [];
    const readiness = useMemo(() => buildPracticeReadiness({
        businessId,
        integrations,
        settings: {
            recordingDefault,
            transcriptRetentionDays,
            operatingHours,
            enabledActions,
            afterHoursPolicy: {
                mode: afterHoursMode,
                greeting: afterHoursGreeting,
                sendUrgentToVoicemail: true,
            },
            refillPolicy: { liveEnabled: enabledActions.includes('refill-request'), intakeNotes: refillPolicyNotes, fallbackSummary: DEFAULT_REFILL_POLICY.fallbackSummary },
            billingPolicy: { liveEnabled: enabledActions.includes('billing-request'), intakeNotes: billingPolicyNotes, fallbackSummary: DEFAULT_BILLING_POLICY.fallbackSummary },
            insurancePolicy: { liveEnabled: enabledActions.includes('insurance-check'), intakeNotes: insurancePolicyNotes, fallbackSummary: DEFAULT_INSURANCE_POLICY.fallbackSummary },
            knowledgeConfig: { faqSummary, commonQuestions: parseTextList(commonQuestions) },
            escalationConfig: { escalationMessage, urgentCallbackWindowMinutes, notifyStaffImmediately: true },
            emergencyKeywords: parseTextList(emergencyKeywords),
            outOfScopeKeywords: parseTextList(outOfScopeKeywords),
        },
    }), [
        afterHoursGreeting,
        afterHoursMode,
        billingPolicyNotes,
        businessId,
        commonQuestions,
        emergencyKeywords,
        enabledActions,
        escalationMessage,
        faqSummary,
        integrations,
        insurancePolicyNotes,
        operatingHours,
        outOfScopeKeywords,
        recordingDefault,
        refillPolicyNotes,
        transcriptRetentionDays,
        urgentCallbackWindowMinutes,
    ]);

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
            await businessesQuery.refetch();
        } catch (error: any) {
            setCreateError(error?.message || 'Failed to create practice');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSave = async () => {
        if (!businessId) return;
        setSaveMessage(null);
        try {
            await updateBusiness.mutateAsync({ name: practiceName, slug: practiceSlug, timeZone } as Partial<BusinessSettings>);
            await updateBusinessSettings.mutateAsync({
                recordingDefault,
                transcriptRetentionDays,
                operatingHours,
                enabledActions,
                afterHoursPolicy: { mode: afterHoursMode, greeting: afterHoursGreeting, sendUrgentToVoicemail: true },
                refillPolicy: { liveEnabled: enabledActions.includes('refill-request'), intakeNotes: refillPolicyNotes, fallbackSummary: DEFAULT_REFILL_POLICY.fallbackSummary },
                billingPolicy: { liveEnabled: enabledActions.includes('billing-request'), intakeNotes: billingPolicyNotes, fallbackSummary: DEFAULT_BILLING_POLICY.fallbackSummary },
                insurancePolicy: { liveEnabled: enabledActions.includes('insurance-check'), intakeNotes: insurancePolicyNotes, fallbackSummary: DEFAULT_INSURANCE_POLICY.fallbackSummary },
                knowledgeConfig: { faqSummary, commonQuestions: parseTextList(commonQuestions) },
                escalationConfig: { escalationMessage, urgentCallbackWindowMinutes, notifyStaffImmediately: true },
                emergencyKeywords: parseTextList(emergencyKeywords),
                outOfScopeKeywords: parseTextList(outOfScopeKeywords),
            } as NonNullable<BusinessSettings['settings']>);
            setHasChanges(false);
            setSaveMessage('Practice setup saved. Wardline refreshed the live runtime workflow in the background.');
            businessQuery.refetch();
        } catch (error) {
            console.error(error);
            setSaveMessage('Unable to save practice setup right now.');
        }
    };

    const updateOperatingHour = (dayOfWeek: number, patch: Partial<OperatingHoursSlot>) => {
        setOperatingHours((current) => current.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry));
        setHasChanges(true);
    };

    const isLoading = businessContextLoading || businessesQuery.isLoading;
    const isSaving = updateBusiness.isPending || updateBusinessSettings.isPending;

    return (
        <div className="mx-auto max-w-6xl pb-12">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-foreground">Practice Setup</h1>
                    <p className="text-muted-foreground">Configure the practice. Wardline compiles the call flow behind the scenes.</p>
                </div>
                <Button variant="filled" onClick={handleSave} disabled={!businessId || !hasChanges || isSaving}>
                    {isSaving ? 'Saving...' : 'Save Practice Setup'}
                </Button>
            </div>

            {saveMessage && <div className="mb-6 rounded-2xl bg-[var(--background)] p-4 text-sm text-foreground neo-inset">{saveMessage}</div>}

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <div className="space-y-6">
                    <Card title="Practice">
                        {createSuccess && <div className="mb-4 rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-900">Practice created successfully.</div>}
                        {createError && <div className="mb-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-700">{createError}</div>}
                        <div className="space-y-3">
                            {(businessesQuery.data ?? []).map((business) => (
                                <button key={business.id} type="button" onClick={() => setBusinessId(business.id)} className={`flex w-full items-center justify-between rounded-2xl p-4 text-left ${businessId === business.id ? 'neo-raised bg-[var(--background)]' : 'neo-inset bg-[var(--background)]'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset"><Building2 className="h-5 w-5 text-primary" /></div>
                                        <div>
                                            <div className="font-medium text-foreground">{business.name}</div>
                                            <div className="text-xs text-muted-foreground">{business.slug}</div>
                                        </div>
                                    </div>
                                    {businessId === business.id && <CheckCircle className="h-5 w-5 text-primary" />}
                                </button>
                            ))}
                            {!isLoading && !(businessesQuery.data ?? []).length && <div className="rounded-2xl bg-[var(--background)] p-4 text-sm text-muted-foreground neo-inset">No practices found yet.</div>}
                            <div className="grid gap-3 border-t border-border/40 pt-4 md:grid-cols-2">
                                <input value={newBusinessName} onChange={(event) => setNewBusinessName(event.target.value)} placeholder="Practice name" className={neoFieldClass} />
                                <input value={newBusinessSlug} onChange={(event) => setNewBusinessSlug(event.target.value)} placeholder="Slug" className={neoFieldClass} />
                            </div>
                            <Button variant="primary" onClick={handleCreateBusiness} disabled={isCreating || !newBusinessName.trim()} icon={Plus}>{isCreating ? 'Creating...' : 'Create Practice'}</Button>
                            {businessId && (
                                <div className="grid gap-3 border-t border-border/40 pt-4 md:grid-cols-3">
                                    <SetupField label="Practice name"><input value={practiceName} onChange={(event) => { setPracticeName(event.target.value); setHasChanges(true); }} className={neoFieldClass} /></SetupField>
                                    <SetupField label="Slug"><input value={practiceSlug} onChange={(event) => { setPracticeSlug(event.target.value); setHasChanges(true); }} className={neoFieldClass} /></SetupField>
                                    <SetupField label="Timezone"><select value={timeZone} onChange={(event) => { setTimeZone(event.target.value); setHasChanges(true); }} className={neoSelectClass}><option value="America/New_York">America/New_York</option><option value="America/Chicago">America/Chicago</option><option value="America/Denver">America/Denver</option><option value="America/Los_Angeles">America/Los_Angeles</option></select></SetupField>
                                </div>
                            )}
                        </div>
                    </Card>

                    {businessId && (
                        <>
                            <Card title="Hours">{operatingHours.map((entry) => <div key={entry.dayOfWeek} className="mb-3 grid gap-3 rounded-2xl bg-[var(--background)] p-3 neo-inset md:grid-cols-[170px_1fr_1fr]"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-foreground">{DAY_LABELS[entry.dayOfWeek]}</span><Toggle checked={entry.isClosed} onChange={(checked) => updateOperatingHour(entry.dayOfWeek, { isClosed: checked, startTime: checked ? null : entry.startTime ?? '09:00', endTime: checked ? null : entry.endTime ?? '17:00' })} /></div><input type="time" value={entry.startTime ?? ''} disabled={entry.isClosed} onChange={(event) => updateOperatingHour(entry.dayOfWeek, { startTime: event.target.value })} className={neoFieldClass} /><input type="time" value={entry.endTime ?? ''} disabled={entry.isClosed} onChange={(event) => updateOperatingHour(entry.dayOfWeek, { endTime: event.target.value })} className={neoFieldClass} /></div>)}</Card>

                            <Card title="Services & Policies">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-3">{DEFAULT_ENABLED_ACTIONS.map((action) => <label key={action} className="flex items-center justify-between rounded-2xl bg-[var(--background)] px-4 py-3 neo-inset"><span className="text-sm font-medium text-foreground">{actionLabel(action)}</span><Toggle checked={enabledActions.includes(action)} onChange={() => { setEnabledActions((current) => current.includes(action) ? current.filter((entry) => entry !== action) : [...current, action]); setHasChanges(true); }} /></label>)}
                                        <SetupField label="After-hours behavior"><select value={afterHoursMode} onChange={(event) => { setAfterHoursMode(event.target.value as typeof afterHoursMode); setHasChanges(true); }} className={neoSelectClass}><option value="urgent_voicemail">Urgent voicemail</option><option value="voicemail">General voicemail</option><option value="next_business_day_callback">Next business day callback</option></select></SetupField>
                                        <SetupField label="After-hours caller message"><SetupTextarea value={afterHoursGreeting} onChange={(event) => { setAfterHoursGreeting(event.target.value); setHasChanges(true); }} /></SetupField>
                                    </div>
                                    <div className="space-y-3">
                                        <SetupField label="Refill policy"><SetupTextarea value={refillPolicyNotes} onChange={(event) => { setRefillPolicyNotes(event.target.value); setHasChanges(true); }} /></SetupField>
                                        <SetupField label="Insurance policy"><SetupTextarea value={insurancePolicyNotes} onChange={(event) => { setInsurancePolicyNotes(event.target.value); setHasChanges(true); }} /></SetupField>
                                        <SetupField label="Billing policy"><SetupTextarea value={billingPolicyNotes} onChange={(event) => { setBillingPolicyNotes(event.target.value); setHasChanges(true); }} /></SetupField>
                                    </div>
                                </div>
                            </Card>

                            <Card title="FAQ / Knowledge">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <SetupField label="FAQ summary"><SetupTextarea value={faqSummary} onChange={(event) => { setFaqSummary(event.target.value); setHasChanges(true); }} /></SetupField>
                                    <SetupField label="Common questions"><SetupTextarea value={commonQuestions} onChange={(event) => { setCommonQuestions(event.target.value); setHasChanges(true); }} placeholder={'Office hours\nInsurance accepted\nRefill requests'} /></SetupField>
                                </div>
                            </Card>

                            <Card title="Notifications / Escalation">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <SetupField label="Escalation instructions"><SetupTextarea value={escalationMessage} onChange={(event) => { setEscalationMessage(event.target.value); setHasChanges(true); }} /></SetupField>
                                    <SetupField label="Urgent callback window (minutes)"><input type="number" min={5} value={urgentCallbackWindowMinutes} onChange={(event) => { setUrgentCallbackWindowMinutes(Math.max(5, parseInt(event.target.value, 10) || 30)); setHasChanges(true); }} className={neoFieldClass} /></SetupField>
                                </div>
                            </Card>

                            <Card title="Privacy / Recording">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <SetupField label="Recording default"><select value={recordingDefault} onChange={(event) => { setRecordingDefault(event.target.value as 'ON' | 'OFF' | 'ASK'); setHasChanges(true); }} className={neoSelectClass}><option value="ASK">Ask caller before recording</option><option value="ON">Record by default</option><option value="OFF">Never record by default</option></select></SetupField>
                                    <SetupField label="Transcript retention days"><input type="number" min={1} max={365} value={transcriptRetentionDays} onChange={(event) => { setTranscriptRetentionDays(Math.max(1, parseInt(event.target.value, 10) || 30)); setHasChanges(true); }} className={neoFieldClass} /></SetupField>
                                    <SetupField label="Emergency keywords"><SetupTextarea value={emergencyKeywords} onChange={(event) => { setEmergencyKeywords(event.target.value); setHasChanges(true); }} /></SetupField>
                                    <SetupField label="Out-of-scope keywords"><SetupTextarea value={outOfScopeKeywords} onChange={(event) => { setOutOfScopeKeywords(event.target.value); setHasChanges(true); }} /></SetupField>
                                </div>
                            </Card>
                        </>
                    )}
                </div>

                <div className="space-y-6">
                    <Card title="Setup Readiness">{readiness.map((item) => <div key={item.key} className="mb-3 flex items-center justify-between rounded-2xl bg-[var(--background)] px-4 py-3 neo-inset"><span className="text-sm font-medium text-foreground">{item.label}</span><span className={`text-xs font-semibold ${item.complete ? 'text-emerald-700' : 'text-amber-700'}`}>{item.complete ? 'Ready' : 'Needs setup'}</span></div>)}</Card>
                    <Card title="Integrations">
                        {(businessId ? integrations : []).map((integration) => <div key={integration.id} className="mb-3 rounded-2xl bg-[var(--background)] px-4 py-3 neo-inset"><div className="flex items-center justify-between"><div><div className="text-sm font-medium text-foreground">{integration.category}</div><div className="text-xs text-muted-foreground">{integration.vendor}</div></div><span className={`text-xs font-semibold ${integration.status === 'CONNECTED' ? 'text-emerald-700' : integration.status === 'ERROR' ? 'text-red-700' : 'text-amber-700'}`}>{integration.status}</span></div></div>)}
                        {!businessId && <div className="rounded-2xl bg-[var(--background)] p-4 text-sm text-muted-foreground neo-inset">Select a practice to view integrations.</div>}
                        {businessId && integrations.length === 0 && <div className="rounded-2xl bg-[var(--background)] p-4 text-sm text-muted-foreground neo-inset">No integrations configured yet.</div>}
                        <Link href="/dashboard/integration-failures" className="inline-flex text-sm font-semibold text-primary hover:underline">Open integration setup</Link>
                    </Card>
                    <Card title="What changed">
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-4 w-4 text-primary" /><p>Practice setup replaces customer-authored call flow. Wardline now compiles the runtime workflow from these settings.</p></div>
                            <div className="flex items-start gap-3"><ClipboardList className="mt-0.5 h-4 w-4 text-primary" /><p>Emergency screening, after-hours handling, confirmation before write actions, and follow-up fallback still run under the hood.</p></div>
                            <div className="flex items-start gap-3"><PlugZap className="mt-0.5 h-4 w-4 text-primary" /><p>Agents and workflow editing remain internal-only tools for advanced testing and migration support.</p></div>
                        </div>
                    </Card>
                    <Card title="Practice Setup Sections">
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-3"><Building2 className="h-4 w-4 text-primary" /> Practice</div>
                            <div className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-primary" /> Hours</div>
                            <div className="flex items-center gap-3"><ClipboardList className="h-4 w-4 text-primary" /> Services and Policies</div>
                            <div className="flex items-center gap-3"><PlugZap className="h-4 w-4 text-primary" /> Integrations</div>
                            <div className="flex items-center gap-3"><BookOpen className="h-4 w-4 text-primary" /> FAQ / Knowledge</div>
                            <div className="flex items-center gap-3"><Shield className="h-4 w-4 text-primary" /> Privacy / Recording</div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
