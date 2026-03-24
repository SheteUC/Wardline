"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpCircle } from 'lucide-react';
import { QuestionNodeData } from '../nodes/QuestionNode';

interface QuestionConfigPanelProps {
    data: QuestionNodeData;
    onChange: (data: Partial<QuestionNodeData>) => void;
}

export function QuestionConfigPanel({ data, onChange }: QuestionConfigPanelProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-green-100">
                    <HelpCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Question Node</h3>
                    <p className="text-xs text-muted-foreground">Ask a single question and collect the answer</p>
                </div>
            </div>

            <div>
                <Label htmlFor="q-label">Node Label</Label>
                <Input
                    id="q-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="Ask Patient Name"
                    className="mt-1"
                />
            </div>

            <div>
                <Label htmlFor="q-text">Question Text</Label>
                <Input
                    id="q-text"
                    value={data.questionText ?? ''}
                    onChange={(e) => onChange({ questionText: e.target.value })}
                    placeholder="Could you please tell me your full name?"
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    The question the AI will ask the caller
                </p>
            </div>

            <div>
                <Label htmlFor="q-field">Save Answer To Field</Label>
                <Input
                    id="q-field"
                    value={data.fieldName ?? ''}
                    onChange={(e) => onChange({ fieldName: e.target.value })}
                    placeholder="patient_name"
                    className="mt-1 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Field name used in downstream nodes and the handoff payload
                </p>
            </div>

            <div>
                <Label htmlFor="q-validation">Validation</Label>
                <Select
                    value={data.validationType ?? 'none'}
                    onValueChange={(value) =>
                        onChange({ validationType: value as QuestionNodeData['validationType'] })
                    }
                >
                    <SelectTrigger id="q-validation" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None – accept any answer</SelectItem>
                        <SelectItem value="required">Required – must not be empty</SelectItem>
                        <SelectItem value="phone">Phone number</SelectItem>
                        <SelectItem value="email">Email address</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
