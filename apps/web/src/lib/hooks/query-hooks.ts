"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api-client';
import { useBusiness } from '../business-context';
import {
    createAgentsService,
    createBusinessService,
    createCallsService,
    createFollowUpTasksService,
    createIntegrationsService,
    createTeamService,
    createWorkflowsService,
} from '../api-services';
import type {
    AgentCatalogItem,
    AgentListItem,
    AgentStats,
    BusinessIntegration,
    BusinessSettings,
    CallAnalytics,
    CallDetail,
    CallListItem,
    FollowUpTask,
    PaginatedResponse,
    TeamMember,
    VoicemailRecord,
    WorkflowDetail,
    WorkflowListItem,
} from '../api-types';

export const queryKeys = {
    calls: (businessId: string) => ['calls', businessId] as const,
    callsList: (businessId: string, filters?: Record<string, unknown>) =>
        [...queryKeys.calls(businessId), 'list', filters] as const,
    callDetail: (businessId: string, callId: string) =>
        [...queryKeys.calls(businessId), 'detail', callId] as const,
    callAnalytics: (businessId: string, startDate: string, endDate: string) =>
        [...queryKeys.calls(businessId), 'analytics', startDate, endDate] as const,
    voicemails: (businessId: string, unlistenedOnly?: boolean) =>
        ['voicemails', businessId, unlistenedOnly] as const,

    workflows: (businessId: string) => ['workflows', businessId] as const,
    workflowsList: (businessId: string) => [...queryKeys.workflows(businessId), 'list'] as const,
    workflowDetail: (businessId: string, workflowId: string) =>
        [...queryKeys.workflows(businessId), 'detail', workflowId] as const,

    team: (businessId: string) => ['team', businessId] as const,
    teamMembers: (businessId: string) => [...queryKeys.team(businessId), 'members'] as const,

    businesses: () => ['businesses'] as const,
    businessDetail: (businessId: string) => ['business', businessId] as const,

    agents: (businessId: string) => ['agents', businessId] as const,
    agentsList: (businessId: string) => [...queryKeys.agents(businessId), 'list'] as const,
    agentDetail: (businessId: string, agentId: string) =>
        [...queryKeys.agents(businessId), 'detail', agentId] as const,
    agentCatalog: (businessId: string) => [...queryKeys.agents(businessId), 'catalog'] as const,
    agentStats: (businessId: string, agentId: string) =>
        [...queryKeys.agents(businessId), 'stats', agentId] as const,

    integrations: (businessId: string) => ['integrations', businessId] as const,
    integrationDetail: (businessId: string, category: string) =>
        [...queryKeys.integrations(businessId), category] as const,

    followUpTasks: (businessId: string, filters?: Record<string, unknown>) =>
        ['follow-up-tasks', businessId, filters] as const,

};

export function useCalls(filters?: {
    status?: string;
    tag?: string;
    isEmergency?: boolean;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    page?: number;
    pageSize?: number;
}) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.callsList(businessId || '', filters),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createCallsService(client, businessId).getCalls(filters);
        },
        enabled: !!businessId,
        placeholderData: (prev) => prev,
    });
}

export function useCall(callId: string | null) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.callDetail(businessId || '', callId || ''),
        queryFn: async () => {
            if (!businessId || !callId) throw new Error('Missing business or call ID');
            return createCallsService(client, businessId).getCallById(callId);
        },
        enabled: !!businessId && !!callId,
        staleTime: 1000 * 60 * 5,
    });
}

export function useCallAnalytics(startDate: Date, endDate: Date) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.callAnalytics(
            businessId || '',
            startDate.toISOString(),
            endDate.toISOString(),
        ),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createCallsService(client, businessId).getAnalytics(startDate, endDate);
        },
        enabled: !!businessId,
        staleTime: 1000 * 60,
        refetchInterval: 1000 * 60 * 2,
    });
}

export function useVoicemails(unlistenedOnly = false) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.voicemails(businessId || '', unlistenedOnly),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createCallsService(client, businessId).getVoicemails(unlistenedOnly);
        },
        enabled: !!businessId,
        staleTime: 1000 * 30,
    });
}

export function useMarkVoicemailListened() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (voicemailId: string) => {
            if (!businessId) throw new Error('No business selected');
            return createCallsService(client, businessId).markVoicemailListened(voicemailId);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: ['voicemails', businessId] });
                queryClient.invalidateQueries({ queryKey: queryKeys.calls(businessId) });
            }
        },
    });
}

