"use client";

import { useState, useEffect } from "react";
import { EnhancedWorkflowEditor } from "@/components/workflow/EnhancedWorkflowEditor";
import { useApiClient } from "@/lib/api-client";
import { useHospital } from "@/lib/hospital-context";
import { Loader2 } from "lucide-react";
import { Node, Edge } from '@xyflow/react';

export default function WorkflowsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const apiClient = useApiClient();
    const [workflowData, setWorkflowData] = useState<{ nodes: Node[], edges: Edge[], id?: string, name: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // When no hospital context yet, wait
        if (hospitalLoading) {
            console.log('[Workflows] Waiting for hospital context...');
            return;
        }

        const fetchMainWorkflow = async () => {
            console.log('[Workflows] Starting fetch, hospitalId:', hospitalId);
            try {
                setLoading(true);
                setError(null);

                // If we have a hospitalId, try to fetch workflows
                if (hospitalId) {
                    try {
                        console.log('[Workflows] Fetching workflows for hospital:', hospitalId);
                        const workflows = await apiClient.get<any[]>(`/hospitals/${hospitalId}/workflows`);
                        console.log('[Workflows] Got workflows:', workflows);

                        if (workflows && workflows.length > 0) {
                            const mainWorkflow = workflows.find((w: any) => w.isMain) || workflows[0];
                            console.log('[Workflows] Main workflow:', mainWorkflow);
                            const fullWorkflow = await apiClient.get<any>(`/hospitals/${hospitalId}/workflows/${mainWorkflow.id}`);
                            console.log('[Workflows] Full workflow:', fullWorkflow);

                            if (fullWorkflow?.versions?.length > 0) {
                                const graphJson = fullWorkflow.versions[0].graphJson || {};

                                // Transform API format to React Flow format:
                                // - API uses config, React Flow uses data
                                // - API may use fromNodeId/toNodeId, React Flow uses source/target
                                const nodes = (graphJson.nodes || []).map((node: any, index: number) => {
                                    const config = node.data || node.config || {};
                                    return {
                                        id: node.id,
                                        type: node.type || 'default',
                                        position: node.position || { x: 100 + index * 80, y: 100 + index * 80 },
                                        data: { label: config.label || config.message || node.type || 'Node', ...config },
                                    };
                                });

                                const edges = (graphJson.edges || []).map((edge: any) => ({
                                    id: edge.id || `edge-${edge.source || edge.fromNodeId}-${edge.target || edge.toNodeId}`,
                                    source: edge.source ?? edge.fromNodeId,
                                    target: edge.target ?? edge.toNodeId,
                                    label: edge.label,
                                    animated: edge.animated ?? false,
                                }));

                                const data = {
                                    id: fullWorkflow.id,
                                    name: fullWorkflow.name || 'Main Workflow',
                                    nodes,
                                    edges,
                                };
                                console.log('[Workflows] Setting workflow data:', data);
                                setWorkflowData(data);
                                setLoading(false);
                                console.log('[Workflows] Loading complete, workflowData set');
                                return;
                            }
                        }
                    } catch (fetchError) {
                        console.log('[Workflows] No existing workflows found, starting with empty canvas', fetchError);
                    }
                }

                // No hospital, no workflows, or fetch failed: show empty canvas
                console.log('[Workflows] Setting empty canvas');
                setWorkflowData({
                    name: 'Main Workflow',
                    nodes: [],
                    edges: [],
                });
            } catch (err) {
                console.error('[Workflows] Failed to fetch main workflow:', err);
                setWorkflowData({
                    name: 'Main Workflow',
                    nodes: [],
                    edges: [],
                });
            } finally {
                console.log('[Workflows] Finally block - setting loading to false');
                setLoading(false);
            }
        };

        fetchMainWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hospitalId, hospitalLoading]);

    const handleSaveWorkflow = async (nodes: Node[], edges: Edge[]) => {
        if (!hospitalId) return;

        try {
            const payload = {
                name: workflowData?.name || 'Main Workflow',
                description: 'Main hospital workflow',
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
                // Update existing workflow version
                await apiClient.post(`/hospitals/${hospitalId}/workflows/${workflowData.id}/versions`, payload);
            } else {
                // Create new workflow
                const newWorkflow = await apiClient.post(`/hospitals/${hospitalId}/workflows`, {
                    ...payload,
                    isMain: true,
                });
                setWorkflowData({ ...workflowData, id: newWorkflow.id, name: payload.name, nodes, edges });
            }
            
            alert('Workflow saved successfully!');
        } catch (err) {
            console.error('Failed to save workflow:', err);
            alert('Failed to save workflow. Please try again.');
        }
    };

    console.log('[Workflows] Render - loading:', loading, 'hospitalLoading:', hospitalLoading, 'workflowData:', workflowData);

    if (loading || hospitalLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2 text-sm text-muted-foreground">
                    {hospitalLoading ? 'Loading hospital...' : 'Loading workflow...'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {!hospitalId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                    <span className="text-amber-700 text-sm">
                        No hospital selected. Set up your hospital in{" "}
                        <a href="/dashboard/settings" className="underline font-medium">Settings</a> to save workflows.
                    </span>
                </div>
            )}
            {workflowData && (
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
