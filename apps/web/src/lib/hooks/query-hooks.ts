"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CallStatus } from '@wardline/types';
import { useApiClient } from '../api-client';
import { useBusiness } from '../business-context';
import {
    createBusinessService,
    createCallsService,
    createFollowUpTasksService,
    createIntegrationsService,
    createTeamService,
} from '../api-services';
import type {
    BusinessIntegration,
    BusinessSettings,
    CallAnalytics,
    CallDetail,
    CallListItem,
    FollowUpTask,
    PaginatedResponse,
    TeamMember,
    VoicemailRecord,
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

    team: (businessId: string) => ['team', businessId] as const,
    teamMembers: (businessId: string) => [...queryKeys.team(businessId), 'members'] as const,

    businesses: () => ['businesses'] as const,
    businessDetail: (businessId: string) => ['business', businessId] as const,

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
        staleTime: 1000 * 5,
        refetchInterval: 1000 * 10,
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
        staleTime: 1000 * 15,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === CallStatus.INITIATED || status === CallStatus.ONGOING
                ? 1000 * 5
                : 1000 * 15;
        },
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
        invalidateTeam: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.team(businessId) });
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
    BusinessIntegration,
    BusinessSettings,
    CallAnalytics,
    CallDetail,
    CallListItem,
    FollowUpTask,
    PaginatedResponse,
    TeamMember,
    VoicemailRecord,
};
