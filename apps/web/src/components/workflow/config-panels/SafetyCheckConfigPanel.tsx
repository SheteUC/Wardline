"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { SafetyCheckNodeData } from '../nodes/SafetyCheckNode';
import { Shield, AlertTriangle } from 'lucide-react';

interface SafetyCheckConfigPanelProps {
    data: SafetyCheckNodeData;
    onChange: (data: Partial<SafetyCheckNodeData>) => void;
}

const KEYWORD_CATEGORIES = [
    {
        id: 'emergency',
        name: 'Emergency',
        description: 'Life-threatening symptoms (chest pain, difficulty breathing, etc.)',
        severity: 'critical',
        keywords: 'chest pain, can\'t breathe, stroke, heart attack, unconscious'
    },
    {
        id: 'mental_health',
        name: 'Mental Health Crisis',
        description: 'Suicidal ideation, self-harm mentions',
        severity: 'critical',
        keywords: 'suicide, want to die, kill myself, self harm'
    },
    {
        id: 'clinical_urgent',
        name: 'Clinical Urgent',
        description: 'Severe symptoms requiring prompt attention',
        severity: 'high',
        keywords: 'severe pain, high fever, bleeding, vomiting blood'
    },
    {
        id: 'clinical_routine',
        name: 'Clinical Routine',
        description: 'General medical topics',
        severity: 'medium',
        keywords: 'medication, symptoms, diagnosis, treatment'
    },
    {
        id: 'administrative',
        name: 'Administrative',
        description: 'Non-clinical matters',
        severity: 'low',
        keywords: 'appointment, billing, insurance, records'
    },
];

export function SafetyCheckConfigPanel({ data, onChange }: SafetyCheckConfigPanelProps) {
    const categories = data.keywordCategories || [];
    
    const toggleCategory = (categoryId: string) => {
        const newCategories = categories.includes(categoryId)
            ? categories.filter(c => c !== categoryId)
            : [...categories, categoryId];
        onChange({ keywordCategories: newCategories });
    };
    
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-orange-100">
                    <Shield className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Safety Check Configuration</h3>
                    <p className="text-xs text-muted-foreground">Configure medical keyword monitoring</p>
                </div>
            </div>

            {/* Label */}
            <div>
                <Label htmlFor="safety-label">Node Label</Label>
                <Input
                    id="safety-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="e.g., Emergency Keywords Check"
                    className="mt-1"
                />
            </div>

            {/* Keyword Categories */}
            <div>
                <Label>Keyword Categories to Monitor</Label>
                <p className="text-xs text-muted-foreground mb-2">
                    Select which categories of keywords to check for
                </p>
                <div className="space-y-2">
                    {KEYWORD_CATEGORIES.map(category => (
                        <div 
                            key={category.id} 
                            className={`p-3 rounded-lg border-2 ${
                                categories.includes(category.id) 
                                    ? 'border-orange-300 bg-orange-50' 
                                    : 'border-gray-200'
                            }`}
                        >
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id={`cat-${category.id}`}
                                    checked={categories.includes(category.id)}
                                    onCheckedChange={() => toggleCategory(category.id)}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <label 
                                            htmlFor={`cat-${category.id}`}
                                            className="text-sm font-medium cursor-pointer"
                                        >
                                            {category.name}
                                        </label>
                                        <Badge 
                                            variant={
                                                category.severity === 'critical' ? 'destructive' :
                                                category.severity === 'high' ? 'default' :
                                                'outline'
                                            }
                                            className="text-[10px]"
                                        >
                                            {category.severity}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {category.description}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-1 font-mono opacity-70">
                                        {category.keywords}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Auto-Escalate */}
            <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Checkbox
                    id="auto-escalate"
                    checked={data.autoEscalate !== false}
                    onCheckedChange={(checked) => onChange({ autoEscalate: !!checked })}
                />
                <div>
                    <label htmlFor="auto-escalate" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-orange-600" />
                        Auto-Escalate on Detection
                    </label>
                    <p className="text-xs text-muted-foreground">
                        Automatically escalate to human when keywords detected
                    </p>
                </div>
            </div>

            {/* Alert Severity */}
            <div>
                <Label htmlFor="alert-severity">Alert Severity</Label>
                <Select
                    value={data.alertSeverity || 'high'}
                    onValueChange={(value: any) => onChange({ alertSeverity: value })}
                >
                    <SelectTrigger id="alert-severity" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="low">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">Low</Badge>
                                <span>Log only</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="medium">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Medium</Badge>
                                <span>Flag for review</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="high">
                            <div className="flex items-center gap-2">
                                <Badge variant="default">High</Badge>
                                <span>Alert supervisor</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="critical">
                            <div className="flex items-center gap-2">
                                <Badge variant="destructive">Critical</Badge>
                                <span>Immediate escalation</span>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Confirmation Required */}
            <div>
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Checkbox
                        id="confirmation-required"
                        checked={data.confirmationRequired || false}
                        onCheckedChange={(checked) => onChange({ confirmationRequired: !!checked })}
                    />
                    <div className="flex-1">
                        <label htmlFor="confirmation-required" className="text-sm font-medium cursor-pointer">
                            Require Explicit Confirmation
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Ask user to confirm this is not an emergency before continuing
                        </p>
                    </div>
                </div>
                
                {data.confirmationRequired && (
                    <Textarea
                        value={data.confirmationPrompt || ''}
                        onChange={(e) => onChange({ confirmationPrompt: e.target.value })}
                        placeholder="Please confirm this is not a medical emergency. Do you need immediate assistance?"
                        className="mt-2 text-sm"
                        rows={2}
                    />
                )}
            </div>

            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                    <div>
                        <p className="text-xs font-medium text-red-900">Safety & Compliance</p>
                        <p className="text-xs text-red-700 mt-1">
                            Safety checks are critical for HIPAA compliance and patient safety. 
                            Emergency keywords <strong>must</strong> always escalate to trained medical staff.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
