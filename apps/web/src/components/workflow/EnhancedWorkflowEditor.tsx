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
    Loader2, Download, Upload, Settings
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
    
    const addNodeToCanvas = useCallback((nodeType: any) => {
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type: nodeType.type,
            position: { x: 250, y: 100 + nodes.length * 20 },
            data: nodeType.defaultData,
        };
        
        setNodes((nds) => [...nds, newNode]);
        setHasChanges(true);
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
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/workflows">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{workflowName}</h1>
                        <p className="text-sm text-muted-foreground">
                            {nodes.length} nodes • {edges.length} connections
                        </p>
                    </div>
                    {hasChanges && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Unsaved Changes
                        </Badge>
                    )}
                </div>
                
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportWorkflow}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleValidate} disabled={isValidating}>
                        {isValidating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Validate
                    </Button>
                    <Button variant="outline" size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Simulate
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                    </Button>
                </div>
            </div>
            
            {/* Validation Results */}
            {validationResult && (
                <Card className={validationResult.valid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
                    <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                            {validationResult.valid ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                                <p className="font-semibold text-sm">
                                    {validationResult.valid ? 'Workflow is valid' : 'Validation failed'}
                                </p>
                                {validationResult.errors && validationResult.errors.length > 0 && (
                                    <ul className="text-xs mt-2 space-y-1">
                                        {validationResult.errors.map((error: any, i: number) => (
                                            <li key={i} className="text-red-700">
                                                • {error.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {validationResult.warnings && validationResult.warnings.length > 0 && (
                                    <ul className="text-xs mt-2 space-y-1">
                                        {validationResult.warnings.map((warning: any, i: number) => (
                                            <li key={i} className="text-amber-700">
                                                ⚠ {warning.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {/* Main Editor Layout */}
            <div className="grid grid-cols-12 gap-4">
                {/* Node Palette - Left Sidebar */}
                <div className="col-span-2">
                    <NodePalette onAddNode={addNodeToCanvas} />
                </div>
                
                {/* Flow Canvas - Center */}
                <div className="col-span-7">
                    <Card>
                        <CardContent className="p-0">
                            <div style={{ height: '700px' }}>
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
                                    <Controls />
                                    <MiniMap
                                        nodeStrokeColor="#e2e8f0"
                                        nodeColor={getNodeColor}
                                        className="!bg-background border rounded-lg"
                                    />
                                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                                    <Panel position="top-right" className="bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
                                        <div className="text-xs space-y-1">
                                            <div className="font-semibold">Workflow Info</div>
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
                            </div>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Configuration Panel - Right Sidebar */}
                <div className="col-span-3">
                    <Card className="h-[700px] flex flex-col">
                        <CardContent className="p-4 flex-1 flex flex-col">
                            {selectedNode ? (
                                <>
                                    <div className="pb-3 border-b mb-4">
                                        <h3 className="font-semibold">Node Configuration</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Configure selected node
                                        </p>
                                    </div>
                                    
                                    <ScrollArea className="flex-1 pr-4">
                                        {selectedNode.type === 'start' && (
                                            <StartNodeConfigPanel
                                                data={selectedNode.data}
                                                onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                            />
                                        )}
                                        {selectedNode.type === 'ai-agent' && (
                                            <AIAgentConfigPanel
                                                data={selectedNode.data}
                                                onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                            />
                                        )}
                                        {selectedNode.type === 'human-agent-queue' && (
                                            <HumanQueueConfigPanel
                                                data={selectedNode.data}
                                                onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                            />
                                        )}
                                        {selectedNode.type === 'conditional' && (
                                            <ConditionalConfigPanel
                                                data={selectedNode.data}
                                                onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                            />
                                        )}
                                        {selectedNode.type === 'safety-check' && (
                                            <SafetyCheckConfigPanel
                                                data={selectedNode.data}
                                                onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                            />
                                        )}
                                        {selectedNode.type === 'integration' && (
                                            <IntegrationConfigPanel
                                                data={selectedNode.data}
                                                onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                            />
                                        )}
                                        {selectedNode.type === 'end' && (
                                            <EndNodeConfigPanel
                                                data={selectedNode.data}
                                                onChange={(updates) => updateNodeData(selectedNode.id, updates)}
                                            />
                                        )}
                                        {!['start', 'ai-agent', 'human-agent-queue', 'conditional', 'safety-check', 'integration', 'end'].includes(selectedNode.type || '') && (
                                            <div className="text-center py-8">
                                                <p className="text-sm text-muted-foreground">
                                                    No configuration available for this node type
                                                </p>
                                            </div>
                                        )}
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
            
            {/* Node Type Legend */}
            <Card>
                <CardContent className="py-3">
                    <div className="flex items-center gap-4 text-xs">
                        <span className="font-semibold">Node Types:</span>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-purple-500"></div>
                            <span>AI Agent</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-blue-500"></div>
                            <span>Human Queue</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-amber-500"></div>
                            <span>Conditional</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-orange-500"></div>
                            <span>Safety Check</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-teal-500"></div>
                            <span>Integration</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-gray-500"></div>
                            <span>End</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Workflow Settings Panel */}
            {showSettings && (
                <WorkflowSettingsPanel onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
}
