"use client";

import React, { useCallback, useState, useMemo } from 'react';
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
    MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import {
    Phone, AlertTriangle, Calendar, Building2, Pill, Shield,
    Megaphone, FileText, HelpCircle, CheckCircle, PhoneOff,
    Save, Play, Settings, ChevronRight, Loader2, Edit3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHospital } from '@/lib/hospital-context';

// Node styles for different types
const NODE_STYLES = {
    start: {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 20px',
        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
    },
    emergency: {
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 20px',
        boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)',
    },
    decision: {
        background: '#fef3c7',
        border: '2px solid #f59e0b',
        borderRadius: '12px',
        padding: '12px 20px',
    },
    action: {
        background: '#f0fdf4',
        border: '2px solid #22c55e',
        borderRadius: '12px',
        padding: '12px 20px',
    },
    intent: {
        background: '#eff6ff',
        border: '2px solid #3b82f6',
        borderRadius: '12px',
        padding: '12px 20px',
    },
    end: {
        background: '#374151',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 20px',
    },
};

// Default workflow representing the AI call flow
const defaultNodes: Node[] = [
    {
        id: 'start',
        type: 'input',
        data: { label: '📞 Incoming Call', description: 'Call received from patient' },
        position: { x: 400, y: 0 },
        style: NODE_STYLES.start,
    },
    {
        id: 'greeting',
        data: { label: '👋 Greeting', description: 'Welcome the caller' },
        position: { x: 400, y: 100 },
        style: NODE_STYLES.action,
    },
    {
        id: 'emergency-screen',
        data: { label: '🚨 Emergency Screening', description: 'Check for life-threatening symptoms' },
        position: { x: 400, y: 200 },
        style: NODE_STYLES.decision,
    },
    {
        id: 'emergency-transfer',
        data: { label: '🚑 Transfer to 911', description: 'Immediate emergency handoff' },
        position: { x: 100, y: 300 },
        style: NODE_STYLES.emergency,
    },
    {
        id: 'intent-detection',
        data: { label: '🎯 Detect Intent', description: 'AI analyzes caller needs' },
        position: { x: 400, y: 320 },
        style: NODE_STYLES.decision,
    },
    // Intent branches
    {
        id: 'appointment',
        data: { 
            label: '📅 Appointment Scheduling', 
            description: 'Book, cancel, or change appointments',
            action: 'schedule_appointment'
        },
        position: { x: 100, y: 450 },
        style: NODE_STYLES.intent,
    },
    {
        id: 'department',
        data: { 
            label: '🏥 Department Routing', 
            description: 'Route to correct department',
            action: 'department_routing'
        },
        position: { x: 280, y: 450 },
        style: NODE_STYLES.intent,
    },
    {
        id: 'prescription',
        data: { 
            label: '💊 Prescription Refill', 
            description: 'Handle medication refill requests',
            action: 'prescription_refill'
        },
        position: { x: 460, y: 450 },
        style: NODE_STYLES.intent,
    },
    {
        id: 'insurance',
        data: { 
            label: '🛡️ Insurance Verification', 
            description: 'Verify eligibility & coverage',
            action: 'insurance_verification'
        },
        position: { x: 640, y: 450 },
        style: NODE_STYLES.intent,
    },
    {
        id: 'marketing',
        data: { 
            label: '📣 Marketing Events', 
            description: 'Event info & registration',
            action: 'marketing_event'
        },
        position: { x: 820, y: 450 },
        style: NODE_STYLES.intent,
    },
    // Collection nodes
    {
        id: 'collect-appointment',
        data: { label: 'Collect Details', description: 'Date, time, reason, patient info' },
        position: { x: 100, y: 570 },
        style: NODE_STYLES.action,
    },
    {
        id: 'collect-department',
        data: { label: 'Identify Service', description: 'X-ray, MRI, Lab, etc.' },
        position: { x: 280, y: 570 },
        style: NODE_STYLES.action,
    },
    {
        id: 'collect-prescription',
        data: { label: 'Verify Patient', description: 'Name, DOB, medication, prescriber' },
        position: { x: 460, y: 570 },
        style: NODE_STYLES.action,
    },
    {
        id: 'collect-insurance',
        data: { label: 'Check Plan', description: 'Carrier, plan name, member ID' },
        position: { x: 640, y: 570 },
        style: NODE_STYLES.action,
    },
    {
        id: 'collect-marketing',
        data: { label: 'Register Attendee', description: 'Event selection, contact info' },
        position: { x: 820, y: 570 },
        style: NODE_STYLES.action,
    },
    // Handoff/Complete
    {
        id: 'handoff',
        data: { label: '👤 Handoff to Agent', description: 'Transfer to human when needed' },
        position: { x: 400, y: 700 },
        style: NODE_STYLES.decision,
    },
    {
        id: 'complete',
        type: 'output',
        data: { label: '✅ Call Complete', description: 'Log call and end' },
        position: { x: 400, y: 800 },
        style: NODE_STYLES.end,
    },
];