export function usePrefetchCall() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return (callId: string) => {
        if (!businessId || !callId) return;

        queryClient.prefetchQuery({
            queryKey: queryKeys.callDetail(businessId, callId),
            queryFn: async () => createCallsService(client, businessId).getCallById(callId),
            staleTime: 1000 * 60 * 5,
        });
    };
}

export function usePrefetchCallsPage() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return (filters: {
        status?: string;
        tag?: string;
        search?: string;
        page: number;
        pageSize?: number;
    }) => {
        if (!businessId) return;

        queryClient.prefetchQuery({
            queryKey: queryKeys.callsList(businessId, filters),
            queryFn: async () => createCallsService(client, businessId).getCalls(filters),
            staleTime: 1000 * 60 * 2,
        });
    };
}

export function useWorkflows() {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.workflowsList(businessId || ''),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createWorkflowsService(client, businessId).getWorkflows();
        },
        enabled: !!businessId,
    });
}

export function useWorkflow(workflowId: string | null) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.workflowDetail(businessId || '', workflowId || ''),
        queryFn: async () => {
            if (!businessId || !workflowId) throw new Error('Missing business or workflow ID');
            return createWorkflowsService(client, businessId).getWorkflowById(workflowId);
        },
        enabled: !!businessId && !!workflowId,
    });
}

export function useCreateWorkflow() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; description?: string; userId?: string; graphJson?: unknown }) => {
            if (!businessId) throw new Error('No business selected');
            return createWorkflowsService(client, businessId).createWorkflow(data);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.workflowsList(businessId) });
            }
        },
    });
}

export function useTeamMembers() {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.teamMembers(businessId || ''),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createTeamService(client, businessId).getTeamMembers();
        },
        enabled: !!businessId,
        staleTime: 1000 * 60 * 5,
    });
}

export function useInviteUser() {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useMutation({
        mutationFn: async (data: { email: string; role: string }) => {
            if (!businessId) throw new Error('No business selected');
            return createTeamService(client, businessId).inviteUser(data);
        },
    });
}

export function useBusinessSettings(businessIdOverride?: string) {
    const client = useApiClient();
    const { businessId: contextBusinessId } = useBusiness();
    const businessId = businessIdOverride || contextBusinessId;

    return useQuery({
        queryKey: queryKeys.businessDetail(businessId || ''),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createBusinessService(client).getBusinessById(businessId);
        },
        enabled: !!businessId,
        staleTime: 1000 * 60 * 10,
    });
}

export function useBusinesses() {
    const client = useApiClient();

    return useQuery({
        queryKey: queryKeys.businesses(),
        queryFn: async () => createBusinessService(client).getBusinesses(),
        staleTime: 1000 * 60 * 5,
    });
}

export function useUpdateBusiness() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<BusinessSettings>) => {
            if (!businessId) throw new Error('No business selected');
            return createBusinessService(client).updateBusiness(businessId, data);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.businessDetail(businessId) });
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.businesses() });
        },
    });
}

export function useUpdateBusinessSettings() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<NonNullable<BusinessSettings['settings']>>) => {
            if (!businessId) throw new Error('No business selected');
            return createBusinessService(client).updateBusinessSettings(businessId, data);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.businessDetail(businessId) });
            }
        },
    });
}

export function useAgents() {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.agentsList(businessId || ''),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createAgentsService(client, businessId).getAgents();
        },
        enabled: !!businessId,
    });
}

export function useAgent(agentId: string | null) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.agentDetail(businessId || '', agentId || ''),
        queryFn: async () => {
            if (!businessId || !agentId) throw new Error('Missing business or agent ID');
            return createAgentsService(client, businessId).getAgentById(agentId);
        },
        enabled: !!businessId && !!agentId,
        staleTime: 1000 * 60 * 2,
    });
}

export function useAgentCatalog() {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.agentCatalog(businessId || ''),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createAgentsService(client, businessId).getCatalog();
        },
        enabled: !!businessId,
        staleTime: 1000 * 60 * 10,
    });
}

export function useAgentStats(agentId: string | null) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.agentStats(businessId || '', agentId || ''),
        queryFn: async () => {
            if (!businessId || !agentId) throw new Error('Missing business or agent ID');
            return createAgentsService(client, businessId).getAgentStats(agentId);
        },
        enabled: !!businessId && !!agentId,
        staleTime: 1000 * 30,
    });
}

export function useDeployAgent() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (catalogId: string) => {
            if (!businessId) throw new Error('No business selected');
            return createAgentsService(client, businessId).deployAgent(catalogId);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.agents(businessId) });
            }
        },
    });
}

