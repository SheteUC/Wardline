"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
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
    callsListRoot: (businessId: string) => [...queryKeys.calls(businessId), 'list'] as const,
    callsList: (businessId: string, filters?: Record<string, unknown>) =>
        [...queryKeys.calls(businessId), 'list', filters] as const,
    callDetailRoot: (businessId: string) => [...queryKeys.calls(businessId), 'detail'] as const,
    callDetail: (businessId: string, callId: string) =>
        [...queryKeys.calls(businessId), 'detail', callId] as const,
    callAnalytics: (businessId: string, startDate: string, endDate: string) =>
        [...queryKeys.calls(businessId), 'analytics', startDate, endDate] as const,
    voicemailsRoot: (businessId: string) => ['voicemails', businessId] as const,
    voicemails: (businessId: string, unlistenedOnly?: boolean) =>
        ['voicemails', businessId, unlistenedOnly] as const,

    team: (businessId: string) => ['team', businessId] as const,
    teamMembers: (businessId: string) => [...queryKeys.team(businessId), 'members'] as const,

    businesses: () => ['businesses'] as const,
    businessDetail: (businessId: string) => ['business', businessId] as const,

    integrations: (businessId: string) => ['integrations', businessId] as const,
    integrationDetail: (businessId: string, category: string) =>
        [...queryKeys.integrations(businessId), category] as const,

    followUpTasksRoot: (businessId: string) => ['follow-up-tasks', businessId] as const,
    followUpTasks: (businessId: string, filters?: Record<string, unknown>) =>
        ['follow-up-tasks', businessId, filters] as const,

};

type QuerySnapshot<T> = Array<[QueryKey, T | undefined]>;

type BusinessSettingsPayload = NonNullable<BusinessSettings['settings']>;

function captureSnapshots<T>(queryClient: QueryClient, queryKey: readonly unknown[]): QuerySnapshot<T> {
    return queryClient.getQueriesData<T>({ queryKey }) as QuerySnapshot<T>;
}

function restoreSnapshots<T>(queryClient: QueryClient, snapshots: QuerySnapshot<T>) {
    for (const [queryKey, value] of snapshots) {
        queryClient.setQueryData(queryKey, value);
    }
}

function applyDefinedPatch<T extends object>(current: T, patch: Partial<T>): T {
    const next = { ...current };

    for (const [key, value] of Object.entries(patch) as Array<[keyof T, T[keyof T] | undefined]>) {
        if (value !== undefined) {
            next[key] = value;
        }
    }

    return next;
}

function mergeBusinessSettings(
    current: BusinessSettingsPayload | undefined,
    patch: Partial<BusinessSettingsPayload>,
): BusinessSettingsPayload | undefined {
    if (!current) {
        return current;
    }

    return applyDefinedPatch(current, patch);
}

function mergeBusinessRecord(
    current: BusinessSettings | undefined,
    patch: Partial<BusinessSettings>,
): BusinessSettings | undefined {
    if (!current) {
        return current;
    }

    return {
        ...applyDefinedPatch(current, patch),
        settings:
            patch.settings === undefined
                ? current.settings
                : mergeBusinessSettings(current.settings, patch.settings),
    };
}

function replaceBusinessInList(
    current: BusinessSettings[] | undefined,
    businessId: string,
    updater: (business: BusinessSettings) => BusinessSettings,
): BusinessSettings[] | undefined {
    return current?.map((business) => (business.id === businessId ? updater(business) : business));
}

function updateCallList(
    current: PaginatedResponse<CallListItem> | undefined,
    callId: string,
    updater: (call: CallListItem) => CallListItem,
): PaginatedResponse<CallListItem> | undefined {
    if (!current) {
        return current;
    }

    return {
        ...current,
        data: current.data.map((call) => (call.id === callId ? updater(call) : call)),
    };
}

function updateCallDetail(
    current: CallDetail | undefined,
    callId: string,
    updater: (call: CallDetail) => CallDetail,
): CallDetail | undefined {
    if (!current || current.id !== callId) {
        return current;
    }

    return updater(current);
}

function isOpenFollowUpStatus(status: FollowUpTask['status']) {
    return status !== 'COMPLETED' && status !== 'CANCELLED';
}

function updateIntegrationList(
    current: BusinessIntegration[] | undefined,
    integration: BusinessIntegration,
): BusinessIntegration[] | undefined {
    if (!current) {
        return [integration];
    }

    const existingIndex = current.findIndex((item) => item.category === integration.category);
    if (existingIndex === -1) {
        return [integration, ...current];
    }

    return current.map((item, index) => (index === existingIndex ? integration : item));
}

