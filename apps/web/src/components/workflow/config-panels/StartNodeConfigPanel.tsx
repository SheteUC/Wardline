"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StartNodeData } from '../nodes/StartNode';
import { Play } from 'lucide-react';

interface StartNodeConfigPanelProps {
    data: StartNodeData;
    onChange: (data: Partial<StartNodeData>) => void;
}

export function StartNodeConfigPanel({ data, onChange }: StartNodeConfigPanelProps) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-blue-200">
                    <Play className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                    <h3 className="font-semibold">Start Node Configuration</h3>
                    <p className="text-xs text-muted-foreground">Configure call entry point</p>
                </div>
            </div>

            {/* Label */}
            <div>
                <Label htmlFor="start-label">Node Label</Label>
                <Input
                    id="start-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="e.g., Start Call"
                    className="mt-1"
                />
            </div>

            {/* Greeting Message */}
            <div>
                <Label htmlFor="start-greeting">Greeting Message</Label>
                <Textarea
                    id="start-greeting"
                    value={data.greetingMessage || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ greetingMessage: e.target.value })}
                    placeholder="Thank you for calling. How can I help you today?"
                    className="mt-1"
                    rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Initial greeting message when call begins
                </p>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                    <strong>Entry Point:</strong> This is the first node in your workflow. 
                    Every call starts here and flows to the connected nodes.
                </p>
            </div>
        </div>
    );
}
