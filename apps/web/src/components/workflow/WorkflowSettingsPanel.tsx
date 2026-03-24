"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Save, Shield, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBusiness } from '@/lib/business-context';
import { useBusinessSettings, useUpdateBusinessSettings } from '@/lib/hooks/query-hooks';
import type { OperatingHoursSlot } from '@/lib/api-types';

interface WorkflowSettingsPanelProps {
    onClose: () => void;
}

function normalizeKeywordList(value: string): string[] {
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

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

export function WorkflowSettingsPanel({ onClose }: WorkflowSettingsPanelProps) {
    const { businessId } = useBusiness();
    const businessQuery = useBusinessSettings();
    const updateSettings = useUpdateBusinessSettings();

    const [hasChanges, setHasChanges] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [recordingDefault, setRecordingDefault] = useState<'ON' | 'OFF' | 'ASK'>('ASK');
    const [transcriptRetentionDays, setTranscriptRetentionDays] = useState(7);
    const [emergencyKeywords, setEmergencyKeywords] = useState('');
    const [outOfScopeKeywords, setOutOfScopeKeywords] = useState('');
    const [operatingHours, setOperatingHours] = useState<OperatingHoursSlot[]>(DEFAULT_OPERATING_HOURS);

    useEffect(() => {
        const settings = businessQuery.data?.settings;
        if (!settings) return;

        setRecordingDefault((settings.recordingDefault?.toUpperCase() as 'ON' | 'OFF' | 'ASK') || 'ASK');
        setTranscriptRetentionDays(settings.transcriptRetentionDays ?? 7);
        setEmergencyKeywords((settings.emergencyKeywords || []).join(', '));
        setOutOfScopeKeywords((settings.outOfScopeKeywords || []).join(', '));
        setOperatingHours(normalizeOperatingHours(settings.operatingHours));
        setHasChanges(false);
    }, [businessQuery.data?.settings]);

    const updateOperatingHour = (dayOfWeek: number, patch: Partial<OperatingHoursSlot>) => {
        setOperatingHours((current) =>
            current.map((entry) => {
                if (entry.dayOfWeek !== dayOfWeek) return entry;
                const next = { ...entry, ...patch };
                if (next.isClosed) {
                    next.startTime = null;
                    next.endTime = null;
                } else {
                    next.startTime = next.startTime ?? '09:00';
                    next.endTime = next.endTime ?? '17:00';
                }
                return next;
            }),
        );
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!businessId) return;

        try {
            setSaveMessage(null);
            await updateSettings.mutateAsync({
                recordingDefault,
                transcriptRetentionDays,
                operatingHours,
                emergencyKeywords: normalizeKeywordList(emergencyKeywords),
                outOfScopeKeywords: normalizeKeywordList(outOfScopeKeywords),
            });
            setHasChanges(false);
            setSaveMessage('Business call policy saved.');
        } catch (error) {
            console.error('Save error:', error);
            setSaveMessage('Unable to save call policy right now.');
        }
    };

    const isSaving = updateSettings.isPending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="flex max-h-[90vh] w-full max-w-4xl flex-col">
                <CardHeader className="border-b">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle>Workflow Settings</CardTitle>
                            <CardDescription>
                                Persist the live call rules that power privacy, urgency detection, and after-hours behavior.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={!businessId || !hasChanges || isSaving} size="sm">
                                <Save className="mr-2 h-4 w-4" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button onClick={onClose} variant="ghost" size="icon">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {saveMessage && (
                        <div className="mt-3 rounded border border-border/60 bg-muted/40 p-2 text-sm text-foreground">
                            {saveMessage}
                        </div>
                    )}

                    {hasChanges && (
                        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">
                            You have unsaved workflow runtime changes.
                        </div>
                    )}
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full px-6 py-5">
                        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
                            <div className="space-y-6">
                                <section className="rounded-2xl border p-5">
                                    <div className="mb-4 flex items-start gap-3">
                                        <div className="rounded-xl bg-emerald-100 p-2">
                                            <Clock className="h-4 w-4 text-emerald-700" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">Operating hours</h3>
                                            <p className="text-sm text-muted-foreground">
                                                After-hours voicemail and urgent-call behavior use this weekly schedule in the business timezone.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {operatingHours.map((entry) => (
                                            <div
                                                key={entry.dayOfWeek}
                                                className="grid gap-3 rounded-2xl border border-border/70 bg-[var(--background)] p-3 md:grid-cols-[160px_1fr_1fr]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        id={`closed-${entry.dayOfWeek}`}
                                                        checked={entry.isClosed}
                                                        onCheckedChange={(checked) => {
                                                            updateOperatingHour(entry.dayOfWeek, { isClosed: !!checked });
                                                        }}
                                                    />
                                                    <label htmlFor={`closed-${entry.dayOfWeek}`} className="text-sm font-medium text-foreground">
                                                        {DAY_LABELS[entry.dayOfWeek]}
                                                    </label>
                                                </div>

                                                <div>
                                                    <Label htmlFor={`start-${entry.dayOfWeek}`}>Opens</Label>
                                                    <Input
                                                        id={`start-${entry.dayOfWeek}`}
                                                        type="time"
                                                        value={entry.startTime ?? ''}
                                                        disabled={entry.isClosed}
                                                        onChange={(event) => {
                                                            updateOperatingHour(entry.dayOfWeek, { startTime: event.target.value });
                                                        }}
                                                        className="mt-1"
                                                    />
                                                </div>

                                                <div>
                                                    <Label htmlFor={`end-${entry.dayOfWeek}`}>Closes</Label>
                                                    <Input
                                                        id={`end-${entry.dayOfWeek}`}
                                                        type="time"
                                                        value={entry.endTime ?? ''}
                                                        disabled={entry.isClosed}
                                                        onChange={(event) => {
                                                            updateOperatingHour(entry.dayOfWeek, { endTime: event.target.value });
                                                        }}
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-2xl border p-5">
                                    <div className="mb-4 flex items-start gap-3">
                                        <div className="rounded-xl bg-sky-100 p-2">
                                            <Clock className="h-4 w-4 text-sky-700" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">Recording and retention</h3>
                                            <p className="text-sm text-muted-foreground">
                                                V1 stores compact summaries by default and keeps transcript retention short.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="recording-default">Recording default</Label>
                                            <Select
                                                value={recordingDefault}
                                                onValueChange={(value: 'ON' | 'OFF' | 'ASK') => {
                                                    setRecordingDefault(value);
                                                    setHasChanges(true);
                                                }}
                                            >
                                                <SelectTrigger id="recording-default" className="mt-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ASK">Ask caller before recording</SelectItem>
                                                    <SelectItem value="ON">Record by default</SelectItem>
                                                    <SelectItem value="OFF">Never record by default</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="retention-days">Transcript retention days</Label>
                                            <Input
                                                id="retention-days"
                                                type="number"
                                                min={1}
                                                max={365}
                                                value={transcriptRetentionDays}
                                                onChange={(event) => {
                                                    setTranscriptRetentionDays(Math.max(1, parseInt(event.target.value, 10) || 7));
                                                    setHasChanges(true);
                                                }}
                                                className="mt-1"
                                            />
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Use a short window for debugging and rely on summaries for long-term storage.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-2xl border p-5">
                                    <div className="mb-4 flex items-start gap-3">
                                        <div className="rounded-xl bg-rose-100 p-2">
                                            <AlertTriangle className="h-4 w-4 text-rose-700" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">Urgency and emergency keywords</h3>
                                            <p className="text-sm text-muted-foreground">
                                                These keywords supplement the hard-coded emergency screen used during calls.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="emergency-keywords">Emergency keyword overrides</Label>
                                        <Textarea
                                            id="emergency-keywords"
                                            value={emergencyKeywords}
                                            onChange={(event) => {
                                                setEmergencyKeywords(event.target.value);
                                                setHasChanges(true);
                                            }}
                                            placeholder="chest pain, difficulty breathing, severe bleeding"
                                            className="mt-1 min-h-[120px]"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Separate values with commas or new lines.
                                        </p>
                                    </div>
                                </section>

                                <section className="rounded-2xl border p-5">
                                    <div className="mb-4 flex items-start gap-3">
                                        <div className="rounded-xl bg-violet-100 p-2">
                                            <Shield className="h-4 w-4 text-violet-700" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">Scope guardrails</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Help the AI deflect unsupported requests and keep the call inside the approved workflow.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="out-of-scope-keywords">Out-of-scope keywords</Label>
                                        <Textarea
                                            id="out-of-scope-keywords"
                                            value={outOfScopeKeywords}
                                            onChange={(event) => {
                                                setOutOfScopeKeywords(event.target.value);
                                                setHasChanges(true);
                                            }}
                                            placeholder="legal advice, emergency diagnosis, complex triage"
                                            className="mt-1 min-h-[120px]"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Use this to steer the assistant toward capture-and-follow-up instead of unsafe improvisation.
                                        </p>
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-6">
                                <section className="rounded-2xl border p-5">
                                    <h3 className="font-semibold">V1 policy snapshot</h3>
                                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                                        <p>One main workflow per business.</p>
                                        <p>English only.</p>
                                        <p>After-hours urgent calls become priority voicemails for next-business-day review.</p>
                                        <p>Emergency phrases still trigger immediate redirect messaging.</p>
                                        <p>External write actions must be confirmed before execution.</p>
                                    </div>
                                </section>

                                <section className="rounded-2xl border p-5">
                                    <h3 className="font-semibold">What this persists</h3>
                                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                                        <p>Business recording default</p>
                                        <p>Transcript retention window</p>
                                        <p>Weekly operating hours</p>
                                        <p>Emergency keyword overrides</p>
                                        <p>Out-of-scope keyword overrides</p>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                    <h3 className="font-semibold text-amber-900">After-hours behavior</h3>
                                    <p className="mt-2 text-sm text-amber-800">
                                        V1 does not live-route urgent after-hours calls. The caller is redirected safely, a priority
                                        voicemail is captured, and staff see it in the next-day <span className="font-medium">Urgent Calls</span> queue.
                                    </p>
                                </section>
                            </div>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
