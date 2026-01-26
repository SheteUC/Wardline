"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api-client';
import { useHospital } from '../hospital-context';
import {
    createCallsService,
    createWorkflowsService,
    createTeamService,
    createHospitalService,
    createAgentsService,
    createQueuesService,
} from '../api-services';
import type {
    CallListItem,
    CallDetail,
    CallAnalytics,
    WorkflowListItem,
    WorkflowDetail,
    TeamMember,
    HospitalSettings,
    PaginatedResponse,
} from '../api-types';

/**
 * React Query hooks for data fetching with performance optimizations:
 * - Automatic caching and deduplication
 * - Background refetching for fresh data
 * - Optimistic updates for mutations
 * - Prefetching support for instant navigation
 */

// ============ Query Key Factories ============
// Centralized query keys for consistent cache management

export const queryKeys = {
    // Calls
    calls: (hospitalId: string) => ['calls', hospitalId] as const,
    callsList: (hospitalId: string, filters?: Record<string, unknown>) =>
        [...queryKeys.calls(hospitalId), 'list', filters] as const,
    callDetail: (hospitalId: string, callId: string) =>
        [...queryKeys.calls(hospitalId), 'detail', callId] as const,
    callAnalytics: (hospitalId: string, startDate: string, endDate: string) =>
        [...queryKeys.calls(hospitalId), 'analytics', startDate, endDate] as const,

    // Workflows
    workflows: (hospitalId: string) => ['workflows', hospitalId] as const,
    workflowsList: (hospitalId: string) => [...queryKeys.workflows(hospitalId), 'list'] as const,
    workflowDetail: (hospitalId: string, workflowId: string) =>
        [...queryKeys.workflows(hospitalId), 'detail', workflowId] as const,

    // Team
    team: (hospitalId: string) => ['team', hospitalId] as const,
    teamMembers: (hospitalId: string) => [...queryKeys.team(hospitalId), 'members'] as const,

    // Hospitals
    hospitals: () => ['hospitals'] as const,
    hospitalDetail: (hospitalId: string) => ['hospital', hospitalId] as const,

    // Agents (Multi-Agent Platform)
    agents: (hospitalId: string) => ['agents', hospitalId] as const,
    agentsList: (hospitalId: string, filters?: Record<string, unknown>) =>
        [...queryKeys.agents(hospitalId), 'list', filters] as const,
    agentDetail: (hospitalId: string, agentId: string) =>
        [...queryKeys.agents(hospitalId), 'detail', agentId] as const,
    agentMetrics: (hospitalId: string, agentId: string, startDate?: string, endDate?: string) =>
        [...queryKeys.agents(hospitalId), 'metrics', agentId, startDate, endDate] as const,
    agentCalls: (hospitalId: string, agentId: string, page: number) =>
        [...queryKeys.agents(hospitalId), 'calls', agentId, page] as const,
    agentSession: (hospitalId: string, agentId: string) =>
        [...queryKeys.agents(hospitalId), 'session', agentId] as const,

    // Queues (Multi-Agent Platform)
    queues: (hospitalId: string) => ['queues', hospitalId] as const,
    queuesList: (hospitalId: string, filters?: Record<string, unknown>) =>
        [...queryKeys.queues(hospitalId), 'list', filters] as const,
    queueDetail: (hospitalId: string, queueId: string) =>
        [...queryKeys.queues(hospitalId), 'detail', queueId] as const,
    queueMetrics: (hospitalId: string, queueId: string, startDate?: string, endDate?: string) =>
        [...queryKeys.queues(hospitalId), 'metrics', queueId, startDate, endDate] as const,
    assignments: (hospitalId: string, filters?: Record<string, unknown>) =>
        ['assignments', hospitalId, filters] as const,
};

// ============ Calls Hooks ============

export function useCalls(filters?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    page?: number;
    pageSize?: number;
}) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.callsList(hospitalId || '', filters),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createCallsService(client, hospitalId);
            return service.getCalls(filters);
        },
        enabled: !!hospitalId,
        // Keep previous data while loading new page for smoother pagination
        placeholderData: (prev) => prev,
    });
}

export function useCall(callId: string | null) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.callDetail(hospitalId || '', callId || ''),
        queryFn: async () => {
            if (!hospitalId || !callId) throw new Error('Missing hospital or call ID');
            const service = createCallsService(client, hospitalId);
            return service.getCallById(callId);
        },
        enabled: !!hospitalId && !!callId,
        // Call details don't change often, can be stale longer
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

