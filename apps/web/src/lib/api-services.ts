import type {
    CallListItem,
    CallDetail,
    CallAnalytics,
    WorkflowListItem,
    WorkflowDetail,
    TeamMember,
    HospitalSettings,
    PaginatedResponse,
    SystemHealth,
} from './api-types';

/**
 * API Service layer for making typed requests to the backend
 * All methods require authentication via Clerk token
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

interface ApiClientMethods {
    get: <T>(endpoint: string) => Promise<T>;
    post: <T>(endpoint: string, data: unknown) => Promise<T>;
    put: <T>(endpoint: string, data: unknown) => Promise<T>;
    patch: <T>(endpoint: string, data: unknown) => Promise<T>;
    delete: <T>(endpoint: string) => Promise<T>;
}

/**
 * Calls Service
 */
export const createCallsService = (client: ApiClientMethods, hospitalId: string) => ({
    async getCalls(filters?: {
        status?: string;
        startDate?: Date;
        endDate?: Date;
        search?: string;
        page?: number;
        pageSize?: number;
    }): Promise<PaginatedResponse<CallListItem>> {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
        if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
        if (filters?.search) params.append('search', filters.search);
        if (filters?.page) params.append('page', filters.page.toString());
        if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return client.get<PaginatedResponse<CallListItem>>(`/hospitals/${hospitalId}/calls${query}`);
    },

    async getCallById(callId: string): Promise<CallDetail> {
        return client.get<CallDetail>(`/hospitals/${hospitalId}/calls/${callId}`);
    },

    async getAnalytics(startDate: Date, endDate: Date): Promise<CallAnalytics> {
        const params = new URLSearchParams({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        });
        return client.get<CallAnalytics>(`/hospitals/${hospitalId}/calls/analytics?${params.toString()}`);
    },
});

/**
 * Workflows Service
 */
export const createWorkflowsService = (client: ApiClientMethods, hospitalId: string) => ({
    async getWorkflows(): Promise<WorkflowListItem[]> {
        return client.get<WorkflowListItem[]>(`/hospitals/${hospitalId}/workflows`);
    },

    async getWorkflowById(workflowId: string): Promise<WorkflowDetail> {
        return client.get<WorkflowDetail>(`/hospitals/${hospitalId}/workflows/${workflowId}`);
    },

    async createWorkflow(data: {
        name: string;
        description?: string;
        userId: string;
    }): Promise<WorkflowDetail> {
        return client.post<WorkflowDetail>(`/hospitals/${hospitalId}/workflows`, data);
    },

    async createVersion(workflowId: string, data: {
        userId: string;
        graphJson: unknown;
    }): Promise<any> {
        return client.post(`/hospitals/${hospitalId}/workflows/${workflowId}/versions`, data);
    },

    async publishVersion(versionId: string, approverUserId: string): Promise<any> {
        return client.post(`/hospitals/${hospitalId}/workflows/versions/${versionId}/publish`, {
            approverUserId,
        });
    },
});

/**
 * Team Service
 */
export const createTeamService = (client: ApiClientMethods, hospitalId: string) => ({
    async getTeamMembers(): Promise<TeamMember[]> {
        return client.get<TeamMember[]>(`/hospitals/${hospitalId}/users`);
    },

    async inviteUser(data: {
        email: string;
        role: string;
    }): Promise<TeamMember> {
        return client.post<TeamMember>(`/hospitals/${hospitalId}/users/invite`, data);
    },

    async updateUserRole(userId: string, role: string): Promise<TeamMember> {
        return client.patch<TeamMember>(`/hospitals/${hospitalId}/users/${userId}/role`, { role });
    },
});

/**
 * Hospital Service
 */
export const createHospitalService = (client: ApiClientMethods) => ({
    async getHospitals(): Promise<HospitalSettings[]> {
        return client.get<HospitalSettings[]>('/hospitals');
    },

    async getHospitalById(hospitalId: string): Promise<HospitalSettings> {
        return client.get<HospitalSettings>(`/hospitals/${hospitalId}`);
    },

    async updateHospital(hospitalId: string, data: Partial<HospitalSettings>): Promise<HospitalSettings> {
        return client.patch<HospitalSettings>(`/hospitals/${hospitalId}`, data);
    },
});

/**
 * System Service (for health checks and live status)
 */
export const createSystemService = () => ({
    async getHealth(): Promise<SystemHealth> {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
    },

    async getVoiceOrchestratorHealth(): Promise<any> {
        const url = process.env.NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL || 'http://localhost:3002';
        const response = await fetch(`${url}/health`);
        if (!response.ok) throw new Error('Voice orchestrator health check failed');
        return response.json();
    },
});
