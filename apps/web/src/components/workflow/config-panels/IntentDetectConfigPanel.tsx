"use client";

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, X } from 'lucide-react';
import { IntentDetectNodeData } from '../nodes/IntentDetectNode';

interface IntentDetectConfigPanelProps {
    data: IntentDetectNodeData;
    onChange: (data: Partial<IntentDetectNodeData>) => void;
}

export function IntentDetectConfigPanel({ data, onChange }: IntentDetectConfigPanelProps) {
    const [newIntent, setNewIntent] = useState('');

    const addIntent = () => {
        const trimmed = newIntent.trim();
        if (!trimmed) return;
        const updated = [...(data.intents ?? []), trimmed];
        onChange({ intents: updated });
        setNewIntent('');
    };

    const removeIntent = (index: number) => {
        const updated = (data.intents ?? []).filter((_, i) => i !== index);
        onChange({ intents: updated });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-indigo-100">
                    <Target className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Intent Detect Node</h3>
                    <p className="text-xs text-muted-foreground">Detect caller intent from the conversation</p>
                </div>
            </div>

            <div>
                <Label htmlFor="id-label">Node Label</Label>
                <Input
                    id="id-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="Detect Intent"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="id-threshold">Confidence Threshold</Label>
                <Input
                    id="id-threshold"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={data.confidenceThreshold ?? 0.7}
                    onChange={(e) => onChange({ confidenceThreshold: parseFloat(e.target.value) })}
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Minimum confidence score (0–1) to accept a detected intent
                </p>
            </div>

            <div>
                <Label>Supported Intents</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    List the intent keys this node should detect (e.g. scheduling, billing, refill)
                </p>

                <div className="flex gap-2 mb-2">
                    <Input
                        value={newIntent}
                        onChange={(e) => setNewIntent(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addIntent()}
                        placeholder="scheduling"
                        className="font-mono text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={addIntent} className="shrink-0">
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {(data.intents ?? []).map((intent, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                            {intent}
                            <button
                                type="button"
                                onClick={() => removeIntent(i)}
                                className="ml-0.5 rounded hover:bg-muted-foreground/20"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                    {(data.intents ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No intents added yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}
