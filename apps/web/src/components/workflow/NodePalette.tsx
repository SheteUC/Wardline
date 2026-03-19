"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Bot, Users, GitBranch, Shield, Plug, PhoneOff,
    Play, AlertCircle, Search, Sparkles,
    Siren, HelpCircle, Webhook, UserCheck, ClipboardList,
    Target, Route
} from 'lucide-react';
import { useState } from 'react';

// Static color maps — Tailwind cannot resolve dynamic class names like `bg-${color}-100`
const iconBgMap: Record<string, string> = {
    blue: 'bg-blue-100',
    gray: 'bg-gray-100',
    purple: 'bg-purple-100',
    amber: 'bg-amber-100',
    orange: 'bg-orange-100',
    teal: 'bg-teal-100',
    red: 'bg-red-100',
    green: 'bg-green-100',
    indigo: 'bg-indigo-100',
    cyan: 'bg-cyan-100',
};
const iconBgHoverMap: Record<string, string> = {
    blue: 'group-hover:bg-blue-200',
    gray: 'group-hover:bg-gray-200',
    purple: 'group-hover:bg-purple-200',
    amber: 'group-hover:bg-amber-200',
    orange: 'group-hover:bg-orange-200',
    teal: 'group-hover:bg-teal-200',
    red: 'group-hover:bg-red-200',
    green: 'group-hover:bg-green-200',
    indigo: 'group-hover:bg-indigo-200',
    cyan: 'group-hover:bg-cyan-200',
};
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
        description: 'Call external API',
        icon: Plug,
        category: 'integration',
        color: 'teal',
        defaultData: {
            label: 'API Integration',
            integrationType: 'external_api',
            method: 'GET',
            endpointUrl: '',
            retryCount: 3,
            timeoutSeconds: 10,
            errorHandling: 'continue'
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
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-primary/10 shrink-0">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="text-base">Node Palette</CardTitle>
                        <CardDescription className="text-xs">
                            Drag nodes to canvas
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Search */}
                <div className="relative shrink-0">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search nodes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                    />
                </div>
                
                {/* Category Filters */}
                <div className="flex flex-col gap-1 shrink-0">
                    <Button
                        size="sm"
                        variant={selectedCategory === null ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory(null)}
                        className="h-7 text-xs justify-start"
                    >
                        All ({NODE_TYPES.length})
                    </Button>
                    {categories.map(cat => (
                        <Button
                            key={cat.id}
                            size="sm"
                            variant={selectedCategory === cat.id ? 'default' : 'outline'}
                            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                            className="h-7 text-xs justify-between"
                        >
                            <span>{cat.label}</span>
                            <Badge variant="secondary" className="text-[10px] h-4">
                                {cat.count}
                            </Badge>
                        </Button>
                    ))}
                </div>
                
                <Separator className="shrink-0" />
                
                {/* Node List */}
                <ScrollArea className="flex-1 min-h-0 -mx-4 px-4">
                    <div className="space-y-2 pr-3">
                        {filteredNodes.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                                <p className="text-sm text-muted-foreground">No nodes found</p>
                            </div>
                        ) : (
                            filteredNodes.map(node => {
                                const Icon = node.icon;
                                const bg = iconBgMap[node.color] || 'bg-gray-100';
                                const bgHover = iconBgHoverMap[node.color] || '';
                                const text = iconTextMap[node.color] || 'text-gray-600';
                                return (
                                    <button
                                        key={node.type}
                                        type="button"
                                        className="group w-full flex items-start gap-2.5 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-accent"
                                        onClick={() => onAddNode(node)}
                                    >
                                        <div className={`p-1.5 rounded shrink-0 ${bg} ${bgHover} transition-colors`}>
                                            <Icon className={`w-4 h-4 ${text}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">{node.label}</div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {node.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
                
                {/* Help Text */}
                <div className="bg-muted/50 rounded-lg p-2.5 shrink-0">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        <strong>Tip:</strong> Click a node to add it to the canvas. 
                        Connect nodes by dragging from one handle to another.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