function buildOptimisticIntegration(
    businessId: string,
    category: string,
    data: {
        vendor: string;
        status?: string;
        credentialsRef?: string;
        settings?: Record<string, unknown>;
        capabilities?: Record<string, unknown>;
    },
    previous?: BusinessIntegration,
): BusinessIntegration {
    const now = new Date().toISOString();

    return {
        id: previous?.id ?? `optimistic-${category}`,
        businessId,
        category: category as BusinessIntegration['category'],
        vendor: data.vendor,
        status: (data.status as BusinessIntegration['status']) ?? previous?.status ?? 'CONNECTED',
        credentialsRef: data.credentialsRef ?? previous?.credentialsRef,
        settings: data.settings ?? previous?.settings ?? {},
        capabilities: data.capabilities ?? previous?.capabilities ?? {},
        lastHealthCheckAt: previous?.lastHealthCheckAt,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
    };
}

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
        onMutate: async (voicemailId) => {
            if (!businessId) return undefined;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: queryKeys.voicemailsRoot(businessId) }),
                queryClient.cancelQueries({ queryKey: queryKeys.callsListRoot(businessId) }),
                queryClient.cancelQueries({ queryKey: queryKeys.callDetailRoot(businessId) }),
            ]);

            const voicemailSnapshots = captureSnapshots<VoicemailRecord[]>(
                queryClient,
                queryKeys.voicemailsRoot(businessId),
            );
            const callListSnapshots = captureSnapshots<PaginatedResponse<CallListItem>>(
                queryClient,
                queryKeys.callsListRoot(businessId),
            );
            const callDetailSnapshots = captureSnapshots<CallDetail>(
                queryClient,
                queryKeys.callDetailRoot(businessId),
            );

            let impactedCallId: string | null = null;

            queryClient.setQueriesData<VoicemailRecord[]>(
                { queryKey: queryKeys.voicemailsRoot(businessId) },
                (current) =>
                    current?.map((voicemail) => {
                        if (voicemail.id !== voicemailId) {
                            return voicemail;
                        }

                        impactedCallId = voicemail.callId;
                        return { ...voicemail, isListened: true };
                    }),
            );

            if (impactedCallId) {
                queryClient.setQueriesData<PaginatedResponse<CallListItem>>(
                    { queryKey: queryKeys.callsListRoot(businessId) },
                    (current) =>
                        updateCallList(current, impactedCallId!, (call) => ({
                            ...call,
                            voicemailListened: true,
                        })),
                );
                queryClient.setQueriesData<CallDetail>(
                    { queryKey: queryKeys.callDetailRoot(businessId) },
                    (current) =>
                        updateCallDetail(current, impactedCallId!, (call) => ({
                            ...call,
                            voicemails: call.voicemails.map((voicemail) =>
                                voicemail.id === voicemailId
                                    ? { ...voicemail, isListened: true }
                                    : voicemail,
                            ),
                        })),
                );
            }

            return {
                voicemailSnapshots,
                callListSnapshots,
                callDetailSnapshots,
            };
        },
        onError: (_error, _voicemailId, context) => {
            if (!context) {
                return;
            }

            restoreSnapshots(queryClient, context.voicemailSnapshots);
            restoreSnapshots(queryClient, context.callListSnapshots);
            restoreSnapshots(queryClient, context.callDetailSnapshots);
        },
        onSuccess: (voicemail) => {
            if (!businessId) {
                return;
            }

            queryClient.setQueriesData<VoicemailRecord[]>(
                { queryKey: queryKeys.voicemailsRoot(businessId) },
                (current) => current?.map((item) => (item.id === voicemail.id ? voicemail : item)),
            );
            queryClient.setQueriesData<PaginatedResponse<CallListItem>>(
                { queryKey: queryKeys.callsListRoot(businessId) },
                (current) =>
                    updateCallList(current, voicemail.callId, (call) => ({
                        ...call,
                        voicemailListened: true,
                    })),
            );
            queryClient.setQueriesData<CallDetail>(
                { queryKey: queryKeys.callDetailRoot(businessId) },
                (current) =>
                    updateCallDetail(current, voicemail.callId, (call) => ({
                        ...call,
                        voicemails: call.voicemails.map((item) =>
                            item.id === voicemail.id ? { ...item, ...voicemail } : item,
                        ),
                    })),
            );
        },
        onSettled: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.voicemailsRoot(businessId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.callsListRoot(businessId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.callDetailRoot(businessId) });
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
        onMutate: async (data) => {
            if (!businessId) return undefined;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: queryKeys.businessDetail(businessId) }),
                queryClient.cancelQueries({ queryKey: queryKeys.businesses() }),
            ]);

            const businessDetailSnapshots = captureSnapshots<BusinessSettings>(
                queryClient,
                queryKeys.businessDetail(businessId),
            );
            const businessesSnapshots = captureSnapshots<BusinessSettings[]>(
                queryClient,
                queryKeys.businesses(),
            );

            queryClient.setQueryData<BusinessSettings | undefined>(
                queryKeys.businessDetail(businessId),
                (current) => mergeBusinessRecord(current, data),
            );
            queryClient.setQueryData<BusinessSettings[] | undefined>(
                queryKeys.businesses(),
                (current) =>
                    replaceBusinessInList(current, businessId, (business) =>
                        mergeBusinessRecord(business, data) ?? business,
                    ),
            );

            return { businessDetailSnapshots, businessesSnapshots };
        },
        onError: (_error, _data, context) => {
            if (!context) {
                return;
            }

            restoreSnapshots(queryClient, context.businessDetailSnapshots);
            restoreSnapshots(queryClient, context.businessesSnapshots);
        },
        onSuccess: (business) => {
            if (businessId) {
                queryClient.setQueryData(queryKeys.businessDetail(businessId), business);
            }
            queryClient.setQueryData<BusinessSettings[] | undefined>(
                queryKeys.businesses(),
                (current) =>
                    current?.map((item) => (item.id === business.id ? business : item)) ?? [business],
            );
        },
        onSettled: () => {
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
        onMutate: async (data) => {
            if (!businessId) return undefined;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: queryKeys.businessDetail(businessId) }),
                queryClient.cancelQueries({ queryKey: queryKeys.businesses() }),
            ]);

            const businessDetailSnapshots = captureSnapshots<BusinessSettings>(
                queryClient,
                queryKeys.businessDetail(businessId),
            );
            const businessesSnapshots = captureSnapshots<BusinessSettings[]>(
                queryClient,
                queryKeys.businesses(),
            );

            queryClient.setQueryData<BusinessSettings | undefined>(
                queryKeys.businessDetail(businessId),
                (current) =>
                    current
                        ? {
                              ...current,
                              settings: mergeBusinessSettings(current.settings, data),
                          }
                        : current,
            );
            queryClient.setQueryData<BusinessSettings[] | undefined>(
                queryKeys.businesses(),
                (current) =>
                    replaceBusinessInList(current, businessId, (business) => ({
                        ...business,
                        settings: mergeBusinessSettings(business.settings, data),
                    })),
            );

            return { businessDetailSnapshots, businessesSnapshots };
        },
        onError: (_error, _data, context) => {
            if (!context) {
                return;
            }

            restoreSnapshots(queryClient, context.businessDetailSnapshots);
            restoreSnapshots(queryClient, context.businessesSnapshots);
        },
        onSuccess: (settings) => {
            if (!businessId) {
                return;
            }

            const settingsPatch = settings ?? {};

            queryClient.setQueryData<BusinessSettings | undefined>(
                queryKeys.businessDetail(businessId),
                (current) =>
                    current
                        ? {
                              ...current,
                              settings: mergeBusinessSettings(current.settings, settingsPatch),
                          }
                        : current,
            );
            queryClient.setQueryData<BusinessSettings[] | undefined>(
                queryKeys.businesses(),
                (current) =>
                    replaceBusinessInList(current, businessId, (business) => ({
                        ...business,
                        settings: mergeBusinessSettings(business.settings, settingsPatch),
                    })),
            );
        },
        onSettled: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.businessDetail(businessId) });
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.businesses() });
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
        onMutate: async ({ taskId, status }) => {
            if (!businessId) return undefined;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: queryKeys.followUpTasksRoot(businessId) }),
                queryClient.cancelQueries({ queryKey: queryKeys.voicemailsRoot(businessId) }),
                queryClient.cancelQueries({ queryKey: queryKeys.callsListRoot(businessId) }),
                queryClient.cancelQueries({ queryKey: queryKeys.callDetailRoot(businessId) }),
            ]);

            const followUpSnapshots = captureSnapshots<FollowUpTask[]>(
                queryClient,
                queryKeys.followUpTasksRoot(businessId),
            );
            const voicemailSnapshots = captureSnapshots<VoicemailRecord[]>(
                queryClient,
                queryKeys.voicemailsRoot(businessId),
            );
            const callListSnapshots = captureSnapshots<PaginatedResponse<CallListItem>>(
                queryClient,
                queryKeys.callsListRoot(businessId),
            );
            const callDetailSnapshots = captureSnapshots<CallDetail>(
                queryClient,
                queryKeys.callDetailRoot(businessId),
            );

            let existingTask: FollowUpTask | undefined;

            for (const [, tasks] of followUpSnapshots) {
                existingTask = tasks?.find((task) => task.id === taskId);
                if (existingTask) {
                    break;
                }
            }

            queryClient.setQueriesData<FollowUpTask[]>(
                { queryKey: queryKeys.followUpTasksRoot(businessId) },
                (current) =>
                    current?.map((task) => (task.id === taskId ? { ...task, status } : task)),
            );

            if (existingTask?.voicemailId) {
                queryClient.setQueriesData<VoicemailRecord[]>(
                    { queryKey: queryKeys.voicemailsRoot(businessId) },
                    (current) =>
                        current?.map((voicemail) =>
                            voicemail.id === existingTask?.voicemailId && voicemail.followUpTask
                                ? {
                                      ...voicemail,
                                      followUpTask: {
                                          ...voicemail.followUpTask,
                                          status,
                                      },
                                  }
                                : voicemail,
                        ),
                );
            }

            if (existingTask?.callId) {
                const previousWasOpen = isOpenFollowUpStatus(existingTask.status);
                const nextIsOpen = isOpenFollowUpStatus(status);
                const countDelta =
                    previousWasOpen === nextIsOpen ? 0 : previousWasOpen ? -1 : 1;

                queryClient.setQueriesData<PaginatedResponse<CallListItem>>(
                    { queryKey: queryKeys.callsListRoot(businessId) },
                    (current) =>
                        updateCallList(current, existingTask.callId!, (call) => ({
                            ...call,
                            followUpTaskCount: Math.max((call.followUpTaskCount ?? 0) + countDelta, 0),
                            hasFollowUp: Math.max((call.followUpTaskCount ?? 0) + countDelta, 0) > 0,
                        })),
                );
                queryClient.setQueriesData<CallDetail>(
                    { queryKey: queryKeys.callDetailRoot(businessId) },
                    (current) =>
                        updateCallDetail(current, existingTask.callId!, (call) => ({
                            ...call,
                            followUpTasks: call.followUpTasks.map((task) =>
                                task.id === taskId ? { ...task, status } : task,
                            ),
                        })),
                );
            }

            return {
                followUpSnapshots,
                voicemailSnapshots,
                callListSnapshots,
                callDetailSnapshots,
            };
        },
        onError: (_error, _variables, context) => {
            if (!context) {
                return;
            }

            restoreSnapshots(queryClient, context.followUpSnapshots);
            restoreSnapshots(queryClient, context.voicemailSnapshots);
            restoreSnapshots(queryClient, context.callListSnapshots);
            restoreSnapshots(queryClient, context.callDetailSnapshots);
        },
        onSuccess: (task) => {
            if (!businessId) {
                return;
            }

            queryClient.setQueriesData<FollowUpTask[]>(
                { queryKey: queryKeys.followUpTasksRoot(businessId) },
                (current) => current?.map((item) => (item.id === task.id ? task : item)),
            );
            if (task.voicemailId) {
                queryClient.setQueriesData<VoicemailRecord[]>(
                    { queryKey: queryKeys.voicemailsRoot(businessId) },
                    (current) =>
                        current?.map((voicemail) =>
                            voicemail.id === task.voicemailId && voicemail.followUpTask
                                ? {
                                      ...voicemail,
                                      followUpTask: {
                                          ...voicemail.followUpTask,
                                          id: task.id,
                                          type: task.type,
                                          priority: task.priority,
                                          status: task.status,
                                          metadata: task.metadata,
                                      },
                                  }
                                : voicemail,
                        ),
                );
            }
            if (task.callId) {
                queryClient.setQueriesData<CallDetail>(
                    { queryKey: queryKeys.callDetailRoot(businessId) },
                    (current) =>
                        updateCallDetail(current, task.callId!, (call) => ({
                            ...call,
                            followUpTasks: call.followUpTasks.map((item) =>
                                item.id === task.id ? task : item,
                            ),
                        })),
                );
            }
        },
        onSettled: () => {
            if (businessId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.followUpTasksRoot(businessId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.voicemailsRoot(businessId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.callsListRoot(businessId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.callDetailRoot(businessId) });
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
        onMutate: async ({ category, data }) => {
            if (!businessId) return undefined;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: queryKeys.integrations(businessId) }),
                queryClient.cancelQueries({
                    queryKey: queryKeys.integrationDetail(businessId, category),
                }),
            ]);

            const integrationsSnapshots = captureSnapshots<BusinessIntegration[]>(
                queryClient,
                queryKeys.integrations(businessId),
            );
            const integrationDetailSnapshots = captureSnapshots<BusinessIntegration>(
                queryClient,
                queryKeys.integrationDetail(businessId, category),
            );

            const previousIntegration =
                queryClient.getQueryData<BusinessIntegration>(
                    queryKeys.integrationDetail(businessId, category),
                ) ??
                queryClient
                    .getQueryData<BusinessIntegration[]>(queryKeys.integrations(businessId))
                    ?.find((integration) => integration.category === category);
            const optimisticIntegration = buildOptimisticIntegration(
                businessId,
                category,
                data,
                previousIntegration,
            );

            queryClient.setQueryData(
                queryKeys.integrationDetail(businessId, category),
                optimisticIntegration,
            );
            queryClient.setQueryData<BusinessIntegration[] | undefined>(
                queryKeys.integrations(businessId),
                (current) => updateIntegrationList(current, optimisticIntegration),
            );

            return { integrationsSnapshots, integrationDetailSnapshots };
        },
        onError: (_error, _variables, context) => {
            if (!context) {
                return;
            }

            restoreSnapshots(queryClient, context.integrationsSnapshots);
            restoreSnapshots(queryClient, context.integrationDetailSnapshots);
        },
        onSuccess: (integration, variables) => {
            if (!businessId) {
                return;
            }

            queryClient.setQueryData(
                queryKeys.integrationDetail(businessId, variables.category),
                integration,
            );
            queryClient.setQueryData<BusinessIntegration[] | undefined>(
                queryKeys.integrations(businessId),
                (current) => updateIntegrationList(current, integration),
            );
        },
        onSettled: (_result, _error, variables) => {
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
        onMutate: async (category) => {
            if (!businessId) return undefined;

            await Promise.all([
                queryClient.cancelQueries({ queryKey: queryKeys.integrations(businessId) }),
                queryClient.cancelQueries({
                    queryKey: queryKeys.integrationDetail(businessId, category),
                }),
            ]);

            const integrationsSnapshots = captureSnapshots<BusinessIntegration[]>(
                queryClient,
                queryKeys.integrations(businessId),
            );
            const integrationDetailSnapshots = captureSnapshots<BusinessIntegration>(
                queryClient,
                queryKeys.integrationDetail(businessId, category),
            );

            const touchedAt = new Date().toISOString();

            queryClient.setQueriesData<BusinessIntegration[]>(
                { queryKey: queryKeys.integrations(businessId) },
                (current) =>
                    current?.map((integration) =>
                        integration.category === category
                            ? { ...integration, lastHealthCheckAt: touchedAt }
                            : integration,
                    ),
            );
            queryClient.setQueriesData<BusinessIntegration>(
                { queryKey: queryKeys.integrationDetail(businessId, category) },
                (current) =>
                    current
                        ? {
                              ...current,
                              lastHealthCheckAt: touchedAt,
                          }
                        : current,
            );

            return { integrationsSnapshots, integrationDetailSnapshots };
        },
        onError: (_error, _category, context) => {
            if (!context) {
                return;
            }

            restoreSnapshots(queryClient, context.integrationsSnapshots);
            restoreSnapshots(queryClient, context.integrationDetailSnapshots);
        },
        onSuccess: (result, category) => {
            if (!businessId) {
                return;
            }

            queryClient.setQueryData(
                queryKeys.integrationDetail(businessId, category),
                result.integration,
            );
            queryClient.setQueryData<BusinessIntegration[] | undefined>(
                queryKeys.integrations(businessId),
                (current) => updateIntegrationList(current, result.integration),
            );
        },
        onSettled: (_result, _error, category) => {
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
