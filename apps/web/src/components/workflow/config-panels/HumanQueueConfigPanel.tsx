"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HumanQueueNodeData } from '../nodes/HumanQueueNode';
import { Users, Plus, X } from 'lucide-react';
import { useState } from 'react';

interface HumanQueueConfigPanelProps {
    data: HumanQueueNodeData;
    onChange: (data: Partial<HumanQueueNodeData>) => void;
}

export function HumanQueueConfigPanel({ data, onChange }: HumanQueueConfigPanelProps) {
    const [newSkill, setNewSkill] = useState('');
    const requiredSkills = data.requiredSkills || [];
    
    const addSkill = () => {
        if (newSkill.trim() && !requiredSkills.includes(newSkill.trim())) {
            onChange({ requiredSkills: [...requiredSkills, newSkill.trim()] });
            setNewSkill('');
        }
    };
    
    const removeSkill = (skill: string) => {
        onChange({ requiredSkills: requiredSkills.filter(s => s !== skill) });
    };
    
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-blue-100">
                    <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Human Queue Configuration</h3>
                    <p className="text-xs text-muted-foreground">Configure escalation to human agents</p>
                </div>
            </div>

            {/* Label */}
            <div>
                <Label htmlFor="queue-label">Node Label</Label>
                <Input
                    id="queue-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="e.g., Clinical Escalation"
                    className="mt-1"
                />
            </div>

            {/* Queue ID */}
            <div>
                <Label htmlFor="queue-id">Queue ID</Label>
                <Select
                    value={data.queueId || ''}
                    onValueChange={(value) => onChange({ queueId: value })}
                >
                    <SelectTrigger id="queue-id" className="mt-1">
                        <SelectValue placeholder="Select queue..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="clinical">Clinical / Medical</SelectItem>
                        <SelectItem value="scheduling">Scheduling</SelectItem>
                        <SelectItem value="billing">Billing / Insurance</SelectItem>
                        <SelectItem value="pharmacy">Pharmacy</SelectItem>
                        <SelectItem value="general">General Support</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                    The queue where this call will be routed
                </p>
            </div>

            {/* Priority Level */}
            <div>
                <Label htmlFor="queue-priority">Priority Level</Label>
                <Select
                    value={String(data.priorityLevel || 0)}
                    onValueChange={(value) => onChange({ priorityLevel: parseInt(value) })}
                >
                    <SelectTrigger id="queue-priority" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">Normal</Badge>
                                <span>Standard priority</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="1">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Medium</Badge>
                                <span>Elevated priority</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="2">
                            <div className="flex items-center gap-2">
                                <Badge variant="default">High</Badge>
                                <span>High priority</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="3">
                            <div className="flex items-center gap-2">
                                <Badge variant="destructive">Urgent</Badge>
                                <span>Urgent / Emergency</span>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Required Skills */}
            <div>
                <Label>Required Skills</Label>
                <p className="text-xs text-muted-foreground mb-2">
                    Skills required for agents to handle this escalation
                </p>
                
                {/* Skill Tags */}
                {requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {requiredSkills.map(skill => (
                            <Badge key={skill} variant="secondary" className="gap-1">
                                {skill}
                                <X
                                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                                    onClick={() => removeSkill(skill)}
                                />
                            </Badge>
                        ))}
                    </div>
                )}
                
                {/* Add Skill */}
                <div className="flex gap-2">
                    <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                        placeholder="e.g., Spanish, Clinical Triage..."
                        className="flex-1"
                    />
                    <Button type="button" size="sm" onClick={addSkill}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Timeout */}
            <div>
                <Label htmlFor="queue-timeout">Timeout (seconds)</Label>
                <Input
                    id="queue-timeout"
                    type="number"
                    value={data.timeoutSeconds || 300}
                    onChange={(e) => onChange({ timeoutSeconds: parseInt(e.target.value) || 300 })}
                    min={30}
                    max={1800}
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Maximum wait time before timeout action (default: 300s / 5 minutes)
                </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                    <strong>Escalation Context:</strong> When a call reaches this node, the system will:
                </p>
                <ul className="text-xs text-blue-700 mt-1 ml-4 space-y-0.5 list-disc">
                    <li>Package full conversation transcript</li>
                    <li>Include collected fields and sentiment data</li>
                    <li>Notify available agents in real-time</li>
                    <li>Bridge the call when agent accepts</li>
                </ul>
            </div>
        </div>
    );
}