const defaultEdges: Edge[] = [
    { id: 'e-start-greeting', source: 'start', target: 'greeting', animated: true },
    { id: 'e-greeting-emergency', source: 'greeting', target: 'emergency-screen' },
    { 
        id: 'e-emergency-transfer', 
        source: 'emergency-screen', 
        target: 'emergency-transfer', 
        label: 'Emergency', 
        style: { stroke: '#ef4444' },
        labelStyle: { fill: '#ef4444', fontWeight: 600 },
    },
    { 
        id: 'e-emergency-intent', 
        source: 'emergency-screen', 
        target: 'intent-detection', 
        label: 'No Emergency',
        style: { stroke: '#22c55e' },
        labelStyle: { fill: '#22c55e', fontWeight: 600 },
    },
    // Intent branches
    { id: 'e-intent-apt', source: 'intent-detection', target: 'appointment' },
    { id: 'e-intent-dept', source: 'intent-detection', target: 'department' },
    { id: 'e-intent-rx', source: 'intent-detection', target: 'prescription' },
    { id: 'e-intent-ins', source: 'intent-detection', target: 'insurance' },
    { id: 'e-intent-mkt', source: 'intent-detection', target: 'marketing' },
    // Collection steps
    { id: 'e-apt-collect', source: 'appointment', target: 'collect-appointment' },
    { id: 'e-dept-collect', source: 'department', target: 'collect-department' },
    { id: 'e-rx-collect', source: 'prescription', target: 'collect-prescription' },
    { id: 'e-ins-collect', source: 'insurance', target: 'collect-insurance' },
    { id: 'e-mkt-collect', source: 'marketing', target: 'collect-marketing' },
    // To handoff
    { id: 'e-collect-apt-handoff', source: 'collect-appointment', target: 'handoff' },
    { id: 'e-collect-dept-handoff', source: 'collect-department', target: 'handoff' },
    { id: 'e-collect-rx-handoff', source: 'collect-prescription', target: 'handoff' },
    { id: 'e-collect-ins-handoff', source: 'collect-insurance', target: 'handoff' },
    { id: 'e-collect-mkt-handoff', source: 'collect-marketing', target: 'handoff' },
    // Emergency to complete
    { id: 'e-emergency-complete', source: 'emergency-transfer', target: 'complete' },
    // Handoff to complete
    { id: 'e-handoff-complete', source: 'handoff', target: 'complete' },
];

// Intent configuration for the properties panel
const INTENT_CONFIGS = {
    schedule_appointment: {
        name: 'Appointment Scheduling',
        icon: Calendar,
        description: 'Book, cancel, or change appointments',
        requiredFields: ['patientName', 'phoneNumber', 'preferredDate', 'reason'],
        handoffTo: 'Scheduling Department',
    },
    department_routing: {
        name: 'Department Routing',
        icon: Building2,
        description: 'Route callers to the correct department',
        requiredFields: ['patientName', 'phoneNumber', 'serviceType'],
        handoffTo: 'Target Department',
    },
    prescription_refill: {
        name: 'Prescription Refill',
        icon: Pill,
        description: 'Handle medication refill requests',
        requiredFields: ['patientName', 'dateOfBirth', 'medicationName', 'prescriberName', 'pharmacyName'],
        handoffTo: 'Pharmacy / Prescriber',
        newPatientAction: 'Assign provider and schedule first appointment',
    },
    insurance_verification: {
        name: 'Insurance Verification',
        icon: Shield,
        description: 'Verify plan acceptance and eligibility',
        requiredFields: ['patientName', 'insuranceCarrier', 'planName', 'memberNumber'],
        handoffTo: 'Patient Access',
        claimDenialPrevention: 'Up to 75% reduction in claim denials',
    },
    marketing_event: {
        name: 'Marketing Events',
        icon: Megaphone,
        description: 'Event info and registration',
        requiredFields: ['attendeeName', 'phoneNumber', 'eventSelection'],
        handoffTo: 'Marketing / Registration',
        conversionTracking: 'Track attendees who become patients',
    },
};

