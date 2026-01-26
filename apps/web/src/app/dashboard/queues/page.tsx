'use client';

import React, { useEffect } from 'react';
import { useQueues, useQueueMetrics } from '@/lib/hooks/query-hooks';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { Card, Badge, Button } from '@/components/dashboard/shared';
import { Loader2, Plus, Users, Clock, AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';

function QueueCard({ queue }: { queue: any }) {
    const { data: metrics, refetch } = useQueueMetrics(queue.id);

    const queueDepth = metrics?.queueDepth || 0;
    const avgWaitTime = metrics?.avgWaitTime || 0;
    const slaCompliance = metrics?.slaCompliance;

    const getSLAColor = (compliance: number | null) => {
        if (!compliance) return 'text-muted-foreground';
        if (compliance >= 90) return 'text-green-600';
        if (compliance >= 75) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <Card>
            <div className="space-y-4">
                {/* Queue Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold text-lg">{queue.name}</h3>
                        <p className="text-sm text-muted-foreground">
                            {queue.specialization}
                        </p>
                    </div>
                    <Badge variant={queueDepth > 0 ? 'warning' : 'success'}>
                        {queueDepth} waiting
                    </Badge>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">Queue Depth</div>
                        <div className="text-2xl font-bold">{queueDepth}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">Avg Wait</div>
                        <div className="text-2xl font-bold">{avgWaitTime}s</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">SLA</div>
                        <div className={`text-2xl font-bold ${getSLAColor(slaCompliance)}`}>
                            {slaCompliance ? `${slaCompliance}%` : 'N/A'}
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
                    <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Max wait: {queue.maxWaitTime ? `${queue.maxWaitTime}s` : 'No limit'}
                    </div>
                    <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Priority: {queue.priority}
                    </div>
                </div>

                {/* Waiting Calls */}
                {metrics?.currentWaiting && metrics.currentWaiting.length > 0 && (
                    <div className="border-t pt-3">
                        <div className="text-xs text-muted-foreground mb-2">Waiting Calls</div>
                        <div className="space-y-2">
                            {metrics.currentWaiting.slice(0, 3).map((assignment: any) => (
                                <div key={assignment.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                    <span className="font-medium">Call {assignment.call?.twilioCallSid?.slice(-6)}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {Math.floor((new Date().getTime() - new Date(assignment.createdAt).getTime()) / 1000)}s
                                    </span>
                                </div>
                            ))}
                            {metrics.currentWaiting.length > 3 && (
                                <div className="text-xs text-muted-foreground text-center">
                                    +{metrics.currentWaiting.length - 3} more
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 text-sm">
                        View Details
                    </Button>
                    <Button variant="ghost" className="flex-1 text-sm">
                        Assign Manually
                    </Button>
                </div>
            </div>
        </Card>
    );
}

export default function QueuesPage() {
    const { data, isLoading, error, refetch } = useQueues({ limit: 50 });

    // Real-time queue updates via WebSocket
    const { isConnected } = useWebSocket({
        onQueueUpdated: (data) => {
            console.log('Queue updated:', data);
            refetch();
        },
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
                    <p className="text-lg font-semibold">Error loading queues</p>
                    <p className="text-sm text-muted-foreground">{String(error)}</p>
                </div>
            </div>
        );
    }

    const queues = data?.data || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Call Queues</h1>
                    <p className="text-muted-foreground">
                        Monitor and manage call queues for human agents
                    </p>
                    {isConnected && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-green-600">Live Updates</span>
                        </div>
                    )}
                </div>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Queue
                </Button>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card title="Total Queues">
                    <div className="text-3xl font-bold">{queues.length}</div>
                </Card>
                <Card title="Total Waiting">
                    <div className="text-3xl font-bold text-yellow-600">
                        {queues.reduce((sum: number, q: any) => sum + (q._count?.queuedCalls || 0), 0)}
                    </div>
                </Card>
                <Card title="Active Queues">
                    <div className="text-3xl font-bold text-green-600">
                        {queues.filter((q: any) => (q._count?.queuedCalls || 0) > 0).length}
                    </div>
                </Card>
                <Card title="Idle Queues">
                    <div className="text-3xl font-bold text-muted-foreground">
                        {queues.filter((q: any) => (q._count?.queuedCalls || 0) === 0).length}
                    </div>
                </Card>
            </div>

            {/* Queues Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {queues.map((queue: any) => (
                    <QueueCard key={queue.id} queue={queue} />
                ))}
            </div>

            {/* Empty State */}
            {queues.length === 0 && (
                <Card>
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No queues found</h3>
                        <p className="text-muted-foreground mb-4">
                            Create queues to manage call routing to human agents
                        </p>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Queue
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