export function useUpdateAgentStatus() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ agentId, status }: { agentId: string; status: AgentListItem['status'] }) => {
            if (!businessId) throw new Error('No business selected');
            return createAgentsService(client, businessId).updateAgentStatus(agentId, status);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.agents(businessId) });
            }
        },
    });
}

export function useUpdateAgentToolConfig() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ agentId, toolConfig }: { agentId: string; toolConfig: Record<string, unknown> }) => {
            if (!businessId) throw new Error('No business selected');
            return createAgentsService(client, businessId).updateAgentToolConfig(agentId, toolConfig);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.agents(businessId) });
            }
        },
    });
}

export function useUndeployAgent() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (agentId: string) => {
            if (!businessId) throw new Error('No business selected');
            return createAgentsService(client, businessId).deleteAgent(agentId);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.agents(businessId) });
            }
        },
    });
}

export function useIntegrations() {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.integrations(businessId || ''),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createIntegrationsService(client, businessId).getIntegrations();
        },
        enabled: !!businessId,
        staleTime: 1000 * 60,
    });
}

export function useFollowUpTasks(filters?: {
    type?: string;
    status?: string;
    priority?: string;
    search?: string;
}) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.followUpTasks(businessId || '', filters),
        queryFn: async () => {
            if (!businessId) throw new Error('No business selected');
            return createFollowUpTasksService(client, businessId).getFollowUpTasks(filters);
        },
        enabled: !!businessId,
        staleTime: 1000 * 30,
    });
}

export function useUpdateFollowUpTaskStatus() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ taskId, status }: { taskId: string; status: FollowUpTask['status'] }) => {
            if (!businessId) throw new Error('No business selected');
            return createFollowUpTasksService(client, businessId).updateFollowUpTaskStatus(taskId, status);
        },
        onSuccess: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: ['follow-up-tasks', businessId] });
                queryClient.invalidateQueries({ queryKey: ['voicemails', businessId] });
                queryClient.invalidateQueries({ queryKey: queryKeys.calls(businessId) });
            }
        },
    });
}

export function useIntegration(category: string | null) {
    const client = useApiClient();
    const { businessId } = useBusiness();

    return useQuery({
        queryKey: queryKeys.integrationDetail(businessId || '', category || ''),
        queryFn: async () => {
            if (!businessId || !category) throw new Error('Missing business or integration category');
            return createIntegrationsService(client, businessId).getIntegration(category);
        },
        enabled: !!businessId && !!category,
        staleTime: 1000 * 60,
    });
}

export function useUpsertIntegration() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            category,
            data,
        }: {
            category: string;
            data: {
                vendor: string;
                status?: string;
                credentialsRef?: string;
                settings?: Record<string, unknown>;
                capabilities?: Record<string, unknown>;
            };
        }) => {
            if (!businessId) throw new Error('No business selected');
            return createIntegrationsService(client, businessId).upsertIntegration(category, data);
        },
        onSuccess: (_result, variables) => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.integrations(businessId) });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.integrationDetail(businessId, variables.category),
                });
            }
        },
    });
}

export function useTestIntegration() {
    const client = useApiClient();
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (category: string) => {
            if (!businessId) throw new Error('No business selected');
            return createIntegrationsService(client, businessId).testIntegration(category);
        },
        onSuccess: (_result, category) => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.integrations(businessId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.integrationDetail(businessId, category) });
            }
        },
    });
}

export function useCacheInvalidation() {
    const { businessId } = useBusiness();
    const queryClient = useQueryClient();

    return {
        invalidateCalls: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.calls(businessId) });
            }
        },
        invalidateWorkflows: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.workflows(businessId) });
            }
        },
        invalidateTeam: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.team(businessId) });
            }
        },
        invalidateAgents: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.agents(businessId) });
            }
        },
        invalidateIntegrations: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.integrations(businessId) });
            }
        },
        invalidateFollowUpTasks: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: ['follow-up-tasks', businessId] });
            }
        },
        invalidateAll: () => {
            queryClient.invalidateQueries();
        },
    };
}

export type {
    AgentCatalogItem,
    AgentListItem,
    AgentStats,
    BusinessIntegration,
    BusinessSettings,
    CallAnalytics,
    CallDetail,
    CallListItem,
    FollowUpTask,
    PaginatedResponse,
    TeamMember,
    VoicemailRecord,
    WorkflowDetail,
    WorkflowListItem,
};
