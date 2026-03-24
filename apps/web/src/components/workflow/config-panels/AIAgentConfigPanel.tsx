"use client";

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AIAgentNodeData } from '../nodes/AIAgentNode';
import { Bot, Calendar, Shield, Zap, MessageCircle, Sparkles } from 'lucide-react';

interface AIAgentConfigPanelProps {
    data: AIAgentNodeData;
    onChange: (data: Partial<AIAgentNodeData>) => void;
}

// Agent presets (matching those from the agents page)
const AGENT_PRESETS = [
    {
        id: 'general-triage',
        name: 'General Triage Agent',
        description: 'Default AI agent for general patient intake and triage',
        systemPrompt: 'You are a professional healthcare triage assistant at [Practice Name]. Be empathetic, clear, and thorough in your assessments. Collect necessary information and route patients appropriately.',
        enabledTools: ['scheduling', 'insurance', 'departments'],
        temperature: 0.7,
        maxTurns: 15,
    },
    {
        id: 'appointment-scheduler',
        name: 'Appointment Scheduling Agent',
        description: 'Specialized in scheduling and managing appointments',
        systemPrompt: 'You are an efficient and friendly scheduling coordinator at [Practice Name]. Help patients book, reschedule, and manage appointments with clarity and care.',
        enabledTools: ['scheduling', 'departments'],
        temperature: 0.5,
        maxTurns: 10,
    },
    {
        id: 'insurance-verification',
        name: 'Insurance Verification Agent',
        description: 'Handles insurance verification and eligibility checks',
        systemPrompt: 'You are a knowledgeable insurance specialist at [Practice Name]. Verify coverage and explain benefits clearly to patients.',
        enabledTools: ['insurance'],
        temperature: 0.4,
        maxTurns: 8,
    },
    {
        id: 'prescription-refill',
        name: 'Prescription Refill Agent',
        description: 'Manages prescription refill requests',
        systemPrompt: 'You are a careful and detail-oriented pharmacy liaison at [Practice Name]. Safely process refill requests and coordinate with pharmacies.',
        enabledTools: ['prescriptions'],
        temperature: 0.3,
        maxTurns: 8,
    },
    {
        id: 'slack-bot',
        name: 'Slack Bot Agent',
        description: 'Integrates with Slack for team notifications',
        systemPrompt: 'You are a concise and action-oriented team assistant. Send clear, brief updates to the care team via Slack.',
        enabledTools: [],
        temperature: 0.5,
        maxTurns: 5,
    },
    {
        id: 'custom',
        name: 'Custom Agent',
        description: 'Create a custom agent with your own settings',
        systemPrompt: '',
        enabledTools: [],
        temperature: 0.7,
        maxTurns: 15,
    },
];

const AVAILABLE_TOOLS = [
    { id: 'scheduling', name: 'Appointment Scheduling', description: 'Book, cancel, reschedule appointments' },
    { id: 'insurance', name: 'Insurance Verification', description: 'Check plan acceptance and eligibility' },
    { id: 'departments', name: 'Department Lookup', description: 'Find department info and hours' },
    { id: 'prescriptions', name: 'Prescription Refills', description: 'Handle medication refill requests' },
    { id: 'billing', name: 'Billing Inquiries', description: 'Answer billing questions' },
];

