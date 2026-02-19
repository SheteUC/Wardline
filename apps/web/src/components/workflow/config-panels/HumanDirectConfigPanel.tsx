"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { UserCheck } from 'lucide-react';
import { HumanDirectNodeData } from '../nodes/HumanDirectNode';

interface HumanDirectConfigPanelProps {
    data: HumanDirectNodeData;
    onChange: (data: Partial<HumanDirectNodeData>) => void;
}

export function HumanDirectConfigPanel({ data, onChange }: HumanDirectConfigPanelProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-blue-100">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Direct to Agent</h3>
                    <p className="text-xs text-muted-foreground">Route the call to a specific human agent</p>
                </div>
            </div>

            <div>
                <Label htmlFor="hd-label">Node Label</Label>
                <Input
                    id="hd-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="Transfer to Dr. Smith"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="hd-agent-id">Agent ID</Label>
                <Input
                    id="hd-agent-id"
                    value={data.agentId ?? ''}
                    onChange={(e) => onChange({ agentId: e.target.value })}
                    placeholder="agent-uuid"
                    className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    The unique ID of the target agent from the Agents page
                </p>
            </div>

            <div>
                <Label htmlFor="hd-agent-name">Agent Display Name</Label>
                <Input
                    id="hd-agent-name"
                    value={data.agentName ?? ''}
                    onChange={(e) => onChange({ agentName: e.target.value })}
                    placeholder="Dr. Smith – Cardiology"
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Shown in the workflow editor canvas (does not affect routing)
                </p>
            </div>

            <div>
                <Label htmlFor="hd-fallback">Fallback Queue ID</Label>
                <Input
                    id="hd-fallback"
                    value={data.fallbackQueueId ?? ''}
                    onChange={(e) => onChange({ fallbackQueueId: e.target.value })}
                    placeholder="queue-uuid"
                    className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    If the specified agent is offline, fall back to this queue
                </p>
            </div>
        </div>
    );
}
