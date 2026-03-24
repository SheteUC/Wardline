"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { IntegrationNodeData } from '../nodes/IntegrationNode';

const RUNTIME_ACTIONS = [
    {
        value: 'appointment-request',
        label: 'Appointment request',
        category: 'SCHEDULING',
        requiresConfirmation: true,
        description: 'Book, reschedule, or cancel through the configured scheduling integration.',
    },
    {
        value: 'refill-request',
        label: 'Refill request',
        category: 'EHR_REFILL',
        requiresConfirmation: true,
        description: 'Submit a refill request through the configured EHR/refill integration.',
    },
    {
        value: 'insurance-check',
        label: 'Insurance check',
        category: 'INSURANCE',
        requiresConfirmation: false,
        description: 'Check acceptance or coverage through the configured insurance integration.',
    },
    {
        value: 'billing-request',
        label: 'Billing request',
        category: 'BILLING',
        requiresConfirmation: true,
        description: 'Send a billing case or capture a billing follow-up through the configured billing integration.',
    },
    {
        value: 'manual-follow-up',
        label: 'Manual follow-up',
        category: 'MANUAL',
        requiresConfirmation: false,
        description: 'Skip live execution and always create a follow-up task for staff review.',
    },
] as const;

interface IntegrationConfigPanelProps {
    data: IntegrationNodeData;
    onChange: (data: Partial<IntegrationNodeData>) => void;
}

export function IntegrationConfigPanel({ data, onChange }: IntegrationConfigPanelProps) {
    const selectedAction =
        RUNTIME_ACTIONS.find((action) => action.value === data.runtimeAction) ?? RUNTIME_ACTIONS[0];

    const handleActionChange = (runtimeAction: string) => {
        const action = RUNTIME_ACTIONS.find((item) => item.value === runtimeAction) ?? RUNTIME_ACTIONS[0];
        onChange({
            runtimeAction: action.value,
            integrationCategory: action.category,
            requiresConfirmation: action.requiresConfirmation,
        });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <Label htmlFor="integration-label">Node Label</Label>
                <Input
                    id="integration-label"
                    value={data.label}
                    onChange={(event) => onChange({ label: event.target.value })}
                    placeholder="Runtime action"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="runtime-action">Runtime Action</Label>
                <Select value={selectedAction.value} onValueChange={handleActionChange}>
                    <SelectTrigger id="runtime-action">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {RUNTIME_ACTIONS.map((action) => (
                            <SelectItem key={action.value} value={action.value}>
                                {action.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{selectedAction.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{data.integrationCategory ?? selectedAction.category}</Badge>
                {data.requiresConfirmation && <Badge variant="outline">Confirmation required</Badge>}
                <Badge variant="outline">
                    {(data.fallbackBehavior ?? 'create_follow_up').replaceAll('_', ' ')}
                </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                    <div className="text-sm font-medium">Require caller confirmation</div>
                    <p className="text-xs text-muted-foreground">
                        Write actions must confirm the summarized request before execution.
                    </p>
                </div>
                <Switch
                    checked={Boolean(data.requiresConfirmation)}
                    onCheckedChange={(checked) => onChange({ requiresConfirmation: checked })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="fallback-behavior">Fallback Behavior</Label>
                <Select
                    value={(data.fallbackBehavior ?? 'create_follow_up') as string}
                    onValueChange={(value) =>
                        onChange({ fallbackBehavior: value as IntegrationNodeData['fallbackBehavior'] })
                    }
                >
                    <SelectTrigger id="fallback-behavior">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="create_follow_up">Create follow-up task</SelectItem>
                        <SelectItem value="fail">Fail the node</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="integration-prompt">Operator Notes</Label>
                <Textarea
                    id="integration-prompt"
                    value={data.prompt ?? ''}
                    onChange={(event) => onChange({ prompt: event.target.value })}
                    placeholder="Explain what this runtime action should collect or confirm before execution."
                    className="min-h-[96px]"
                />
            </div>

            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900">
                New integration nodes compile to generic runtime actions. Vendor selection, credentials, health checks,
                and capability discovery now live in the business integration settings screen.
            </div>
        </div>
    );
}
