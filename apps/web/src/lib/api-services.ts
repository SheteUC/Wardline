import type {
    AgentCatalogItem,
    AgentListItem,
    AgentStats,
    BusinessIntegration,
    BusinessSettings,
    CallAnalytics,
    CallDetail,
    CallListItem,
    PaginatedResponse,
    SystemHealth,
    TeamMember,
    VoicemailRecord,
    WorkflowDetail,
    WorkflowListItem,
} from './api-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

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
        return client.patch<VoicemailRecord>(`/api/voicemails/${id}/mark-listened`, {});
    },
});

export const createWorkflowsService = (client: ApiClientMethods, businessId: string) => ({
    async getWorkflows(): Promise<WorkflowListItem[]> {
        return client.get<WorkflowListItem[]>(`/businesses/${businessId}/workflows`);
    },

    async getWorkflowById(workflowId: string): Promise<WorkflowDetail> {
        return client.get<WorkflowDetail>(`/businesses/${businessId}/workflows/${workflowId}`);
    },

    async createWorkflow(data: {
        name: string;
        description?: string;
        userId?: string;
        graphJson?: unknown;
    }): Promise<WorkflowDetail> {
        return client.post<WorkflowDetail>(`/businesses/${businessId}/workflows`, data);
    },

    async createVersion(workflowId: string, data: {
        userId?: string;
        graphJson: unknown;
    }): Promise<unknown> {
        return client.post(`/businesses/${businessId}/workflows/${workflowId}/versions`, data);
    },

    async publishVersion(versionId: string, approverUserId?: string): Promise<unknown> {
        return client.post(`/businesses/${businessId}/workflows/versions/${versionId}/publish`, {
            approverUserId,
        });
    },

    async validateWorkflow(workflowId: string): Promise<unknown> {
        return client.post(`/businesses/${businessId}/workflows/${workflowId}/validate`, {});
    },

    async simulateWorkflow(workflowId: string, payload: unknown): Promise<unknown> {
        return client.post(`/businesses/${businessId}/workflows/${workflowId}/simulate`, payload);
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
});

export const createHospitalService = createBusinessService;

export const createSystemService = () => ({
    async getHealth(): Promise<SystemHealth> {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
    },

    async getVoiceOrchestratorHealth(): Promise<unknown> {
        const url = process.env.NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL || 'http://localhost:3002';
        const response = await fetch(`${url}/health`);
        if (!response.ok) throw new Error('Voice orchestrator health check failed');
        return response.json();
    },
});

export const createAgentsService = (client: ApiClientMethods, businessId: string) => ({
    async getCatalog(): Promise<AgentCatalogItem[]> {
        return client.get<AgentCatalogItem[]>(`/api/businesses/${businessId}/agents/catalog`);
    },

    async getAgents(): Promise<AgentListItem[]> {
        return client.get<AgentListItem[]>(`/api/businesses/${businessId}/agents`);
    },

    async getAgentById(agentId: string): Promise<AgentListItem> {
        return client.get<AgentListItem>(`/api/businesses/${businessId}/agents/${agentId}`);
    },

    async getAgentStats(agentId: string): Promise<AgentStats> {
        return client.get<AgentStats>(`/api/businesses/${businessId}/agents/${agentId}/stats`);
    },

    async deployAgent(catalogId: string): Promise<AgentListItem> {
        return client.post<AgentListItem>(`/api/businesses/${businessId}/agents/deploy/${catalogId}`, {});
    },

    async updateAgentStatus(agentId: string, status: AgentListItem['status']): Promise<AgentListItem> {
        return client.patch<AgentListItem>(`/api/businesses/${businessId}/agents/${agentId}/status`, { status });
    },

    async updateAgentToolConfig(agentId: string, toolConfig: Record<string, unknown>): Promise<AgentListItem> {
        return client.patch<AgentListItem>(
            `/api/businesses/${businessId}/agents/${agentId}/tool-config`,
            toolConfig,
        );
    },

    async updateAgentConfig(agentId: string, agentConfig: Record<string, unknown>): Promise<AgentListItem> {
        return client.patch<AgentListItem>(
            `/api/businesses/${businessId}/agents/${agentId}/agent-config`,
            agentConfig,
        );
    },

    async updateNodeGraph(agentId: string, nodeGraph: Record<string, unknown>): Promise<AgentListItem> {
        return client.patch<AgentListItem>(
            `/api/businesses/${businessId}/agents/${agentId}/node-graph`,
            nodeGraph,
        );
    },

    async deleteAgent(agentId: string): Promise<void> {
        return client.delete<void>(`/api/businesses/${businessId}/agents/${agentId}`);
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

    async testIntegration(category: string): Promise<BusinessIntegration> {
        return client.post<BusinessIntegration>(`/api/businesses/${businessId}/integrations/${category}/test`, {});
    },
});

export const createQueuesService = (_client: ApiClientMethods, _businessId: string) => ({
    async getQueues(_filters?: unknown): Promise<PaginatedResponse<never>> {
        return { data: [], total: 0, page: 1, pageSize: 20 };
    },

    async getQueueById(_queueId?: string): Promise<null> {
        return null;
    },

    async createQueue(_data?: unknown): Promise<never> {
        throw new Error('Queues are not implemented in the active Business API surface yet.');
    },

    async updateQueue(_queueId?: string, _data?: unknown): Promise<never> {
        throw new Error('Queues are not implemented in the active Business API surface yet.');
    },

    async deleteQueue(_queueId?: string): Promise<void> {
        return undefined;
    },

    async getQueueMetrics(
        _queueId?: string,
        _startDate?: Date,
        _endDate?: Date,
    ): Promise<Record<string, never>> {
        return {};
    },

    async assignCall(_queueId?: string, _data?: unknown): Promise<never> {
        throw new Error('Assignments are not implemented in the active Business API surface yet.');
    },

    async getAssignments(_filters?: unknown): Promise<PaginatedResponse<never>> {
        return { data: [], total: 0, page: 1, pageSize: 20 };
    },

    async acceptAssignment(_assignmentId?: string, _agentId?: string): Promise<Record<string, never>> {
        return {};
    },

    async completeAssignment(_assignmentId?: string): Promise<Record<string, never>> {
        return {};
    },

    async abandonAssignment(_assignmentId?: string): Promise<Record<string, never>> {
        return {};
    },
});
