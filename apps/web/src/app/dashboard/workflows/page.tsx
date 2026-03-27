"use client";

import { useState, useEffect } from "react";
import { EnhancedWorkflowEditor } from "@/components/workflow/EnhancedWorkflowEditor";
import { useApiClient } from "@/lib/api-client";
import { useBusiness } from "@/lib/business-context";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Node, Edge } from '@xyflow/react';
import type { WorkflowDetail, WorkflowListItem } from '@/lib/api-types';
import { WorkflowStatus } from '@wardline/types';

export default function WorkflowsPage() {
    const { businessId, isLoading: businessLoading } = useBusiness();
    const apiClient = useApiClient();
    const [workflowData, setWorkflowData] = useState<{ nodes: Node[], edges: Edge[], id?: string, name: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (businessLoading) {
            return;
        }

        if (!businessId) {
            setWorkflowData(null);
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchMainWorkflow = async () => {
            try {
                setLoading(true);
                const workflows = await apiClient.get<WorkflowListItem[]>(`/businesses/${businessId}/workflows`);
                if (cancelled) return;

                if (workflows.length > 0) {
                    const prioritized =
                        workflows.find((workflow) => workflow.status === WorkflowStatus.PUBLISHED) ||
                        workflows[0];
                    const fullWorkflow = await apiClient.get<WorkflowDetail>(
                        `/businesses/${businessId}/workflows/${prioritized.id}`,
                    );
                    if (cancelled) return;

                    if (fullWorkflow.versions?.length > 0) {
                        const latestVersion = fullWorkflow.versions[0];
                        const graphJson = (latestVersion.graphJson as { nodes?: any[]; edges?: any[] }) || {};
                        const nodes = (graphJson.nodes || []).map((node, index) => {
                            const config = node.data || node.config || {};
                            return {
                                id: node.id,
                                type: node.type || 'default',
                                position: node.position || { x: 100 + index * 80, y: 100 + index * 80 },
                                data: { label: config.label || config.message || node.type || 'Node', ...config },
                            };
                        });

                        const edges = (graphJson.edges || []).map((edge) => ({
                            id: edge.id || `edge-${edge.source || edge.fromNodeId}-${edge.target || edge.toNodeId}`,
                            source: edge.source ?? edge.fromNodeId,
                            target: edge.target ?? edge.toNodeId,
                            label: edge.label,
                            animated: edge.animated ?? false,
                        }));

                        setWorkflowData({
                            id: fullWorkflow.id,
                            name: fullWorkflow.name || 'Main Workflow',
                            nodes,
                            edges,
                        });
                        return;
                    }
                }

                if (!cancelled) {
                    setWorkflowData({
                        name: 'Main Workflow',
                        nodes: [],
                        edges: [],
                    });
                }
            } catch (err) {
                console.error('Failed to fetch main workflow:', err);
                if (!cancelled) {
                    setWorkflowData({
                        name: 'Main Workflow',
                        nodes: [],
                        edges: [],
                    });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchMainWorkflow();

        return () => {
            cancelled = true;
        };
    }, [apiClient, businessId, businessLoading]);

    const handleSaveWorkflow = async (nodes: Node[], edges: Edge[]) => {
        if (!businessId) return;

        try {
            const payload = {
                name: workflowData?.name || 'Main Workflow',
                description: 'Main business workflow',
                graphJson: {
                    nodes: nodes.map(n => ({
                        id: n.id,
                        type: n.type,
                        position: n.position,
                        data: n.data,
                    })),
                    edges: edges.map(e => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        label: e.label,
                    })),
                },
            };

            if (workflowData?.id) {
                await apiClient.post(
                    `/businesses/${businessId}/workflows/${workflowData.id}/versions`,
                    payload,
                );
            } else {
                const newWorkflow = await apiClient.post<WorkflowDetail>(
                    `/businesses/${businessId}/workflows`,
                    payload,
                );
                setWorkflowData({
                    id: newWorkflow.id,
                    name: payload.name,
                    nodes,
                    edges,
                });
            }
            
            alert('Workflow saved successfully!');
        } catch (err) {
            console.error('Failed to save workflow:', err);
            alert('Failed to save workflow. Please try again.');
        }
    };

    if (loading || businessLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2 text-sm text-muted-foreground">
                    {businessLoading ? 'Loading business...' : 'Loading workflow...'}
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-950 neo-inset">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                    Legacy internal-only route. Practice Setup remains the customer-facing source of truth, and Voice Runtime V2 no longer depends on editing customer workflows directly.
                </span>
            </div>
            {!businessId && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-950 neo-inset">
                    <span>
                        No business selected. Set up your practice in{' '}
                        <a href="/dashboard/settings" className="font-semibold text-primary underline underline-offset-2">
                            Settings
                        </a>{' '}
                        to review the current practice policy before using this legacy editor.
                    </span>
                </div>
            )}
            {businessId && workflowData && (
                <EnhancedWorkflowEditor
                    workflowId={workflowData.id}
                    workflowName={workflowData.name}
                    initialNodes={workflowData.nodes}
                    initialEdges={workflowData.edges}
                    onSave={handleSaveWorkflow}
                />
            )}
        </div>
    );
}
