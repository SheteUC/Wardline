"use client";

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    Bot, Users, GitBranch, Shield, Plug, PhoneOff,
    Play, AlertCircle, Search, Sparkles,
    Siren, HelpCircle, Webhook, UserCheck, ClipboardList,
    Target, Route
} from 'lucide-react';
import { useState } from 'react';

const iconTextMap: Record<string, string> = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
    orange: 'text-orange-600',
    teal: 'text-teal-600',
    red: 'text-red-600',
    green: 'text-green-600',
    indigo: 'text-indigo-600',
    cyan: 'text-cyan-600',
};

interface NodeType {
    type: string;
    label: string;
    description: string;
    icon: React.ElementType;
    category: 'core' | 'ai' | 'safety' | 'integration';
    color: string;
    defaultData: Record<string, unknown>;
}

const NODE_TYPES: NodeType[] = [
    // Core nodes
    {
        type: 'start',
        label: 'Start',
        description: 'Entry point for the workflow',
        icon: Play,
        category: 'core',
        color: 'blue',
        defaultData: {
            label: 'Start Call',
            greetingMessage: 'Thank you for calling. How can I help you today?'
        }
    },
    {
        type: 'end',
        label: 'End',
        description: 'Terminate the call',
        icon: PhoneOff,
        category: 'core',
        color: 'gray',
        defaultData: {
            label: 'Call Complete',
            endType: 'hangup',
            closingMessage: 'Thank you for calling. Have a great day!'
        }
    },
    
    // AI nodes
    {
        type: 'ai-agent',
        label: 'AI Agent',
        description: 'AI-powered conversation with tools',
        icon: Bot,
        category: 'ai',
        color: 'purple',
        defaultData: {
            label: 'AI Receptionist',
            systemPrompt: 'You are a helpful medical receptionist. Be professional, empathetic, and efficient.',
            enabledTools: ['scheduling', 'departments'],
            maxTurns: 15,
            contextStrategy: 'append',
            temperature: 0.7
        }
    },
    {
        type: 'conditional',
        label: 'Conditional',
        description: 'Route based on conditions',
        icon: GitBranch,
        category: 'ai',
        color: 'amber',
        defaultData: {
            label: 'Check Condition',
            conditionType: 'intent',
            conditions: [],
            defaultTarget: ''
        }
    },
    
    // Safety nodes
    {
        type: 'safety-check',
        label: 'Safety Check',
        description: 'Monitor for medical keywords',
        icon: Shield,
        category: 'safety',
        color: 'orange',
        defaultData: {
            label: 'Safety Screening',
            keywordCategories: ['emergency', 'mental_health'],
            autoEscalate: true,
            alertSeverity: 'high'
        }
    },
    {
        type: 'human-agent-queue',
        label: 'Human Queue',
        description: 'Escalate to human agent',
        icon: Users,
        category: 'safety',
        color: 'blue',
        defaultData: {
            label: 'Escalate to Human',
            queueId: 'general',
            priorityLevel: 0,
            timeoutSeconds: 300,
            requiredSkills: []
        }
    },
    
    // Integration nodes
    {
        type: 'integration',
        label: 'Integration',
        description: 'Run a live runtime action or create a follow-up',
        icon: Plug,
        category: 'integration',
        color: 'teal',
        defaultData: {
            label: 'Runtime Action',
            runtimeAction: 'appointment-request',
            integrationCategory: 'SCHEDULING',
            requiresConfirmation: true,
            fallbackBehavior: 'create_follow_up',
            prompt: 'Capture the caller request, confirm it, then send it through the configured integration.'
        }
    },
    {
        type: 'webhook',
        label: 'Webhook',
        description: 'Call an external HTTP endpoint',
        icon: Webhook,
        category: 'integration',
        color: 'indigo',
        defaultData: {
            label: 'Webhook Call',
            method: 'POST',
            url: '',
            bodyTemplate: '{\n  "callId": "{{call_id}}"\n}',
        }
    },

    // Additional core nodes
    {
        type: 'question',
        label: 'Question',
        description: 'Ask a single question and store the answer',
        icon: HelpCircle,
        category: 'core',
        color: 'green',
        defaultData: {
            label: 'Ask Question',
            questionText: '',
            fieldName: '',
            validationType: 'none',
        }
    },
    {
        type: 'collect-info',
        label: 'Collect Info',
        description: 'Gather multiple fields from the caller',
        icon: ClipboardList,
        category: 'core',
        color: 'cyan',
        defaultData: {
            label: 'Collect Information',
            fields: [],
        }
    },

    // Intent & routing nodes
    {
        type: 'intent-detect',
        label: 'Intent Detect',
        description: 'Detect caller intent from the conversation',
        icon: Target,
        category: 'ai',
        color: 'indigo',
        defaultData: {
            label: 'Detect Intent',
            intents: [],
            confidenceThreshold: 0.7,
        }
    },
    {
        type: 'route',
        label: 'Route',
        description: 'Route call based on field conditions',
        icon: Route,
        category: 'core',
        color: 'amber',
        defaultData: {
            label: 'Route Call',
            routingRules: [],
            fallbackTarget: '',
        }
    },

    // Additional safety nodes
    {
        type: 'emergency-screen',
        label: 'Emergency Screen',
        description: 'Detect emergency keywords and escalate immediately',
        icon: Siren,
        category: 'safety',
        color: 'red',
        defaultData: {
            label: 'Emergency Screening',
            keywords: [
                'chest pain', "can't breathe", 'stroke', 'heart attack',
                'unconscious', 'overdose', 'suicide', 'severe bleeding',
            ],
            autoEscalate: true,
        }
    },
    {
        type: 'human-agent-direct',
        label: 'Direct to Agent',
        description: 'Route the call to a specific human agent',
        icon: UserCheck,
        category: 'safety',
        color: 'blue',
        defaultData: {
            label: 'Transfer to Agent',
            agentId: '',
            agentName: '',
            fallbackQueueId: '',
        }
    },
];

