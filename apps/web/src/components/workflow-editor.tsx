"use client";

import { useCallback, useState } from "react";
import ReactFlow, {
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
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Play, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initialNodes: Node[] = [
    {
        id: "1",
        type: "input",
        data: { label: "Start Call" },
        position: { x: 250, y: 25 },
        style: {
            background: "#3b82f6",
            color: "white",
            border: "1px solid #2563eb",
            borderRadius: "8px",
            padding: "10px",
        },
    },
    {
        id: "2",
        data: { label: "Greet Caller" },
        position: { x: 250, y: 125 },
        style: {
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "10px",
        },
    },
    {
        id: "3",
        data: { label: "Ask Intent" },
        position: { x: 250, y: 225 },
        style: {
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "10px",
        },
    },
    {
        id: "4",
        data: { label: "Emergency?" },
        position: { x: 100, y: 325 },
        style: {
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "10px",
        },
    },
    {
        id: "5",
        data: { label: "Transfer to Emergency" },
        position: { x: 100, y: 425 },
        style: {
            background: "#ef4444",
            color: "white",
            border: "1px solid #dc2626",
            borderRadius: "8px",
            padding: "10px",
        },
    },
    {
        id: "6",
        data: { label: "Schedule Appointment" },
        position: { x: 400, y: 325 },
        style: {
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "8px",
            padding: "10px",
        },
    },
    {
        id: "7",
        type: "output",
        data: { label: "End Call" },
        position: { x: 250, y: 525 },
        style: {
            background: "#64748b",
            color: "white",
            border: "1px solid #475569",
            borderRadius: "8px",
            padding: "10px",
        },
    },
];

const initialEdges: Edge[] = [
    { id: "e1-2", source: "1", target: "2", animated: true },
    { id: "e2-3", source: "2", target: "3" },
    { id: "e3-4", source: "3", target: "4", label: "Check" },
    { id: "e3-6", source: "3", target: "6", label: "Normal" },
    { id: "e4-5", source: "4", target: "5", label: "Yes", style: { stroke: "#ef4444" } },
    { id: "e4-6", source: "4", target: "6", label: "No" },
    { id: "e5-7", source: "5", target: "7" },
    { id: "e6-7", source: "6", target: "7" },
];

interface WorkflowEditorProps {
    workflowId: string;
    workflowName?: string;
}

export function WorkflowEditor({ workflowId, workflowName = "Untitled Workflow" }: WorkflowEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/workflows">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{workflowName}</h1>
                        <p className="text-muted-foreground">
                            Visual workflow editor
                        </p>
                    </div>
                    <Badge variant="outline">Draft</Badge>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Play className="h-4 w-4 mr-2" />
                        Test
                    </Button>
                    <Button>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Flow Canvas */}
                <Card className="lg:col-span-3">
                    <CardContent className="p-0">
                        <div style={{ height: "600px" }}>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onNodeClick={onNodeClick}
                                fitView
                            >
                                <Controls />
                                <MiniMap />
                                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                                <Panel position="top-right" className="bg-background/80 backdrop-blur-sm rounded-lg p-2">
                                    <div className="text-xs text-muted-foreground">
                                        {nodes.length} nodes • {edges.length} connections
                                    </div>
                                </Panel>
                            </ReactFlow>
                        </div>
                    </CardContent>
                </Card>

                {/* Properties Panel */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Properties</CardTitle>
                        <CardDescription>
                            {selectedNode ? "Edit node properties" : "Select a node to edit"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedNode ? (
                            <Tabs defaultValue="general" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="general">General</TabsTrigger>
                                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                                </TabsList>
                                <TabsContent value="general" className="space-y-4">
                                    <div>
                                        <Label htmlFor="node-label">Label</Label>
                                        <Input
                                            id="node-label"
                                            value={selectedNode.data.label}
                                            onChange={(e) => {
                                                setNodes((nds) =>
                                                    nds.map((node) => {
                                                        if (node.id === selectedNode.id) {
                                                            return {
                                                                ...node,
                                                                data: { ...node.data, label: e.target.value },
                                                            };
                                                        }
                                                        return node;
                                                    })
                                                );
                                            }}
                                        />
                                    </div>
                                    <Separator />
                                    <div>
                                        <Label>Node Type</Label>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {selectedNode.type || "default"}
                                        </p>
                                    </div>
                                    <div>
                                        <Label>Position</Label>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <p className="text-xs text-muted-foreground">X</p>
                                                <p className="text-sm">{Math.round(selectedNode.position.x)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Y</p>
                                                <p className="text-sm">{Math.round(selectedNode.position.y)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="advanced" className="space-y-4">
                                    <div>
                                        <Label>Node ID</Label>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {selectedNode.id}
                                        </p>
                                    </div>
                                    <Separator />
                                    <div>
                                        <Label htmlFor="node-description">Description</Label>
                                        <Input
                                            id="node-description"
                                            placeholder="Add a description..."
                                        />
                                    </div>
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">Click on a node to view and edit its properties</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">How to Use</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                        <div>
                            <p className="font-medium mb-1">Drag & Drop</p>
                            <p className="text-muted-foreground">
                                Click and drag nodes to reposition them on the canvas
                            </p>
                        </div>
                        <div>
                            <p className="font-medium mb-1">Connect Nodes</p>
                            <p className="text-muted-foreground">
                                Drag from a node's edge to another node to create connections
                            </p>
                        </div>
                        <div>
                            <p className="font-medium mb-1">Edit Properties</p>
                            <p className="text-muted-foreground">
                                Click on a node to edit its label and other properties
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
