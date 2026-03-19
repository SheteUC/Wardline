"use client";

import { useCallback, useState, useMemo, useEffect } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    MiniMap,
    Panel,
    type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Save, Play, CheckCircle, AlertTriangle, ArrowLeft, 
    Loader2, Download, Upload, Settings, Trash2, Rocket
} from 'lucide-react';
import Link from 'next/link';

// Import custom nodes
import StartNode from './nodes/StartNode';
import AIAgentNode from './nodes/AIAgentNode';
import HumanQueueNode from './nodes/HumanQueueNode';
import ConditionalNode from './nodes/ConditionalNode';
import SafetyCheckNode from './nodes/SafetyCheckNode';
import IntegrationNode from './nodes/IntegrationNode';
import EndNode from './nodes/EndNode';
import EmergencyScreenNode from './nodes/EmergencyScreenNode';
import QuestionNode from './nodes/QuestionNode';
import WebhookNode from './nodes/WebhookNode';
import HumanDirectNode from './nodes/HumanDirectNode';
import CollectInfoNode from './nodes/CollectInfoNode';
// Legacy node types (for backward compatibility)
import VoicePromptNode from './nodes/VoicePromptNode';
import IntentDetectNode from './nodes/IntentDetectNode';
import RouteNode from './nodes/RouteNode';

// Import config panels
import { StartNodeConfigPanel } from './config-panels/StartNodeConfigPanel';
import { AIAgentConfigPanel } from './config-panels/AIAgentConfigPanel';
import { HumanQueueConfigPanel } from './config-panels/HumanQueueConfigPanel';
import { ConditionalConfigPanel } from './config-panels/ConditionalConfigPanel';
import { SafetyCheckConfigPanel } from './config-panels/SafetyCheckConfigPanel';
import { IntegrationConfigPanel } from './config-panels/IntegrationConfigPanel';
import { EndNodeConfigPanel } from './config-panels/EndNodeConfigPanel';
import { EmergencyScreenConfigPanel } from './config-panels/EmergencyScreenConfigPanel';
import { QuestionConfigPanel } from './config-panels/QuestionConfigPanel';
import { WebhookConfigPanel } from './config-panels/WebhookConfigPanel';
import { HumanDirectConfigPanel } from './config-panels/HumanDirectConfigPanel';
import { CollectInfoConfigPanel } from './config-panels/CollectInfoConfigPanel';
import { IntentDetectConfigPanel } from './config-panels/IntentDetectConfigPanel';
import { RouteConfigPanel } from './config-panels/RouteConfigPanel';

// Import node palette
import { NodePalette } from './NodePalette';

// Import workflow settings panel
import { WorkflowSettingsPanel } from './WorkflowSettingsPanel';

// Define nodeTypes and edgeOptions outside the component for stable references.
// @xyflow/react v12 is compatible with React 19 and handles this correctly.
const nodeTypes: NodeTypes = {
    'start': StartNode,
    'ai-agent': AIAgentNode,
    'human-agent-queue': HumanQueueNode,
    'conditional': ConditionalNode,
    'safety-check': SafetyCheckNode,
    'integration': IntegrationNode,
    'end': EndNode,
    // New node types
    'emergency-screen': EmergencyScreenNode,
    'question': QuestionNode,
    'webhook': WebhookNode,
    'human-agent-direct': HumanDirectNode,
    'collect-info': CollectInfoNode,
    // Legacy node types (for backward compatibility with old workflow data)
    'voice-prompt': VoicePromptNode,
    'intent-detect': IntentDetectNode,
    'route': RouteNode,
};

const defaultEdgeOptions = {
    animated: false,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
};

const getNodeColor = (node: Node) => {
    const map: Record<string, string> = {
        'start': '#3b82f6',
        'ai-agent': '#a855f7',
        'human-agent-queue': '#3b82f6',
        'conditional': '#f59e0b',
        'safety-check': '#f97316',
        'integration': '#14b8a6',
        'end': '#64748b',
        // New node types
        'emergency-screen': '#ef4444',
        'question': '#22c55e',
        'webhook': '#6366f1',
        'human-agent-direct': '#3b82f6',
        'collect-info': '#06b6d4',
        // Legacy node types
        'voice-prompt': '#10b981',
        'intent-detect': '#6366f1',
        'route': '#eab308',
    };
    return map[node.type || ''] || '#cbd5e1';
};