interface NodePaletteProps {
    onAddNode: (nodeType: NodeType) => void;
}

/** Figma-style groups (1:2 Workflow Builder) */
const NODE_SECTIONS: { id: string; label: string; types: Set<string> }[] = [
    {
        id: 'trigger',
        label: 'Trigger nodes',
        types: new Set(['start', 'end', 'question', 'collect-info']),
    },
    {
        id: 'ai',
        label: 'AI & logic',
        types: new Set(['ai-agent', 'conditional', 'intent-detect', 'route']),
    },
    {
        id: 'actions',
        label: 'Safety & actions',
        types: new Set([
            'safety-check',
            'human-agent-queue',
            'human-agent-direct',
            'emergency-screen',
            'integration',
            'webhook',
        ]),
    },
];

export function NodePalette({ onAddNode }: NodePaletteProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    
    const filteredNodes = NODE_TYPES.filter(node => {
        const matchesSearch = node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             node.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || node.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    
    const categories = [
        { id: 'core', label: 'Core', count: NODE_TYPES.filter(n => n.category === 'core').length },
        { id: 'ai', label: 'AI', count: NODE_TYPES.filter(n => n.category === 'ai').length },
        { id: 'safety', label: 'Safety', count: NODE_TYPES.filter(n => n.category === 'safety').length },
        { id: 'integration', label: 'Integration', count: NODE_TYPES.filter(n => n.category === 'integration').length },
    ];
    
    return (
        <div className="flex h-full flex-col gap-3 rounded-3xl bg-[var(--background)] p-4 neo-raised">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                    <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground">Node palette</h3>
                    <p className="text-xs text-muted-foreground">Add blocks to your flow</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search nodes…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 rounded-2xl pl-9"
                />
            </div>

            {/* Category filters — raised active / inset idle */}
            <div className="flex shrink-0 flex-col gap-1.5">
                <Button
                    size="sm"
                    variant={selectedCategory === null ? 'default' : 'ghost'}
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                        'h-9 justify-between rounded-xl text-xs',
                        selectedCategory === null ? 'neo-raised' : 'neo-inset shadow-none',
                    )}
                >
                    <span>All</span>
                    <Badge variant="secondary" className="h-5 text-[10px]">
                        {NODE_TYPES.length}
                    </Badge>
                </Button>
                {categories.map((cat) => (
                    <Button
                        key={cat.id}
                        size="sm"
                        variant={selectedCategory === cat.id ? 'default' : 'ghost'}
                        onClick={() =>
                            setSelectedCategory(cat.id === selectedCategory ? null : cat.id)
                        }
                        className={cn(
                            'h-9 justify-between rounded-xl text-xs',
                            selectedCategory === cat.id ? 'neo-raised' : 'neo-inset shadow-none',
                        )}
                    >
                        <span>{cat.label}</span>
                        <Badge variant="secondary" className="h-5 text-[10px]">
                            {cat.count}
                        </Badge>
                    </Button>
                ))}
            </div>

            {/* Grouped node list */}
            <ScrollArea className="min-h-0 flex-1 pr-2">
                <div className="space-y-5 pb-1">
                    {filteredNodes.length === 0 ? (
                        <div className="py-10 text-center">
                            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No nodes match</p>
                        </div>
                    ) : (
                        NODE_SECTIONS.map((section) => {
                            const inSection = filteredNodes.filter((n) =>
                                section.types.has(n.type),
                            );
                            if (inSection.length === 0) return null;
                            return (
                                <div key={section.id}>
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                        {section.label}
                                    </p>
                                    <div className="space-y-2">
                                        {inSection.map((node) => {
                                            const Icon = node.icon;
                                            const text = iconTextMap[node.color] || 'text-muted-foreground';
                                            return (
                                                <button
                                                    key={node.type}
                                                    type="button"
                                                    className="group flex w-full items-start gap-2.5 rounded-2xl bg-[var(--background)] p-2.5 text-left transition-all neo-raised-sm hover:neo-raised active:neo-pressed"
                                                    onClick={() => onAddNode(node)}
                                                >
                                                    <div
                                                        className={cn(
                                                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--background)] neo-inset',
                                                        )}
                                                    >
                                                        <Icon className={cn('h-4 w-4', text)} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium text-foreground">
                                                            {node.label}
                                                        </div>
                                                        <p className="line-clamp-2 text-xs text-muted-foreground">
                                                            {node.description}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>

            <div className="shrink-0 rounded-2xl bg-[var(--background)] p-3 text-xs leading-relaxed text-muted-foreground neo-inset">
                <strong className="text-foreground">Tip:</strong> Click to place a node. Drag
                from a handle to connect steps.
            </div>
        </div>
    );
}
