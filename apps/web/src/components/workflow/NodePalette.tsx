"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Bot, Users, GitBranch, Shield, Plug, PhoneOff,
    Play, AlertCircle, Search, Sparkles
} from 'lucide-react';
import { useState } from 'react';

interface NodeType {
    type: string;
    label: string;
    description: string;
    icon: React.ElementType;
    category: 'core' | 'ai' | 'safety' | 'integration';
    color: string;
    defaultData: any;
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
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-primary/10">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Node Palette</CardTitle>
                        <CardDescription className="text-xs">
                            Drag nodes to canvas
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search nodes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
                
                {/* Category Filters */}
                <div className="flex flex-wrap gap-1">
                    <Button
                        size="sm"
                        variant={selectedCategory === null ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory(null)}
                        className="h-7 text-xs"
                    >
                        All
                    </Button>
                    {categories.map(cat => (
                        <Button
                            key={cat.id}
                            size="sm"
                            variant={selectedCategory === cat.id ? 'default' : 'outline'}
                            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                            className="h-7 text-xs"
                        >
                            {cat.label}
                            <Badge variant="secondary" className="ml-1 text-[10px]">
                                {cat.count}
                            </Badge>
                        </Button>
                    ))}
                </div>
                
                <Separator />
                
                {/* Node List */}
                <ScrollArea className="h-[500px]">
                    <div className="space-y-2 pr-4">
                        {filteredNodes.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                                <p className="text-sm text-muted-foreground">No nodes found</p>
                            </div>
                        ) : (
                            filteredNodes.map(node => {
                                const Icon = node.icon;
                                return (
                                    <div
                                        key={node.type}
                                        className="group"
                                    >
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start h-auto p-3 hover:bg-accent"
                                            onClick={() => onAddNode(node)}
                                        >
                                            <div className="flex items-start gap-3 w-full">
                                                <div className={`p-2 rounded bg-${node.color}-100 group-hover:bg-${node.color}-200 transition-colors`}>
                                                    <Icon className={`w-4 h-4 text-${node.color}-600`} />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{node.label}</span>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {node.category}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {node.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
                
                {/* Help Text */}
                <Separator />
                <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Click a node to add it to the canvas. 
                        Connect nodes by dragging from one handle to another.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