interface EnhancedWorkflowEditorProps {
    workflowId?: string;
    workflowName?: string;
    initialNodes?: Node[];
    initialEdges?: Edge[];
    onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export function EnhancedWorkflowEditor({
    workflowId,
    workflowName = 'Untitled Workflow',
    initialNodes = [],
    initialEdges = [],
    onSave,
}: EnhancedWorkflowEditorProps) {
    // Ensure all nodes have required properties
    const sanitizedNodes = useMemo(() => 
        initialNodes.map((node, index) => ({
            ...node,
            position: node.position || { x: 100 + index * 50, y: 100 + index * 50 },
            data: node.data || {},
        })),
        [initialNodes]
    );
    
    const [nodes, setNodes, onNodesChange] = useNodesState(sanitizedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [showSettings, setShowSettings] = useState(false);
    
    // Update nodes when initialNodes changes (for when workflow is loaded)
    useEffect(() => {
        if (sanitizedNodes.length > 0 && nodes.length === 0) {
            setNodes(sanitizedNodes);
        }
    }, [sanitizedNodes, nodes.length, setNodes]);
    
    // Update edges when initialEdges changes
    useEffect(() => {
        if (initialEdges.length > 0 && edges.length === 0) {
            setEdges(initialEdges);
        }
    }, [initialEdges, edges.length, setEdges]);
    
    const onConnect = useCallback(
        (params: Connection) => {
            setEdges((eds) => addEdge({
                ...params,
                animated: params.source === 'start',
                type: 'default',
            }, eds));
            setHasChanges(true);
        },
        [setEdges]
    );
    
    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);
    
    const updateNodeData = useCallback((nodeId: string, updates: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: { ...node.data, ...updates }
                    };
                }
                return node;
            })
        );
        setHasChanges(true);
        
        // Update selected node if it's the one being edited
        if (selectedNode?.id === nodeId) {
            setSelectedNode(prev => prev ? {
                ...prev,
                data: { ...prev.data, ...updates }
            } : null);
        }
    }, [setNodes, selectedNode]);
    
    const deleteSelectedNode = useCallback(() => {
        if (!selectedNode) return;
        // Remove the node
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        // Remove any connected edges
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
        setHasChanges(true);
    }, [selectedNode, setNodes, setEdges]);
    
    // Keyboard shortcut: Delete / Backspace to remove selected node
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
                // Don't delete if user is typing in an input/textarea
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                e.preventDefault();
                deleteSelectedNode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, deleteSelectedNode]);
    
    const addNodeToCanvas = useCallback((nodeType: any) => {
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type: nodeType.type,
            position: { x: 250, y: 100 + nodes.length * 20 },
            data: { ...nodeType.defaultData, label: nodeType.defaultData?.label || nodeType.label },
        };
        
        setNodes((nds) => [...nds, newNode]);
        setHasChanges(true);
        setSelectedNode(newNode);
    }, [nodes, setNodes]);
    
    const handleSave = useCallback(async () => {
        if (onSave) {
            await onSave(nodes, edges);
            setHasChanges(false);
        }
    }, [nodes, edges, onSave]);
    
    const handleValidate = useCallback(async () => {
        setIsValidating(true);
        
        try {
            // Call validation API
            const response = await fetch(`/api/workflows/${workflowId}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes: nodes.map(n => ({
                        id: n.id,
                        type: n.type,
                        config: n.data,
                        position: n.position,
                    })),
                    edges: edges.map(e => ({
                        id: e.id,
                        fromNodeId: e.source,
                        toNodeId: e.target,
                        condition: e.label,
                    })),
                }),
            });
            
            const result = await response.json();
            setValidationResult(result);
        } catch (error) {
            console.error('Validation error:', error);
        } finally {
            setIsValidating(false);
        }
    }, [workflowId, nodes, edges]);
    
    const exportWorkflow = useCallback(() => {
        const workflow = {
            id: workflowId,
            name: workflowName,
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.type,
                config: n.data,
                position: n.position,
            })),
            edges: edges.map(e => ({
                id: e.id,
                fromNodeId: e.source,
                toNodeId: e.target,
                condition: e.label,
            })),
        };
        
        const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflowName.replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [workflowId, workflowName, nodes, edges]);
    
    return (
        <div className="flex flex-col h-[calc(100vh-12rem)]">
            {/* Minimal Top Bar */}
            <div className="flex items-center justify-end gap-2 pb-3 mb-3">
                {hasChanges && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mr-auto">
                        Unsaved Changes
                    </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handleValidate} disabled={isValidating}>
                    {isValidating ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                    )}
                    Validate
                </Button>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/40 disabled:text-white/60"
                >
                    <Rocket className="h-4 w-4 mr-1.5" />
                    Deploy
                </Button>
            </div>
            
            {/* Validation Results */}
            {validationResult && (
                <div className={`mb-4 rounded-lg border p-3 ${validationResult.valid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                    <div className="flex items-start gap-2">
                        {validationResult.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                                {validationResult.valid ? 'Workflow is valid' : 'Validation failed'}
                            </p>
                            {validationResult.errors && validationResult.errors.length > 0 && (
                                <ul className="text-xs mt-1 space-y-0.5">
                                    {validationResult.errors.map((error: any, i: number) => (
                                        <li key={i} className="text-red-700">• {error.message}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Main Editor Layout */}
            <div className="flex gap-4 flex-1 min-h-0">
                {/* Node Palette - Left Sidebar */}
                <div className="w-56 shrink-0">
                    <NodePalette onAddNode={addNodeToCanvas} />
                </div>
                
                {/* Flow Canvas - Center */}
                <div className="flex-1 min-w-0">
                    <Card className="h-full">
                        <CardContent className="p-0 h-full">
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onNodeClick={onNodeClick}
                                nodeTypes={nodeTypes}
                                fitView
                                minZoom={0.2}
                                maxZoom={2}
                                defaultEdgeOptions={defaultEdgeOptions}
                            >
                                <Controls position="bottom-left" />
                                <MiniMap
                                    nodeStrokeColor="#e2e8f0"
                                    nodeColor={getNodeColor}
                                    className="!bg-background border rounded-lg"
                                    position="bottom-right"
                                />
                                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                                <Panel position="top-right" className="bg-background/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg border">
                                    <div className="text-xs space-y-1">
                                        <div className="font-semibold text-foreground">Workflow Info</div>
                                        <div className="text-muted-foreground">
                                            {nodes.length} nodes • {edges.length} edges
                                        </div>
                                        {validationResult?.valid && (
                                            <div className="flex items-center gap-1 text-green-600">
                                                <CheckCircle className="w-3 h-3" />
                                                <span>Validated</span>
                                            </div>
                                        )}
                                    </div>
                                </Panel>
                            </ReactFlow>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Configuration Panel - Right Sidebar */}
                <div className="w-80 shrink-0">
                    <Card className="h-full flex flex-col">
                        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
                            {selectedNode ? (
                                <>
                                    <div className="pb-3 border-b mb-3 shrink-0">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-sm">Node Configuration</h3>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {(selectedNode.data as Record<string, unknown>)?.label as string || selectedNode.type}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={deleteSelectedNode}
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                title="Delete node"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
                                        <div className="space-y-4 pb-4">
                                            {selectedNode.type === 'start' && (
                                                <StartNodeConfigPanel
                                                    data={{ label: 'Start', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'ai-agent' && (
                                                <AIAgentConfigPanel
                                                    data={{ label: 'AI Agent', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'human-agent-queue' && (
                                                <HumanQueueConfigPanel
                                                    data={{ label: 'Human Queue', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'conditional' && (
                                                <ConditionalConfigPanel
                                                    data={{ label: 'Conditional', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'safety-check' && (
                                                <SafetyCheckConfigPanel
                                                    data={{ label: 'Safety Check', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'integration' && (
                                                <IntegrationConfigPanel
                                                    data={{ label: 'Integration', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'end' && (
                                                <EndNodeConfigPanel
                                                    data={{ label: 'End', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'emergency-screen' && (
                                                <EmergencyScreenConfigPanel
                                                    data={{ label: 'Emergency Screen', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'question' && (
                                                <QuestionConfigPanel
                                                    data={{ label: 'Question', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'webhook' && (
                                                <WebhookConfigPanel
                                                    data={{ label: 'Webhook', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'human-agent-direct' && (
                                                <HumanDirectConfigPanel
                                                    data={{ label: 'Direct to Agent', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'collect-info' && (
                                                <CollectInfoConfigPanel
                                                    data={{ label: 'Collect Info', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'intent-detect' && (
                                                <IntentDetectConfigPanel
                                                    data={{ label: 'Detect Intent', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'route' && (
                                                <RouteConfigPanel
                                                    data={{ label: 'Route Call', ...selectedNode.data }}
                                                    onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                                />
                                            )}
                                            {selectedNode.type === 'voice-prompt' && (
                                                <div className="text-center py-8 px-4">
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        Legacy node type
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        This is a legacy voice-prompt node. Consider using the Question or AI Agent node instead.
                                                    </p>
                                                </div>
                                            )}
                                            {!['start', 'ai-agent', 'human-agent-queue', 'conditional', 'safety-check', 'integration', 'end', 'emergency-screen', 'question', 'webhook', 'human-agent-direct', 'collect-info', 'intent-detect', 'route', 'voice-prompt'].includes(selectedNode.type || '') && (
                                                <div className="text-center py-8">
                                                    <p className="text-sm text-muted-foreground">
                                                        No configuration available for this node type
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                                            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Click on a node to configure it
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            {/* Workflow Settings Panel */}
            {showSettings && (
                <WorkflowSettingsPanel onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
}
