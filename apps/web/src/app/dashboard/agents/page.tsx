'use client';

import React, { useState } from 'react';
import { Card, Badge, Button } from '@/components/dashboard/shared';
import { Loader2, Plus, Bot, Settings, MessageSquare, Zap, Calendar, Shield, MessageCircle, Sparkles, Save, Trash2, Copy } from 'lucide-react';

// Preset agent templates
const PRESET_AGENTS = [
    {
        id: 'general-triage',
        name: 'General Triage Agent',
        description: 'Default AI agent for general patient intake and triage',
        persona: 'Professional, empathetic healthcare assistant',
        capabilities: ['Intent Detection', 'Symptom Assessment', 'Routing', 'Emergency Detection'],
        icon: Bot,
        color: 'blue',
        isPreset: true,
        systemPrompt: 'You are a professional healthcare triage assistant. Be empathetic, clear, and thorough...',
        tools: ['intent_detection', 'symptom_checker', 'emergency_detector', 'patient_lookup'],
        active: true,
    },
    {
        id: 'appointment-scheduler',
        name: 'Appointment Scheduling Agent',
        description: 'Specialized in scheduling and managing appointments',
        persona: 'Efficient and friendly scheduling coordinator',
        capabilities: ['Appointment Booking', 'Calendar Management', 'Rescheduling', 'Availability Check'],
        icon: Calendar,
        color: 'green',
        isPreset: true,
        systemPrompt: 'You are a scheduling specialist. Help patients book, reschedule, and manage appointments...',
        tools: ['calendar_access', 'appointment_booking', 'provider_availability', 'reminder_setup'],
        active: true,
    },
    {
        id: 'insurance-verification',
        name: 'Insurance Verification Agent',
        description: 'Handles insurance verification and eligibility checks',
        persona: 'Knowledgeable insurance specialist',
        capabilities: ['Insurance Verification', 'Eligibility Check', 'Coverage Details', 'Prior Auth'],
        icon: Shield,
        color: 'purple',
        isPreset: true,
        systemPrompt: 'You are an insurance verification specialist. Verify coverage and explain benefits clearly...',
        tools: ['insurance_lookup', 'eligibility_check', 'coverage_calculator', 'prior_auth_check'],
        active: true,
    },
    {
        id: 'prescription-refill',
        name: 'Prescription Refill Agent',
        description: 'Manages prescription refill requests',
        persona: 'Careful and detail-oriented pharmacy liaison',
        capabilities: ['Prescription Lookup', 'Refill Processing', 'Pharmacy Coordination', 'Drug Interaction Check'],
        icon: Zap,
        color: 'orange',
        isPreset: true,
        systemPrompt: 'You are a prescription refill specialist. Safely process refill requests and coordinate with pharmacies...',
        tools: ['prescription_lookup', 'refill_request', 'pharmacy_integration', 'drug_database'],
        active: true,
    },
    {
        id: 'slack-bot',
        name: 'Slack Bot Agent',
        description: 'Integrates with Slack for team notifications and updates',
        persona: 'Concise and action-oriented team assistant',
        capabilities: ['Team Notifications', 'Status Updates', 'Alert Routing', 'Quick Responses'],
        icon: MessageCircle,
        color: 'pink',
        isPreset: true,
        systemPrompt: 'You are a team communication assistant. Send clear, concise updates to the care team...',
        tools: ['slack_integration', 'notification_sender', 'channel_router', 'mention_handler'],
        active: false,
    },
];

