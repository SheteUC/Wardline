"use client";

import React, { useState } from 'react';
import {
    BrainCircuit, RotateCcw, CornerUpLeft, CornerUpRight, ZoomIn, ZoomOut,
    Play, Save, Search, Phone, RefreshCw, AlertTriangle, GitGraph, Mic,
    FileText, GripHorizontal, MousePointer, Plus, Settings, CheckCircle, Calendar
} from 'lucide-react';
import { Button } from "@/components/dashboard/shared";

const WORKFLOW_NODES = [
    { id: 'start', type: 'trigger', label: 'Incoming Call', icon: Phone, x: 350, y: 50 },
    { id: 'n1', type: 'action', label: 'Greeting', icon: Mic, subtext: 'Say: "Welcome to..."', x: 350, y: 180 },
    { id: 'n2', type: 'logic', label: 'Intent Detection', icon: BrainCircuit, subtext: 'Analyze Speech', x: 350, y: 320 },
    { id: 'n3', type: 'branch', label: 'Emergency Check', icon: AlertTriangle, subtext: 'If "Chest Pain"', x: 180, y: 480 },
    { id: 'n4', type: 'action', label: 'Schedule', icon: Calendar, subtext: 'Opens Calendar', x: 520, y: 480 },
    { id: 'n5', type: 'end', label: 'Transfer to RN', icon: Phone, subtext: 'High Priority', x: 180, y: 640 },
    { id: 'n6', type: 'end', label: 'Book Slot', icon: CheckCircle, subtext: 'API: Athena', x: 520, y: 640 },
];

const WORKFLOW_EDGES = [
    { from: 'start', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3', label: 'High Risk' },
    { from: 'n2', to: 'n4', label: 'Routine' },
    { from: 'n3', to: 'n5', label: 'True' },
    { from: 'n4', to: 'n6' },
];

// Helper to generate path d attribute
const getPath = (start: any, end: any) => {
    const startX = start.x + 120; // Center of 240px width
    const startY = start.y + 80;  // Bottom of card
    const endX = end.x + 120;     // Center
    const endY = end.y;           // Top
    const cY = (startY + endY) / 2;
    return `M ${startX} ${startY} C ${startX} ${cY} ${endX} ${cY} ${endX} ${endY}`;
};

// Node Component
const WorkflowNode = ({ node, isSelected, onClick }: any) => {
    const typeStyles: Record<string, string> = {
        trigger: "border-teal-200 bg-teal-50 text-teal-900",
        action: "border-blue-200 bg-blue-50 text-blue-900",
        logic: "border-purple-200 bg-purple-50 text-purple-900",
        branch: "border-amber-200 bg-amber-50 text-amber-900",
        end: "border-slate-200 bg-slate-100 text-slate-600",
    };

    return (
        <div
            className={`absolute w-60 rounded-xl shadow-sm border-2 transition-all cursor-pointer z-10 flex flex-col group
        ${isSelected ? 'ring-2 ring-offset-2 ring-accent shadow-md scale-105' : 'hover:shadow-md hover:border-border'}
        ${typeStyles[node.type] || "bg-card border-border"}
      `}
            style={{ left: node.x, top: node.y }}
            onClick={() => onClick(node.id)}
        >
            {/* Input Handle */}
            {node.type !== 'trigger' && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-2 border-border rounded-full z-20"></div>
            )}

            <div className="p-3 flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-white/50 shadow-sm`}>
                    <node.icon className="w-5 h-5 opacity-80" />
                </div>
                <div>
                    <div className="font-semibold text-sm leading-tight">{node.label}</div>
                    {node.subtext && <div className="text-xs opacity-70 mt-1">{node.subtext}</div>}
                </div>
            </div>

            {/* Output Handle */}
            {node.type !== 'end' && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-2 border-border rounded-full z-20 group-hover:bg-accent group-hover:border-accent transition-colors"></div>
            )}
        </div>
    );
};

