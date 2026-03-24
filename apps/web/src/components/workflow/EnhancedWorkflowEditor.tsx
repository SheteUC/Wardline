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
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Save, Play, CheckCircle, AlertTriangle,
    Loader2, Download, Upload, Settings, Trash2, Rocket, Search,
} from 'lucide-react';
import Link from 'next/link';
import { useApiClient } from '@/lib/api-client';
import { useBusiness } from '@/lib/business-context';

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
    animated: true,
    style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6 4' },
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
    const apiClient = useApiClient();
    const { businessId } = useBusiness();
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
        if (!workflowId || !businessId) {
            setValidationResult({
                valid: false,
                errors: [{ message: 'Save this workflow before running server validation.' }],
                warnings: [],
            });
            return;
        }

        setIsValidating(true);
        
        try {
            const result = await apiClient.post<{
                valid: boolean;
                errors?: Array<{ message: string }>;
                warnings?: Array<{ message: string }>;
            }>(`/businesses/${businessId}/workflows/${workflowId}/validate`, {});
            setValidationResult(result);
        } catch (error) {
            console.error('Validation error:', error);
            setValidationResult({
                valid: false,
                errors: [{ message: 'Validation request failed.' }],
                warnings: [],
            });
        } finally {
            setIsValidating(false);
        }
    }, [apiClient, businessId, workflowId]);
    
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
        <div className="flex flex-col h-[calc(100vh-10rem)] min-h-[520px]">
            {/* Workflow chrome — Silk / Figma */}
            <div className="flex flex-col gap-4 pb-4 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <h2 className="text-lg font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">
                            {workflowName}
                        </h2>
                        <span
                            className="relative max-w-[11rem] truncate whitespace-nowrap rounded-full bg-[var(--background)] px-3 py-1 text-xs font-semibold text-muted-foreground neo-inset sm:max-w-none"
                            title={workflowName}
                        >
                            {hasChanges ? 'Draft · unsaved' : 'Saved'}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <div className="relative hidden sm:block w-56 lg:w-64">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                placeholder="Search workflow nodes…"
                                className="w-full rounded-full border-0 bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground neo-inset outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                aria-label="Search workflow nodes"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={handleValidate} disabled={isValidating} className="rounded-2xl">
                            {isValidating ? (
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                                <CheckCircle className="h-4 w-4 mr-1.5" />
                            )}
                            Validate
                        </Button>
                        <Button
                            variant="filled"
                            size="sm"
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className="rounded-2xl disabled:opacity-40"
                        >
                            <Rocket className="h-4 w-4 mr-1.5" />
                            Deploy workflow
                        </Button>
                    </div>
                </div>
            </div>
            
            {/* Validation Results */}
            {validationResult && (
                <div
                    className={`mb-4 rounded-2xl p-4 neo-inset ${
                        validationResult.valid ? 'bg-emerald-500/10' : 'bg-destructive/10'
                    }`}
                >
                    <div className="flex items-start gap-2">
                        {validationResult.valid ? (
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                                {validationResult.valid ? 'Workflow is valid' : 'Validation failed'}
                            </p>
                            {validationResult.errors && validationResult.errors.length > 0 && (
                                <ul className="mt-1 space-y-0.5 text-xs text-destructive">
                                    {validationResult.errors.map((error: any, i: number) => (
                                        <li key={i}>• {error.message}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Main Editor Layout */}
            <div className="flex min-h-0 flex-1 gap-4">
                {/* Node Palette - Left Sidebar */}
                <div className="w-56 shrink-0">
                    <NodePalette onAddNode={addNodeToCanvas} />
                </div>
                
                {/* Flow Canvas - Center */}
                <div className="workflow-flow min-w-0 flex-1">
                    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--background)] neo-raised">
                        <div className="relative h-full min-h-[400px]">
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
                                <Controls position="bottom-left" className="!m-3 !shadow-none" />
                                <MiniMap
                                    nodeStrokeColor="rgba(99,102,241,0.35)"
                                    nodeColor={getNodeColor}
                                    maskColor="rgba(232,234,240,0.85)"
                                    className="!m-3 !overflow-hidden !rounded-2xl !border-0 !bg-[var(--background)] neo-raised"
                                    position="bottom-right"
                                />
                                <Background
                                    variant={BackgroundVariant.Dots}
                                    gap={18}
                                    size={1.25}
                                    color="#b4bac9"
                                />
                                <Panel
                                    position="top-right"
                                    className="!m-3 max-w-[200px] rounded-2xl border-0 bg-[var(--background)]/95 p-3 backdrop-blur-sm neo-raised"
                                >
                                    <div className="space-y-1 text-xs">
                                        <div className="font-semibold text-foreground">Workflow</div>
                                        <div className="text-muted-foreground">
                                            {nodes.length} nodes · {edges.length} connections
                                        </div>
                                        {validationResult?.valid && (
                                            <div className="flex items-center gap-1 text-emerald-600">
                                                <CheckCircle className="h-3 w-3" />
                                                <span>Validated</span>
                                            </div>
                                        )}
                                    </div>
                                </Panel>
                            </ReactFlow>
                        </div>
                    </div>
                </div>
                
                {/* Configuration Panel - Right Sidebar */}
                <div className="w-80 shrink-0">
                    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--background)] neo-raised">
                        <div className="flex min-h-0 flex-1 flex-col p-4">
                            {selectedNode ? (
                                <>
                                    <div className="mb-3 shrink-0 border-b border-transparent pb-3 neo-inset rounded-2xl px-3 py-2">
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
                                <div className="flex flex-1 items-center justify-center">
                                    <div className="text-center">
                                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                                            <Settings className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Select a node on the canvas to edit its settings
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status strip — Figma workflow footer */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 rounded-2xl px-4 py-3 text-sm text-muted-foreground neo-inset sm:gap-8">
                <span className="flex items-center gap-2 font-medium text-foreground">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    System online
                </span>
                <span className="hidden text-muted-foreground/40 sm:inline">|</span>
                <span>
                    Nodes: <strong className="text-foreground">{nodes.length}</strong>
                </span>
                <span>
                    Paths: <strong className="text-foreground">{edges.length}</strong>
                </span>
            </div>
            
            {/* Workflow Settings Panel */}
            {showSettings && (
                <WorkflowSettingsPanel onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
}
