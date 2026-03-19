"use client";

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Route, Plus, Trash2 } from 'lucide-react';
import { RouteNodeData } from '../nodes/RouteNode';

interface RouteConfigPanelProps {
    data: RouteNodeData;
    onChange: (data: Partial<RouteNodeData>) => void;
}

export function RouteConfigPanel({ data, onChange }: RouteConfigPanelProps) {
    const rules = data.routingRules ?? [];

    const addRule = () => {
        onChange({ routingRules: [...rules, { condition: '', target: '' }] });
    };

    const updateRule = (index: number, field: 'condition' | 'target', value: string) => {
        const updated = rules.map((r, i) => (i === index ? { ...r, [field]: value } : r));
        onChange({ routingRules: updated });
    };

    const removeRule = (index: number) => {
        onChange({ routingRules: rules.filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-yellow-100">
                    <Route className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Route Node</h3>
                    <p className="text-xs text-muted-foreground">Route calls based on conditions</p>
                </div>
            </div>

            <div>
                <Label htmlFor="route-label">Node Label</Label>
                <Input
                    id="route-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="Route Call"
                    className="mt-1"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label>Routing Rules</Label>
                    <Button size="sm" variant="outline" onClick={addRule} className="h-7 gap-1 text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Add Rule
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Rules are evaluated in order. Each condition is a plain-text description
                    (e.g. &ldquo;intent equals scheduling&rdquo;) and target is the next node ID.
                </p>

                {rules.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No routing rules defined</p>
                )}

                <div className="space-y-3">
                    {rules.map((rule, i) => (
                        <div key={i} className="rounded-lg border p-3 bg-muted/30 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Rule {i + 1}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeRule(i)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            <div>
                                <Label className="text-xs">Condition</Label>
                                <Input
                                    value={rule.condition}
                                    onChange={(e) => updateRule(i, 'condition', e.target.value)}
                                    placeholder="intent equals scheduling"
                                    className="mt-1 text-sm font-mono"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Target Node ID</Label>
                                <Input
                                    value={rule.target}
                                    onChange={(e) => updateRule(i, 'target', e.target.value)}
                                    placeholder="node-scheduling-queue"
                                    className="mt-1 text-sm font-mono"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <Label htmlFor="route-fallback">Fallback Target Node ID</Label>
                <Input
                    id="route-fallback"
                    value={data.fallbackTarget ?? ''}
                    onChange={(e) => onChange({ fallbackTarget: e.target.value })}
                    placeholder="node-general-queue"
                    className="mt-1 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Node to route to when no rule matches
                </p>
            </div>
        </div>
    );
}