export function useCallAnalytics(startDate: Date, endDate: Date) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.callAnalytics(
            hospitalId || '',
            startDate.toISOString(),
            endDate.toISOString()
        ),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createCallsService(client, hospitalId);
            return service.getAnalytics(startDate, endDate);
        },
        enabled: !!hospitalId,
        // Analytics change frequently during business hours
        staleTime: 1000 * 60 * 1, // 1 minute
        // Refetch in background every 2 minutes for live dashboards
        refetchInterval: 1000 * 60 * 2,
    });
}

// ============ Prefetching Hooks ============

/**
 * Hook to prefetch call details when hovering over a call row
 * This makes navigation feel instant
 */
export function usePrefetchCall() {
    const client = useApiClient();
    const { hospitalId } = useHospital();
    const queryClient = useQueryClient();

    return (callId: string) => {
        if (!hospitalId || !callId) return;

        queryClient.prefetchQuery({
            queryKey: queryKeys.callDetail(hospitalId, callId),
            queryFn: async () => {
                const service = createCallsService(client, hospitalId);
                return service.getCallById(callId);
            },
            staleTime: 1000 * 60 * 5,
        });
    };
}

/**
 * Hook to prefetch the next page of calls for smoother pagination
 */
export function usePrefetchCallsPage() {
    const client = useApiClient();
    const { hospitalId } = useHospital();
    const queryClient = useQueryClient();

    return (filters: {
        status?: string;
        search?: string;
        page: number;
        pageSize?: number;
    }) => {
        if (!hospitalId) return;

        queryClient.prefetchQuery({
            queryKey: queryKeys.callsList(hospitalId, filters),
            queryFn: async () => {
                const service = createCallsService(client, hospitalId);
                return service.getCalls(filters);
            },
            staleTime: 1000 * 60 * 2,
        });
    };
}

// ============ Workflows Hooks ============

export function useWorkflows() {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.workflowsList(hospitalId || ''),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createWorkflowsService(client, hospitalId);
            return service.getWorkflows();
        },
        enabled: !!hospitalId,
    });
}

export function useWorkflow(workflowId: string | null) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.workflowDetail(hospitalId || '', workflowId || ''),
        queryFn: async () => {
            if (!hospitalId || !workflowId) throw new Error('Missing hospital or workflow ID');
            const service = createWorkflowsService(client, hospitalId);
            return service.getWorkflowById(workflowId);
        },
        enabled: !!hospitalId && !!workflowId,
    });
}

export function useCreateWorkflow() {
    const client = useApiClient();
    const { hospitalId } = useHospital();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; description?: string; userId: string }) => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createWorkflowsService(client, hospitalId);
            return service.createWorkflow(data);
        },
        onSuccess: () => {
            // Invalidate workflows list to refetch
            queryClient.invalidateQueries({ queryKey: queryKeys.workflowsList(hospitalId || '') });
        },
    });
}

// ============ Team Hooks ============

export function useTeamMembers() {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.teamMembers(hospitalId || ''),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createTeamService(client, hospitalId);
            return service.getTeamMembers();
        },
        enabled: !!hospitalId,
        // Team members don't change often
        staleTime: 1000 * 60 * 5,
    });
}

export function useInviteUser() {
    const client = useApiClient();
    const { hospitalId } = useHospital();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { email: string; role: string }) => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createTeamService(client, hospitalId);
            return service.inviteUser(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers(hospitalId || '') });
        },
    });
}

// ============ Hospital/Settings Hooks ============

export function useHospitalSettings(hospitalIdOverride?: string) {
    const client = useApiClient();
    const { hospitalId: contextHospitalId } = useHospital();
    const hospitalId = hospitalIdOverride || contextHospitalId;

    return useQuery({
        queryKey: queryKeys.hospitalDetail(hospitalId || ''),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createHospitalService(client);
            return service.getHospitalById(hospitalId);
        },
        enabled: !!hospitalId,
        // Hospital settings rarely change
        staleTime: 1000 * 60 * 10,
    });
}

export function useHospitals() {
    const client = useApiClient();

    return useQuery({
        queryKey: queryKeys.hospitals(),
        queryFn: async () => {
            const service = createHospitalService(client);
            return service.getHospitals();
        },
        // Hospital list is fairly static
        staleTime: 1000 * 60 * 5,
    });
}

export function useUpdateHospital() {
    const client = useApiClient();
    const { hospitalId } = useHospital();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<HospitalSettings>) => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createHospitalService(client);
            return service.updateHospital(hospitalId, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.hospitalDetail(hospitalId || '') });
            queryClient.invalidateQueries({ queryKey: queryKeys.hospitals() });
        },
    });
}