export default function AgentsPage() {
    const [agents, setAgents] = useState(PRESET_AGENTS);
    const [selectedAgent, setSelectedAgent] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [customAgents, setCustomAgents] = useState<any[]>([]);

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; text: string; border: string }> = {
            blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
            green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
            purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
            orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
            pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
        };
        return colors[color] || colors.blue;
    };

    const handleToggleAgent = (agentId: string) => {
        setAgents(agents.map(agent =>
            agent.id === agentId ? { ...agent, active: !agent.active } : agent
        ));
    };

    const handleCreateCustomAgent = () => {
        const newAgent = {
            id: `custom-${Date.now()}`,
            name: 'Custom Agent',
            description: 'New custom agent configuration',
            persona: 'Professional assistant',
            capabilities: [],
            icon: Sparkles,
            color: 'blue',
            isPreset: false,
            systemPrompt: '',
            tools: [],
            active: false,
        };
        setCustomAgents([...customAgents, newAgent]);
        setSelectedAgent(newAgent);
        setIsEditing(true);
    };

    const allAgents = [...agents, ...customAgents];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-muted-foreground">
                        Configure preset AI agents and create custom agents for your workflows
                    </p>
                </div>
                <Button onClick={handleCreateCustomAgent}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom Agent
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card title="Total Agents">
                    <div className="text-3xl font-bold">{allAgents.length}</div>
                </Card>
                <Card title="Preset Agents">
                    <div className="text-3xl font-bold text-blue-600">
                        {agents.length}
                    </div>
                </Card>
                <Card title="Custom Agents">
                    <div className="text-3xl font-bold text-purple-600">
                        {customAgents.length}
                    </div>
                </Card>
                <Card title="Active">
                    <div className="text-3xl font-bold text-emerald-600">
                        {allAgents.filter(a => a.active).length}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Preset Agents */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Preset Agents</h2>
                    <div className="space-y-3">
                        {agents.map((agent) => {
                            const colorClasses = getColorClasses(agent.color);
                            const Icon = agent.icon;
                            return (
                                <Card key={agent.id} className="hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg ${colorClasses.bg} border ${colorClasses.border}`}>
                                            <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h3 className="font-semibold text-foreground">{agent.name}</h3>
                                                    <p className="text-sm text-muted-foreground">{agent.description}</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={agent.active}
                                                        onChange={() => handleToggleAgent(agent.id)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {agent.capabilities.slice(0, 3).map((cap, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                        {cap}
                                                    </Badge>
                                                ))}
                                                {agent.capabilities.length > 3 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        +{agent.capabilities.length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 text-xs"
                                                    onClick={() => {
                                                        setSelectedAgent(agent);
                                                        setIsEditing(false);
                                                    }}
                                                >
                                                    <Settings className="h-3 w-3 mr-1" />
                                                    Configure
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 text-xs"
                                                    onClick={() => {
                                                        const newAgent = { ...agent, id: `custom-${Date.now()}`, isPreset: false };
                                                        setCustomAgents([...customAgents, newAgent]);
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3 mr-1" />
                                                    Duplicate
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Custom Agents */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Custom Agents</h2>
                    {customAgents.length === 0 ? (
                        <Card>
                            <div className="text-center py-12">
                                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Custom Agents</h3>
                                <p className="text-muted-foreground mb-4">
                                    Create custom agents with specific behaviors for your workflows
                                </p>
                                <Button onClick={handleCreateCustomAgent}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Custom Agent
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {customAgents.map((agent) => {
                                const colorClasses = getColorClasses(agent.color);
                                const Icon = agent.icon;
                                return (
                                    <Card key={agent.id} className="hover:shadow-md transition-shadow">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-lg ${colorClasses.bg} border ${colorClasses.border}`}>
                                                <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-foreground">{agent.name}</h3>
                                                        <p className="text-sm text-muted-foreground">{agent.description}</p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={agent.active}
                                                            onChange={() => {
                                                                setCustomAgents(customAgents.map(a =>
                                                                    a.id === agent.id ? { ...a, active: !a.active } : a
                                                                ));
                                                            }}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 text-xs"
                                                        onClick={() => {
                                                            setSelectedAgent(agent);
                                                            setIsEditing(true);
                                                        }}
                                                    >
                                                        <Settings className="h-3 w-3 mr-1" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 text-xs text-red-600 hover:text-red-700"
                                                        onClick={() => {
                                                            setCustomAgents(customAgents.filter(a => a.id !== agent.id));
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3 mr-1" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Info Card */}
            <Card>
                <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-sm mb-1">How Agent Configuration Works</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure preset agents or create custom agents with specific personas and capabilities. 
                            These agents can be selected in the AI Agent nodes within your workflow editor. 
                            Preset agents provide common functionality, while custom agents allow for specialized behaviors.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
