import type {
    BusinessIntegration,
    IntegrationHealthCheckResult,
    BusinessRuntimeConfig,
    BusinessSettings,
    CallAnalytics,
    CallDetail,
    CallListItem,
    FollowUpTask,
    PaginatedResponse,
    TeamMember,
    VoicemailRecord,
} from './api-types';

interface ApiClientMethods {
    get: <T>(endpoint: string) => Promise<T>;
    post: <T>(endpoint: string, data: unknown) => Promise<T>;
    put: <T>(endpoint: string, data: unknown) => Promise<T>;
    patch: <T>(endpoint: string, data: unknown) => Promise<T>;
    delete: <T>(endpoint: string) => Promise<T>;
}

export const createCallsService = (client: ApiClientMethods, businessId: string) => ({
    async getCalls(filters?: {
        status?: string;
        tag?: string;
        isEmergency?: boolean;
        startDate?: Date;
        endDate?: Date;
        search?: string;
        page?: number;
        pageSize?: number;
    }): Promise<PaginatedResponse<CallListItem>> {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.tag) params.append('tag', filters.tag);
        if (filters?.isEmergency !== undefined) params.append('isEmergency', String(filters.isEmergency));
        if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
        if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
        if (filters?.search) params.append('search', filters.search);
        if (filters?.page) params.append('page', filters.page.toString());
        if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return client.get<PaginatedResponse<CallListItem>>(`/api/businesses/${businessId}/call-logs${query}`);
    },

    async getCallById(callId: string): Promise<CallDetail> {
        return client.get<CallDetail>(`/api/businesses/${businessId}/call-logs/${callId}`);
    },

    async getAnalytics(startDate: Date, endDate: Date): Promise<CallAnalytics> {
        const params = new URLSearchParams({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        });
        return client.get<CallAnalytics>(
            `/api/businesses/${businessId}/call-logs/analytics?${params.toString()}`
        );
    },

    async getVoicemails(unlistenedOnly = false): Promise<VoicemailRecord[]> {
        const query = unlistenedOnly ? '?unlistenedOnly=true' : '';
        return client.get<VoicemailRecord[]>(`/api/businesses/${businessId}/voicemails${query}`);
    },

    async markVoicemailListened(id: string): Promise<VoicemailRecord> {
        return client.patch<VoicemailRecord>(
            `/api/businesses/${businessId}/voicemails/${id}/mark-listened`,
            {},
        );
    },
});

export const createTeamService = (client: ApiClientMethods, businessId: string) => ({
    async getTeamMembers(): Promise<TeamMember[]> {
        const users = await client.get<Array<{
            id: string;
            clerkUserId: string;
            email: string;
            fullName?: string;
            createdAt: string;
            businesses?: Array<{
                role: string;
                businessId: string;
            }>;
        }>>('/users');

        const teamMembers: TeamMember[] = [];

        for (const user of users) {
            const membership = user.businesses?.find((entry) => entry.businessId === businessId);
            if (!membership) continue;

            teamMembers.push({
                id: user.id,
                businessId,
                clerkUserId: user.clerkUserId,
                email: user.email,
                name: user.fullName,
                fullName: user.fullName,
                role: membership.role as TeamMember['role'],
                isActive: true,
                createdAt: user.createdAt,
            });
        }

        return teamMembers;
    },

    async inviteUser(_data?: { email: string; role: string }): Promise<never> {
        throw new Error('Team invitations are not implemented yet on the Business API.');
    },

    async updateUserRole(userId: string, role: string): Promise<unknown> {
        return client.patch(`/users/${userId}/businesses/${businessId}/role`, { role });
    },
});

export const createBusinessService = (client: ApiClientMethods) => ({
    async getBusinesses(): Promise<BusinessSettings[]> {
        return client.get<BusinessSettings[]>('/businesses?includeSettings=true');
    },

    async getBusinessById(businessId: string): Promise<BusinessSettings> {
        return client.get<BusinessSettings>(`/businesses/${businessId}?includeRelations=true`);
    },

    async createBusiness(data: {
        name: string;
        slug: string;
        timeZone?: string;
    }): Promise<BusinessSettings> {
        return client.post<BusinessSettings>('/businesses', data);
    },

    async updateBusiness(businessId: string, data: Partial<BusinessSettings>): Promise<BusinessSettings> {
        return client.put<BusinessSettings>(`/businesses/${businessId}`, data);
    },

    async updateBusinessSettings(
        businessId: string,
        data: Partial<NonNullable<BusinessSettings['settings']>>,
    ): Promise<BusinessSettings['settings']> {
        return client.patch<BusinessSettings['settings']>(`/businesses/${businessId}/settings`, data);
    },

    async getRuntimeConfig(businessId: string): Promise<BusinessRuntimeConfig> {
        return client.get<BusinessRuntimeConfig>(`/businesses/${businessId}/runtime-config`);
    },
});

export const createIntegrationsService = (client: ApiClientMethods, businessId: string) => ({
    async getIntegrations(): Promise<BusinessIntegration[]> {
        return client.get<BusinessIntegration[]>(`/api/businesses/${businessId}/integrations`);
    },

    async getIntegration(category: string): Promise<BusinessIntegration> {
        return client.get<BusinessIntegration>(`/api/businesses/${businessId}/integrations/${category}`);
    },

    async upsertIntegration(
        category: string,
        data: {
            vendor: string;
            status?: string;
            credentialsRef?: string;
            settings?: Record<string, unknown>;
            capabilities?: Record<string, unknown>;
        },
    ): Promise<BusinessIntegration> {
        return client.put<BusinessIntegration>(`/api/businesses/${businessId}/integrations/${category}`, data);
    },

    async testIntegration(category: string): Promise<IntegrationHealthCheckResult> {
        return client.post<IntegrationHealthCheckResult>(`/api/businesses/${businessId}/integrations/${category}/test`, {});
    },
});

export const createFollowUpTasksService = (client: ApiClientMethods, businessId: string) => ({
    async getFollowUpTasks(filters?: {
        type?: string;
        status?: string;
        priority?: string;
        search?: string;
    }): Promise<FollowUpTask[]> {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.priority) params.append('priority', filters.priority);
        if (filters?.search) params.append('search', filters.search);

        const query = params.toString() ? `?${params.toString()}` : '';
        return client.get<FollowUpTask[]>(`/api/businesses/${businessId}/follow-up-tasks${query}`);
    },

    async updateFollowUpTaskStatus(
        taskId: string,
        status: FollowUpTask['status'],
    ): Promise<FollowUpTask> {
        return client.patch<FollowUpTask>(`/api/businesses/${businessId}/follow-up-tasks/${taskId}/status`, {
            status,
        });
    },
});
