"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConditionalNodeData } from '../nodes/ConditionalNode';
import { GitBranch, Plus, Trash2 } from 'lucide-react';

interface ConditionalConfigPanelProps {
    data: ConditionalNodeData;
    onChange: (data: Partial<ConditionalNodeData>) => void;
}

export function ConditionalConfigPanel({ data, onChange }: ConditionalConfigPanelProps) {
    const conditions = data.conditions || [];
    
    const addCondition = () => {
        onChange({
            conditions: [
                ...conditions,
                { expression: '', targetNode: '' }
            ]
        });
    };
    
    const updateCondition = (index: number, updates: Partial<typeof conditions[0]>) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], ...updates };
        onChange({ conditions: newConditions });
    };
    
    const removeCondition = (index: number) => {
        onChange({ conditions: conditions.filter((_, i) => i !== index) });
    };
    
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-amber-100">
                    <GitBranch className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Conditional Configuration</h3>
                    <p className="text-xs text-muted-foreground">Configure routing conditions</p>
                </div>
            </div>

            {/* Label */}
            <div>
                <Label htmlFor="conditional-label">Node Label</Label>
                <Input
                    id="conditional-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="e.g., Check Intent"
                    className="mt-1"
                />
            </div>

            {/* Condition Type */}
            <div>
                <Label htmlFor="condition-type">Condition Type</Label>
                <Select
                    value={data.conditionType || 'intent'}
                    onValueChange={(value: any) => onChange({ conditionType: value })}
                >
                    <SelectTrigger id="condition-type" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="intent">Intent-based</SelectItem>
                        <SelectItem value="sentiment">Sentiment-based</SelectItem>
                        <SelectItem value="data_verification">Data Verification</SelectItem>
                        <SelectItem value="custom_expression">Custom Expression</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                    How to evaluate the condition
                </p>
            </div>

            {/* Conditions List */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label>Conditions</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addCondition}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add Condition
                    </Button>
                </div>
                
                {conditions.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed rounded-lg">
                        <p className="text-sm text-muted-foreground">
                            No conditions defined. Add a condition to start routing.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {conditions.map((condition, index) => (
                            <div key={index} className="p-3 border rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline">Condition {index + 1}</Badge>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeCondition(index)}
                                    >
                                        <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                </div>
                                
                                <div>
                                    <Label className="text-xs">Expression</Label>
                                    <Input
                                        value={condition.expression}
                                        onChange={(e) => updateCondition(index, { expression: e.target.value })}
                                        placeholder="intent == 'scheduling'"
                                        className="mt-1 font-mono text-xs"
                                    />
                                </div>
                                
                                <div>
                                    <Label className="text-xs">Target Node ID</Label>
                                    <Input
                                        value={condition.targetNode}
                                        onChange={(e) => updateCondition(index, { targetNode: e.target.value })}
                                        placeholder="node-id-to-route-to"
                                        className="mt-1 text-xs"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Default Target */}
            <div>
                <Label htmlFor="default-target">Default Target (No Match)</Label>
                <Input
                    id="default-target"
                    value={data.defaultTarget || ''}
                    onChange={(e) => onChange({ defaultTarget: e.target.value })}
                    placeholder="node-id-for-no-match"
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Node to route to if no conditions match
                </p>
            </div>

            {/* Examples */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-900 mb-2">Expression Examples:</p>
                <div className="space-y-1 text-xs text-amber-800 font-mono">
                    <div>• intent == "scheduling"</div>
                    <div>• sentiment.frustration {">"} 0.7</div>
                    <div>• is_emergency == true</div>
                    <div>• collected_fields.age {">"} 65</div>
                </div>
            </div>
        </div>
    );
}
