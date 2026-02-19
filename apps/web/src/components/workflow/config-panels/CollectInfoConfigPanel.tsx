"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { CollectInfoNodeData, CollectInfoField } from '../nodes/CollectInfoNode';

interface CollectInfoConfigPanelProps {
    data: CollectInfoNodeData;
    onChange: (data: Partial<CollectInfoNodeData>) => void;
}

export function CollectInfoConfigPanel({ data, onChange }: CollectInfoConfigPanelProps) {
    const fields: CollectInfoField[] = data.fields ?? [];

    const addField = () => {
        onChange({
            fields: [
                ...fields,
                { name: '', type: 'text', required: true, prompt: '' },
            ],
        });
    };

    const updateField = (index: number, updates: Partial<CollectInfoField>) => {
        const updated = fields.map((f, i) => (i === index ? { ...f, ...updates } : f));
        onChange({ fields: updated });
    };

    const removeField = (index: number) => {
        onChange({ fields: fields.filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-cyan-100">
                    <ClipboardList className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Collect Information</h3>
                    <p className="text-xs text-muted-foreground">
                        Gather multiple fields from the caller in sequence
                    </p>
                </div>
            </div>

            <div>
                <Label htmlFor="ci-label">Node Label</Label>
                <Input
                    id="ci-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="Collect Patient Details"
                    className="mt-1"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label>Fields to Collect</Label>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={addField}
                        className="h-7 text-xs gap-1"
                    >
                        <Plus className="w-3 h-3" /> Add Field
                    </Button>
                </div>

                {fields.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                        No fields yet. Click &ldquo;Add Field&rdquo; to start.
                    </p>
                )}

                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground w-4">
                                    {index + 1}.
                                </span>
                                <Input
                                    value={field.name}
                                    onChange={(e) => updateField(index, { name: e.target.value })}
                                    placeholder="field_name"
                                    className="font-mono text-sm flex-1 h-7"
                                />
                                <Select
                                    value={field.type}
                                    onValueChange={(v: CollectInfoField['type']) =>
                                        updateField(index, { type: v })
                                    }
                                >
                                    <SelectTrigger className="w-24 h-7 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="phone">Phone</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => removeField(index)}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>

                            <Input
                                value={field.prompt ?? ''}
                                onChange={(e) => updateField(index, { prompt: e.target.value })}
                                placeholder="Prompt: Could you tell me your..."
                                className="text-sm h-7"
                            />

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={`ci-req-${index}`}
                                    checked={field.required}
                                    onCheckedChange={(c) => updateField(index, { required: !!c })}
                                />
                                <label htmlFor={`ci-req-${index}`} className="text-xs cursor-pointer">
                                    Required
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
