"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api-client';
import { useHospital } from '../hospital-context';
import {
    createCallsService,
    createWorkflowsService,
    createTeamService,
    createHospitalService,
} from '../api-services';
import type {
    CallListItem,
    CallDetail,
    CallAnalytics,
    WorkflowListItem,
    WorkflowDetail,
    TeamMember,
    HospitalSettings,
} from '../api-types';

/**
 * React Query hooks for data fetching
 * These hooks automatically handle loading, error, and success states
 */

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
        queryKey: ['calls', hospitalId, filters],
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createCallsService(client, hospitalId);
            return service.getCalls(filters);
        },
        enabled: !!hospitalId,
    });
}

export function useCall(callId: string | null) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: ['call', hospitalId, callId],
        queryFn: async () => {
            if (!hospitalId || !callId) throw new Error('Missing hospital or call ID');
            const service = createCallsService(client, hospitalId);
            return service.getCallById(callId);
        },
        enabled: !!hospitalId && !!callId,
    });
}

export function useCallAnalytics(startDate: Date, endDate: Date) {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: ['call-analytics', hospitalId, startDate.toISOString(), endDate.toISOString()],
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createCallsService(client, hospitalId);
            return service.getAnalytics(startDate, endDate);
        },
        enabled: !!hospitalId,
        staleTime: 1000 * 60 * 2, // 2 minutes for analytics
    });
}

// ============ Workflows Hooks ============

export function useWorkflows() {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: ['workflows', hospitalId],
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
        queryKey: ['workflow', hospitalId, workflowId],
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
            queryClient.invalidateQueries({ queryKey: ['workflows', hospitalId] });
        },
    });
}

// ============ Team Hooks ============

export function useTeamMembers() {
    const client = useApiClient();
    const { hospitalId } = useHospital();

    return useQuery({
        queryKey: ['team', hospitalId],
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createTeamService(client, hospitalId);
            return service.getTeamMembers();
        },
        enabled: !!hospitalId,
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
            queryClient.invalidateQueries({ queryKey: ['team', hospitalId] });
        },
    });
}

// ============ Hospital/Settings Hooks ============

export function useHospitalSettings(hospitalIdOverride?: string) {
    const client = useApiClient();
    const { hospitalId: contextHospitalId } = useHospital();
    const hospitalId = hospitalIdOverride || contextHospitalId;

    return useQuery({
        queryKey: ['hospital', hospitalId],
        queryFn: async () => {
            if (!hospitalId) throw new Error('No hospital selected');
            const service = createHospitalService(client);
            return service.getHospitalById(hospitalId);
        },
        enabled: !!hospitalId,
    });
}

export function useHospitals() {
    const client = useApiClient();

    return useQuery({
        queryKey: ['hospitals'],
        queryFn: async () => {
            const service = createHospitalService(client);
            return service.getHospitals();
        },
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
            queryClient.invalidateQueries({ queryKey: ['hospital', hospitalId] });
        },
    });
}