export default function WorkflowsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    const onConnect = useCallback(
        (params: Connection) => {
            setEdges((eds) => addEdge(params, eds));
            setHasChanges(true);
        },
        [setEdges]
    );

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const updateNodeLabel = useCallback((nodeId: string, newLabel: string) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, label: newLabel } };
                }
                return node;
            })
        );
        setHasChanges(true);
    }, [setNodes]);

    const updateNodeDescription = useCallback((nodeId: string, newDesc: string) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, description: newDesc } };
                }
                return node;
            })
        );
        setHasChanges(true);
    }, [setNodes]);

    const selectedIntentConfig = selectedNode?.data?.action 
        ? INTENT_CONFIGS[selectedNode.data.action as keyof typeof INTENT_CONFIGS]
        : null;

    if (hospitalLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI Call Workflow</h1>
                    <p className="text-muted-foreground">
                        Configure how the AI handles incoming patient calls
                    </p>
                </div>
                <div className="flex gap-2">
                    {hasChanges && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Unsaved Changes
                        </Badge>
                    )}
                    <Button variant="outline">
                        <Play className="h-4 w-4 mr-2" />
                        Test Call
                    </Button>
                    <Button disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-2" />
                        Publish
                    </Button>
                </div>
            </div>

            {/* Workflow Info Card */}
            <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-blue-100">
                            <Phone className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold">Voice AI Call Flow</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                This workflow defines how the AI handles patient calls through your 800 number. 
                                The AI screens for emergencies, detects caller intent, collects required information, 
                                and hands off to the appropriate department or completes the request automatically.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Badge variant="outline">Emergency Screening</Badge>
                                <Badge variant="outline">Appointment Scheduling</Badge>
                                <Badge variant="outline">Department Routing</Badge>
                                <Badge variant="outline">Prescription Refills</Badge>
                                <Badge variant="outline">Insurance Verification</Badge>
                                <Badge variant="outline">Event Registration</Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Flow Canvas */}
                <Card className="lg:col-span-3">
                    <CardContent className="p-0">
                        <div style={{ height: "700px" }}>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onNodeClick={onNodeClick}
                                fitView
                                minZoom={0.3}
                                maxZoom={1.5}
                            >
                                <Controls />
                                <MiniMap 
                                    nodeStrokeColor="#e2e8f0"
                                    nodeColor={(node) => {
                                        if (node.id === 'start') return '#3b82f6';
                                        if (node.id === 'emergency-transfer') return '#ef4444';
                                        if (node.id === 'complete') return '#374151';
                                        return '#f1f5f9';
                                    }}
                                />
                                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                                <Panel position="top-right" className="bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
                                    <div className="text-xs space-y-1">
                                        <div className="font-semibold text-foreground">Workflow Status</div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <span className="text-muted-foreground">Published & Active</span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            {nodes.length} nodes • {edges.length} connections
                                        </div>
                                    </div>
                                </Panel>
                            </ReactFlow>
                        </div>
                    </CardContent>
                </Card>

                {/* Properties Panel */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Properties</CardTitle>
                        <CardDescription>
                            {selectedNode ? "Edit node configuration" : "Select a node to configure"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedNode ? (
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="node-label">Display Label</Label>
                                    <Input
                                        id="node-label"
                                        value={selectedNode.data.label}
                                        onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="node-desc">Description</Label>
                                    <Input
                                        id="node-desc"
                                        value={selectedNode.data.description || ''}
                                        onChange={(e) => updateNodeDescription(selectedNode.id, e.target.value)}
                                        className="mt-1"
                                    />
                                </div>

                                {/* Intent-specific configuration */}
                                {selectedIntentConfig && (
                                    <div className="pt-4 border-t space-y-4">
                                        <div className="flex items-center gap-2">
                                            {React.createElement(selectedIntentConfig.icon, { className: 'h-5 w-5 text-primary' })}
                                            <span className="font-semibold">{selectedIntentConfig.name}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedIntentConfig.description}
                                        </p>
                                        
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Required Fields</Label>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {selectedIntentConfig.requiredFields.map(field => (
                                                    <Badge key={field} variant="secondary" className="text-xs">
                                                        {field}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-xs text-muted-foreground">Handoff To</Label>
                                            <p className="text-sm font-medium">{selectedIntentConfig.handoffTo}</p>
                                        </div>

                                        {selectedIntentConfig.claimDenialPrevention && (
                                            <div className="bg-emerald-50 p-3 rounded-lg">
                                                <p className="text-xs text-emerald-700 font-medium">
                                                    💡 {selectedIntentConfig.claimDenialPrevention}
                                                </p>
                                            </div>
                                        )}

                                        {selectedIntentConfig.newPatientAction && (
                                            <div className="bg-blue-50 p-3 rounded-lg">
                                                <p className="text-xs text-blue-700 font-medium">
                                                    👤 New Patient: {selectedIntentConfig.newPatientAction}
                                                </p>
                                            </div>
                                        )}

                                        {selectedIntentConfig.conversionTracking && (
                                            <div className="bg-purple-50 p-3 rounded-lg">
                                                <p className="text-xs text-purple-700 font-medium">
                                                    📊 {selectedIntentConfig.conversionTracking}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Node type badge */}
                                <div className="pt-4 border-t">
                                    <Label className="text-xs text-muted-foreground">Node Type</Label>
                                    <div className="mt-1">
                                        <Badge variant="outline">
                                            {selectedNode.type || 'action'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    Click on a node in the workflow to view and edit its configuration
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Legend */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Node Types</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-500"></div>
                            <span>Start/End</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-red-500"></div>
                            <span>Emergency</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border-2 border-amber-500 bg-amber-50"></div>
                            <span>Decision</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-50"></div>
                            <span>Intent</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-50"></div>
                            <span>Action</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gray-600"></div>
                            <span>Complete</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
