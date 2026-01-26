'use client';

import React, { useState } from 'react';
import { useAgents } from '@/lib/hooks/query-hooks';
import { Card, Badge, Button } from '@/components/dashboard/shared';
import { Loader2, Plus, Users, Bot, User, AlertCircle } from 'lucide-react';

export default function AgentsPage() {
    const [typeFilter, setTypeFilter] = useState<'AI' | 'HUMAN' | undefined>();
    const [statusFilter, setStatusFilter] = useState<string | undefined>();

    const { data, isLoading, error } = useAgents({
        type: typeFilter,
        status: statusFilter,
        limit: 50,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                    <p className="text-lg font-semibold">Error loading agents</p>
                    <p className="text-sm text-muted-foreground">{String(error)}</p>
                </div>
            </div>
        );
    }

    const agents = data?.data || [];

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'success';
            case 'PAUSED':
                return 'warning';
            case 'INACTIVE':
                return 'neutral';
            default:
                return 'neutral';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
                    <p className="text-muted-foreground">
                        Manage AI and human agents for call handling
                    </p>
                </div>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Agent
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card title="Total Agents">
                    <div className="text-3xl font-bold">{agents.length}</div>
                </Card>
                <Card title="AI Agents">
                    <div className="text-3xl font-bold text-blue-600">
                        {agents.filter((a: any) => a.type === 'AI').length}
                    </div>
                </Card>
                <Card title="Human Agents">
                    <div className="text-3xl font-bold text-green-600">
                        {agents.filter((a: any) => a.type === 'HUMAN').length}
                    </div>
                </Card>
                <Card title="Active">
                    <div className="text-3xl font-bold text-emerald-600">
                        {agents.filter((a: any) => a.status === 'ACTIVE').length}
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <Button
                    variant={typeFilter === undefined ? 'primary' : 'secondary'}
                    onClick={() => setTypeFilter(undefined)}
                >
                    All
                </Button>
                <Button
                    variant={typeFilter === 'AI' ? 'primary' : 'secondary'}
                    onClick={() => setTypeFilter('AI')}
                >
                    <Bot className="h-4 w-4 mr-2" />
                    AI Agents
                </Button>
                <Button
                    variant={typeFilter === 'HUMAN' ? 'primary' : 'secondary'}
                    onClick={() => setTypeFilter('HUMAN')}
                >
                    <User className="h-4 w-4 mr-2" />
                    Human Agents
                </Button>
            </div>

            {/* Agents List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent: any) => (
                    <Card key={agent.id}>
                        <div className="space-y-4">
                            {/* Agent Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${agent.type === 'AI' ? 'bg-blue-100' : 'bg-green-100'}`}>
                                        {agent.type === 'AI' ? (
                                            <Bot className={`h-5 w-5 ${agent.type === 'AI' ? 'text-blue-600' : 'text-green-600'}`} />
                                        ) : (
                                            <Users className={`h-5 w-5 ${agent.type === 'AI' ? 'text-blue-600' : 'text-green-600'}`} />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{agent.name}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {agent.type === 'AI' ? 'AI Agent' : 'Human Agent'}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant={getStatusBadgeVariant(agent.status)}>
                                    {agent.status}
                                </Badge>
                            </div>

                            {/* Description */}
                            {agent.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {agent.description}
                                </p>
                            )}

                            {/* AI Agent Details */}
                            {agent.type === 'AI' && agent.aiConfig && (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">Persona</div>
                                    <p className="text-sm font-medium">{agent.aiConfig.persona}</p>
                                    {agent.aiConfig.capabilities && agent.aiConfig.capabilities.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {agent.aiConfig.capabilities.slice(0, 3).map((cap: string, idx: number) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                    {cap}
                                                </Badge>
                                            ))}
                                            {agent.aiConfig.capabilities.length > 3 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    +{agent.aiConfig.capabilities.length - 3} more
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Human Agent Details */}
                            {agent.type === 'HUMAN' && agent.humanProfile && (
                                <div className="space-y-2">
                                    {agent.humanProfile.specialization && agent.humanProfile.specialization.length > 0 && (
                                        <>
                                            <div className="text-xs text-muted-foreground">Specialization</div>
                                            <div className="flex flex-wrap gap-1">
                                                {agent.humanProfile.specialization.map((spec: string, idx: number) => (
                                                    <Badge key={idx} variant="primary" className="text-xs">
                                                        {spec}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    <div className="text-xs text-muted-foreground mt-2">
                                        Max Concurrent: {agent.humanProfile.maxConcurrentCalls || 1}
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            {agent._count && (
                                <div className="flex gap-4 pt-2 border-t text-xs text-muted-foreground">
                                    <div>
                                        <span className="font-semibold">{agent._count.callAssignments || 0}</span> calls
                                    </div>
                                    <div>
                                        <span className="font-semibold">{agent._count.agentSessions || 0}</span> sessions
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button variant="secondary" className="flex-1 text-sm">
                                    View Details
                                </Button>
                                <Button variant="ghost" className="flex-1 text-sm">
                                    Edit
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Empty State */}
            {agents.length === 0 && (
                <Card>
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No agents found</h3>
                        <p className="text-muted-foreground mb-4">
                            Get started by creating your first agent
                        </p>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Agent
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
