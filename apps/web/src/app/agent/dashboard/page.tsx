'use client';

import React, { useState } from 'react';
import { useAssignments, useAgentSession } from '@/lib/hooks/query-hooks';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { Card, Badge, Button } from '@/components/dashboard/shared';
import { Loader2, Phone, Check, X, AlertCircle, Clock, User, Coffee, LogOut } from 'lucide-react';

// For demo purposes - in production, get from auth context
const CURRENT_AGENT_ID = 'demo-agent-id';

export default function AgentDashboard() {
    const [agentStatus, setAgentStatus] = useState<string>('ONLINE');
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

    const { data: assignments, isLoading, error, refetch } = useAssignments({
        agentId: CURRENT_AGENT_ID,
        status: 'ASSIGNED',
    });

    const { data: session } = useAgentSession(CURRENT_AGENT_ID);

    // WebSocket for real-time updates
    const { updateAgentStatus, acceptAssignment, rejectAssignment, isConnected } = useWebSocket({
        agentId: CURRENT_AGENT_ID,
        onAssignmentNew: (data) => {
            console.log('New assignment:', data);
            // Show notification
            refetch();
        },
        onCallTransferred: (data) => {
            console.log('Call transferred:', data);
            refetch();
        },
    });

    const handleStatusChange = (newStatus: string) => {
        setAgentStatus(newStatus);
        updateAgentStatus(CURRENT_AGENT_ID, newStatus);
    };

    const handleAcceptAssignment = (assignmentId: string) => {
        acceptAssignment(assignmentId, CURRENT_AGENT_ID);
        refetch();
    };

    const handleRejectAssignment = (assignmentId: string) => {
        rejectAssignment(assignmentId, CURRENT_AGENT_ID, 'Agent declined');
        refetch();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ONLINE':
                return 'bg-green-500';
            case 'BUSY':
                return 'bg-red-500';
            case 'BREAK':
                return 'bg-yellow-500';
            case 'AWAY':
                return 'bg-gray-500';
            case 'OFFLINE':
                return 'bg-gray-400';
            default:
                return 'bg-gray-400';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const assignmentsList = assignments?.data || [];

    return (
        <div className="space-y-6">
            {/* Header with Status */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(agentStatus)}`}></div>
                        <span className="text-lg font-medium">{agentStatus}</span>
                        {isConnected && (
                            <Badge variant="success" className="ml-2">Connected</Badge>
                        )}
                    </div>
                </div>

                {/* Status Controls */}
                <div className="flex gap-2">
                    <Button
                        variant={agentStatus === 'ONLINE' ? 'primary' : 'secondary'}
                        onClick={() => handleStatusChange('ONLINE')}
                    >
                        <Phone className="h-4 w-4 mr-2" />
                        Online
                    </Button>
                    <Button
                        variant={agentStatus === 'BREAK' ? 'primary' : 'secondary'}
                        onClick={() => handleStatusChange('BREAK')}
                    >
                        <Coffee className="h-4 w-4 mr-2" />
                        Break
                    </Button>
                    <Button
                        variant={agentStatus === 'OFFLINE' ? 'primary' : 'secondary'}
                        onClick={() => handleStatusChange('OFFLINE')}
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Offline
                    </Button>
                </div>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card title="Calls Today">
                    <div className="text-3xl font-bold">{session?.totalCallsHandled || 0}</div>
                </Card>
                <Card title="Waiting Assignments">
                    <div className="text-3xl font-bold text-yellow-600">
                        {assignmentsList.length}
                    </div>
                </Card>
                <Card title="Session Duration">
                    <div className="text-3xl font-bold text-blue-600">
                        {session?.startedAt
                            ? Math.floor((new Date().getTime() - new Date(session.startedAt).getTime()) / 60000)
                            : 0}m
                    </div>
                </Card>
                <Card title="Current Status">
                    <div className="text-2xl font-bold">{agentStatus}</div>
                </Card>
            </div>

            {/* Assignments Queue */}
            <Card>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Incoming Assignments</h2>
                        <Badge variant="warning">{assignmentsList.length} waiting</Badge>
                    </div>

                    {assignmentsList.length === 0 ? (
                        <div className="text-center py-12">
                            <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No pending assignments</h3>
                            <p className="text-muted-foreground">
                                You're all caught up! New assignments will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {assignmentsList.map((assignment: any) => (
                                <div
                                    key={assignment.id}
                                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            {/* Call Info */}
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-blue-600" />
                                                <span className="font-semibold">
                                                    Call {assignment.call?.twilioCallSid?.slice(-8)}
                                                </span>
                                                {assignment.call?.isEmergency && (
                                                    <Badge variant="danger">EMERGENCY</Badge>
                                                )}
                                                {assignment.call?.tag && (
                                                    <Badge variant="primary">{assignment.call.tag}</Badge>
                                                )}
                                            </div>

                                            {/* Queue Info */}
                                            {assignment.queue && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <User className="h-3 w-3" />
                                                    <span>{assignment.queue.name}</span>
                                                    <span>•</span>
                                                    <span>{assignment.queue.specialization}</span>
                                                </div>
                                            )}

                                            {/* Wait Time */}
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                <span>
                                                    Waiting {Math.floor((new Date().getTime() - new Date(assignment.createdAt).getTime()) / 1000)}s
                                                </span>
                                            </div>

                                            {/* Call Details */}
                                            {assignment.call && (
                                                <div className="text-sm mt-2 p-2 bg-muted rounded">
                                                    <div><strong>Direction:</strong> {assignment.call.direction}</div>
                                                    <div><strong>Status:</strong> {assignment.call.status}</div>
                                                    <div><strong>Started:</strong> {new Date(assignment.call.startedAt).toLocaleTimeString()}</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 ml-4">
                                            <Button
                                                variant="primary"
                                                onClick={() => handleAcceptAssignment(assignment.id)}
                                                className="whitespace-nowrap"
                                            >
                                                <Check className="h-4 w-4 mr-2" />
                                                Accept
                                            </Button>
                                            <Button
                                                variant="danger"
                                                onClick={() => handleRejectAssignment(assignment.id)}
                                                className="whitespace-nowrap"
                                            >
                                                <X className="h-4 w-4 mr-2" />
                                                Decline
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() => setSelectedAssignment(assignment)}
                                                className="whitespace-nowrap text-sm"
                                            >
                                                Details
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Assignment Details Modal (simplified) */}
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="max-w-2xl w-full">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold">Assignment Details</h2>
                                <Button
                                    variant="ghost"
                                    onClick={() => setSelectedAssignment(null)}
                                >
                                    Close
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <div><strong>Assignment ID:</strong> {selectedAssignment.id}</div>
                                <div><strong>Call ID:</strong> {selectedAssignment.callId}</div>
                                <div><strong>Queue:</strong> {selectedAssignment.queue?.name}</div>
                                <div><strong>Status:</strong> {selectedAssignment.status}</div>
                                <div><strong>Created:</strong> {new Date(selectedAssignment.createdAt).toLocaleString()}</div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="flex items-center gap-2 p-4 border border-red-200 bg-red-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-900">Error loading assignments: {String(error)}</span>
                </div>
            )}
        </div>
    );
}