export default function WorkflowBuilderPage() {
    const [selectedNode, setSelectedNode] = useState('n2'); // Default select "Intent" for demo

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col bg-background border rounded-xl shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-muted/30">
                <div className="flex items-center gap-4">
                    <h2 className="font-semibold text-foreground flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-foreground" />
                        Triage Flow V2.4
                    </h2>
                    <div className="h-6 w-[1px] bg-border"></div>
                    <div className="flex bg-card rounded-md border border-border p-0.5">
                        <button className="p-1.5 hover:bg-muted rounded text-muted-foreground"><RotateCcw className="w-4 h-4" /></button>
                        <button className="p-1.5 hover:bg-muted rounded text-muted-foreground"><CornerUpLeft className="w-4 h-4" /></button>
                        <button className="p-1.5 hover:bg-muted rounded text-muted-foreground"><CornerUpRight className="w-4 h-4" /></button>
                    </div>
                    <div className="flex bg-card rounded-md border border-border p-0.5">
                        <button className="p-1.5 hover:bg-muted rounded text-muted-foreground"><ZoomIn className="w-4 h-4" /></button>
                        <button className="p-1.5 hover:bg-muted rounded text-muted-foreground"><ZoomOut className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" icon={Play} className="h-9 text-xs">Test Run</Button>
                    <Button variant="primary" icon={Save} className="h-9 text-xs">Publish</Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Palette */}
                <div className="w-64 bg-muted/30 border-r border-border flex flex-col">
                    <div className="p-4 border-b border-border">
                        <div className="relative">
                            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input type="text" placeholder="Search nodes..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {[
                            { title: "Triggers", items: [{ l: "Incoming Call", i: Phone }, { l: "Webhook", i: RefreshCw }] },
                            { title: "Logic", items: [{ l: "Intent Detect", i: BrainCircuit }, { l: "Condition", i: AlertTriangle }, { l: "Split", i: GitGraph }] },
                            { title: "Actions", items: [{ l: "Voice Prompt", i: Mic }, { l: "Send SMS", i: FileText }, { l: "API Request", i: RefreshCw }] },
                        ].map((group, idx) => (
                            <div key={idx}>
                                <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2.5 tracking-wider">{group.title}</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {group.items.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2.5 bg-card border border-border rounded-lg shadow-sm cursor-grab hover:border-accent hover:shadow-md transition-all group">
                                            <item.i className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                                            <span className="text-sm text-foreground font-medium">{item.l}</span>
                                            <GripHorizontal className="w-3 h-3 text-muted-foreground ml-auto" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 bg-muted/20 relative overflow-auto"
                    style={{
                        backgroundImage: 'radial-gradient(oklch(0.7 0.01 90) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        backgroundColor: 'oklch(0.96 0.01 90)'
                    }}>

                    {/* Render Connections SVG Layer */}
                    <svg className="absolute top-0 left-0 w-[1000px] h-[800px] pointer-events-none z-0">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="oklch(0.5 0.01 90)" />
                            </marker>
                        </defs>
                        {WORKFLOW_EDGES.map((edge, idx) => {
                            const startNode = WORKFLOW_NODES.find(n => n.id === edge.from);
                            const endNode = WORKFLOW_NODES.find(n => n.id === edge.to);
                            if (!startNode || !endNode) return null;

                            const pathD = getPath(startNode, endNode);
                            return (
                                <g key={idx}>
                                    <path d={pathD} fill="none" stroke="oklch(0.82 0.01 90)" strokeWidth="2" markerEnd="url(#arrowhead)" />
                                    {edge.label && (
                                        <rect x={(startNode.x + endNode.x) / 2 + 110} y={(startNode.y + endNode.y) / 2 + 30} width="60" height="20" rx="4" fill="oklch(0.98 0.005 95)" stroke="oklch(0.88 0.01 90)" />
                                    )}
                                    {edge.label && (
                                        <text x={(startNode.x + endNode.x) / 2 + 140} y={(startNode.y + endNode.y) / 2 + 44} textAnchor="middle" fontSize="10" fill="oklch(0.45 0.02 35)" fontWeight="500">
                                            {edge.label}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {/* Render Nodes */}
                    <div className="relative w-[1000px] h-[800px]">
                        {WORKFLOW_NODES.map(node => (
                            <WorkflowNode
                                key={node.id}
                                node={node}
                                isSelected={selectedNode === node.id}
                                onClick={setSelectedNode}
                            />
                        ))}
                    </div>
                </div>

                {/* Right Inspector */}
                <div className="w-80 bg-card border-l border-border flex flex-col">
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
                    </div>

                    {selectedNode === 'n2' ? (
                        <div className="p-4 space-y-6 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Node Label</label>
                                <input type="text" defaultValue="Intent Detection" className="w-full p-2 text-sm border border-border rounded-md focus:ring-2 focus:ring-ring focus:outline-none" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">AI Model</label>
                                <select className="w-full p-2 text-sm border border-border rounded-md bg-card">
                                    <option>Wardline Health NLP v2 (Latest)</option>
                                    <option>GPT-4 (General)</option>
                                    <option>Legacy Keyword Match</option>
                                </select>
                                <p className="text-xs text-slate-400 mt-1">v2 model is optimized for medical triage.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-slate-500 uppercase">Expected Intents</label>
                                {[
                                    { name: "Chest Pain", color: "bg-rose-100 text-rose-700" },
                                    { name: "Schedule Appointment", color: "bg-teal-100 text-teal-700" },
                                    { name: "Refill Prescription", color: "bg-blue-100 text-blue-700" },
                                    { name: "Billing Question", color: "bg-slate-100 text-slate-700" }
                                ].map((intent, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 border border-border rounded-md">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${intent.color}`}>{intent.name}</span>
                                        <Settings className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                    </div>
                                ))}
                                <Button variant="secondary" className="w-full text-xs" icon={Plus}>Add Intent</Button>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-slate-700 font-medium">Fallback Action</span>
                                </div>
                                <select className="w-full p-2 text-sm border border-border rounded-md bg-card">
                                    <option>Transfer to Operator</option>
                                    <option>Repeat Menu</option>
                                    <option>End Call</option>
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center">
                            <MousePointer className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm">Select a node on the canvas to configure its properties.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