export function AIAgentConfigPanel({ data, onChange }: AIAgentConfigPanelProps) {
    const [selectedPreset, setSelectedPreset] = useState(data.agentPresetId || 'general-triage');
    const enabledTools = data.enabledTools || [];
    
    const handlePresetChange = (presetId: string) => {
        setSelectedPreset(presetId);
        const preset = AGENT_PRESETS.find(p => p.id === presetId);
        
        if (preset) {
            onChange({
                agentPresetId: presetId,
                systemPrompt: preset.systemPrompt,
                enabledTools: preset.enabledTools,
                temperature: preset.temperature,
                maxTurns: preset.maxTurns,
            });
        }
    };
    
    const toggleTool = (toolId: string) => {
        const newTools = enabledTools.includes(toolId)
            ? enabledTools.filter(t => t !== toolId)
            : [...enabledTools, toolId];
        onChange({ enabledTools: newTools });
    };
    
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-purple-100">
                    <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                    <h3 className="font-semibold">AI Agent Configuration</h3>
                    <p className="text-xs text-muted-foreground">Select an agent preset or configure custom settings</p>
                </div>
            </div>

            {/* Agent Preset Selection */}
            <div>
                <Label htmlFor="agent-preset">Agent Preset</Label>
                <Select
                    value={selectedPreset}
                    onValueChange={handlePresetChange}
                >
                    <SelectTrigger id="agent-preset" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {AGENT_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                                <div className="flex flex-col items-start">
                                    <span className="font-medium">{preset.name}</span>
                                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                    Choose a pre-configured agent or create a custom one
                </p>
            </div>

            {/* Label */}
            <div>
                <Label htmlFor="ai-label">Node Label</Label>
                <Input
                    id="ai-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="e.g., Main AI Agent"
                    className="mt-1"
                />
            </div>

            {/* System Prompt */}
            <div>
                <Label htmlFor="ai-prompt">System Prompt</Label>
                <Textarea
                    id="ai-prompt"
                    value={data.systemPrompt || ''}
                    onChange={(e) => onChange({ systemPrompt: e.target.value })}
                    placeholder="You are a helpful medical receptionist for [Practice Name]..."
                    className="mt-1 min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Define the AI's personality, role, and behavior guidelines
                </p>
            </div>

            {/* Enabled Tools */}
            <div>
                <Label>Enabled Tools</Label>
                <p className="text-xs text-muted-foreground mb-2">
                    Select which tools the AI can use during conversation
                </p>
                <div className="space-y-2">
                    {AVAILABLE_TOOLS.map(tool => (
                        <div key={tool.id} className="flex items-start gap-2 p-2 rounded border hover:bg-accent">
                            <Checkbox
                                id={`tool-${tool.id}`}
                                checked={enabledTools.includes(tool.id)}
                                onCheckedChange={() => toggleTool(tool.id)}
                            />
                            <div className="flex-1">
                                <label
                                    htmlFor={`tool-${tool.id}`}
                                    className="text-sm font-medium cursor-pointer"
                                >
                                    {tool.name}
                                </label>
                                <p className="text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Max Turns */}
            <div>
                <Label htmlFor="ai-max-turns">Maximum Conversation Turns</Label>
                <Input
                    id="ai-max-turns"
                    type="number"
                    value={data.maxTurns || 15}
                    onChange={(e) => onChange({ maxTurns: parseInt(e.target.value) || 15 })}
                    min={1}
                    max={50}
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Maximum back-and-forth exchanges before escalation (default: 15)
                </p>
            </div>

            {/* Context Strategy */}
            <div>
                <Label htmlFor="ai-context">Context Strategy</Label>
                <Select
                    value={data.contextStrategy || 'append'}
                    onValueChange={(value: any) => onChange({ contextStrategy: value })}
                >
                    <SelectTrigger id="ai-context" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="append">
                            <div className="flex flex-col items-start">
                                <span className="font-medium">Append (Recommended)</span>
                                <span className="text-xs text-muted-foreground">Keep full conversation history</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="reset_with_summary">
                            <div className="flex flex-col items-start">
                                <span className="font-medium">Reset with Summary</span>
                                <span className="text-xs text-muted-foreground">Summarize then start fresh</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="reset">
                            <div className="flex flex-col items-start">
                                <span className="font-medium">Reset</span>
                                <span className="text-xs text-muted-foreground">Complete fresh start</span>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Temperature */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label>Temperature: {(data.temperature || 0.7).toFixed(1)}</Label>
                    <Badge variant="outline" className="text-xs">
                        {data.temperature && data.temperature < 0.3 ? 'Precise' : 
                         data.temperature && data.temperature > 0.8 ? 'Creative' : 'Balanced'}
                    </Badge>
                </div>
                <Slider
                    value={[data.temperature || 0.7]}
                    onValueChange={(value) => onChange({ temperature: value[0] })}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Focused (0)</span>
                    <span>Creative (1)</span>
                </div>
            </div>
        </div>
    );
}
