"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Webhook } from 'lucide-react';
import { WebhookNodeData } from '../nodes/WebhookNode';

interface WebhookConfigPanelProps {
    data: WebhookNodeData;
    onChange: (data: Partial<WebhookNodeData>) => void;
}

export function WebhookConfigPanel({ data, onChange }: WebhookConfigPanelProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-indigo-100">
                    <Webhook className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Webhook Node</h3>
                    <p className="text-xs text-muted-foreground">Call an external HTTP endpoint</p>
                </div>
            </div>

            <div>
                <Label htmlFor="wh-label">Node Label</Label>
                <Input
                    id="wh-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="EHR Lookup"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="wh-method">HTTP Method</Label>
                <Select
                    value={data.method ?? 'POST'}
                    onValueChange={(v: WebhookNodeData['method']) => onChange({ method: v })}
                >
                    <SelectTrigger id="wh-method" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label htmlFor="wh-url">URL</Label>
                <Input
                    id="wh-url"
                    value={data.url ?? ''}
                    onChange={(e) => onChange({ url: e.target.value })}
                    placeholder="https://api.example.com/endpoint"
                    className="mt-1 font-mono text-sm"
                    type="url"
                />
            </div>

            <div>
                <Label htmlFor="wh-body">Request Body Template (JSON)</Label>
                <Textarea
                    id="wh-body"
                    value={data.bodyTemplate ?? ''}
                    onChange={(e) => onChange({ bodyTemplate: e.target.value })}
                    rows={5}
                    className="mt-1 font-mono text-sm"
                    placeholder={`{\n  "callId": "{{call_id}}",\n  "patientName": "{{patient_name}}"\n}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Use <code className="bg-muted px-1 rounded">{'{{field_name}}'}</code> to
                    interpolate collected fields
                </p>
            </div>
        </div>
    );
}