// ============ Agents Hooks (Multi-Agent Platform) ============

export function useAgents(filters?: {
    type?: 'AI' | 'HUMAN';
    status?: string;
    page?: number;
    limit?: number;
}) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.agentsList(hospitalId || '', filters),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createAgentsService(client, hospitalId);
            return service.getAgents(filters);
        },
        enabled: !!hospitalId,
        placeholderData: (prev) => prev,
    });
}

export function useAgent(agentId: string | null) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.agentDetail(hospitalId || '', agentId || ''),
        queryFn: async () => {
            if (!hospitalId || !agentId) throw new Error('Missing hospital or agent ID');
            const service = createAgentsService(client, hospitalId);
            return service.getAgentById(agentId);
        },
        enabled: !!hospitalId && !!agentId,
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}

export function useAgentMetrics(agentId: string | null, startDate?: Date, endDate?: Date) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.agentMetrics(
            hospitalId || '',
            agentId || '',
            startDate?.toISOString(),
            endDate?.toISOString()
        ),
        queryFn: async () => {
            if (!hospitalId || !agentId) throw new Error('Missing hospital or agent ID');
            const service = createAgentsService(client, hospitalId);
            return service.getAgentMetrics(agentId, startDate, endDate);
        },
        enabled: !!hospitalId && !!agentId,
    });
}

export function useAgentSession(agentId: string | null) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.agentSession(hospitalId || '', agentId || ''),
        queryFn: async () => {
            if (!hospitalId || !agentId) throw new Error('Missing hospital or agent ID');
            const service = createAgentsService(client, hospitalId);
            return service.getAgentSession(agentId);
        },
        enabled: !!hospitalId && !!agentId,
        refetchInterval: 5000, // Refetch every 5 seconds for real-time status
    });
}

// ============ Queues Hooks (Multi-Agent Platform) ============

export function useQueues(filters?: {
    specialization?: string;
    page?: number;
    limit?: number;
}) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.queuesList(hospitalId || '', filters),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createQueuesService(client, hospitalId);
            return service.getQueues(filters);
        },
        enabled: !!hospitalId,
        placeholderData: (prev) => prev,
    });
}

export function useQueue(queueId: string | null) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.queueDetail(hospitalId || '', queueId || ''),
        queryFn: async () => {
            if (!hospitalId || !queueId) throw new Error('Missing hospital or queue ID');
            const service = createQueuesService(client, hospitalId);
            return service.getQueueById(queueId);
        },
        enabled: !!hospitalId && !!queueId,
        staleTime: 1000 * 30, // 30 seconds
    });
}

export function useQueueMetrics(queueId: string | null, startDate?: Date, endDate?: Date) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.queueMetrics(
            hospitalId || '',
            queueId || '',
            startDate?.toISOString(),
            endDate?.toISOString()
        ),
        queryFn: async () => {
            if (!hospitalId || !queueId) throw new Error('Missing hospital or queue ID');
            const service = createQueuesService(client, hospitalId);
            return service.getQueueMetrics(queueId, startDate, endDate);
        },
        enabled: !!hospitalId && !!queueId,
        refetchInterval: 10000, // Refetch every 10 seconds for real-time metrics
    });
}

export function useAssignments(filters?: {
    status?: string;
    agentId?: string;
    queueId?: string;
    page?: number;
    limit?: number;
}) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: queryKeys.assignments(hospitalId || '', filters),
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createQueuesService(client, hospitalId);
            return service.getAssignments(filters);
        },
        enabled: !!hospitalId,
        refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
        placeholderData: (prev) => prev,
    });
}

// ============ Cache Invalidation Helpers ============

/**
 * Hook to get cache invalidation functions
 * Useful for manual cache updates after actions
 */
export function useCacheInvalidation() {
    const { hospitalId } = useHospital();
    const queryClient = useQueryClient();

    return {
        invalidateCalls: () => {
            if (hospitalId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.calls(hospitalId) });
            }
        },
        invalidateWorkflows: () => {
            if (hospitalId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.workflows(hospitalId) });
            }
        },
        invalidateTeam: () => {
            if (hospitalId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.team(hospitalId) });
            }
        },
        invalidateAgents: () => {
            if (hospitalId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.agents(hospitalId) });
            }
        },
        invalidateQueues: () => {
            if (hospitalId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.queues(hospitalId) });
            }
        },
        invalidateAssignments: () => {
            if (hospitalId) {
                queryClient.invalidateQueries({ queryKey: ['assignments', hospitalId] });
            }
        },
        invalidateAll: () => {
            queryClient.invalidateQueries();
        },
    };
}
