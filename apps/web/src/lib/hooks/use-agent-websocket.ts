"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const CORE_API_URL = process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:3001';

interface AgentWebSocketOptions {
    agentId: string;
    userId?: string;
    onAssignmentNew?: (assignment: AssignmentEvent) => void;
    onAssignmentStatusChanged?: (assignment: AssignmentEvent) => void;
    onCallStatusChanged?: (call: CallStatusEvent) => void;
    onEmergencyAlert?: (alert: EmergencyAlertEvent) => void;
    onTranscriptUpdate?: (update: TranscriptEvent) => void;
}

export interface AssignmentEvent {
    id: string;
    callId: string;
    status: string;
    assignedAt?: string;
    acceptedAt?: string;
    call?: {
        id: string;
        twilioCallSid: string;
        callerPhone?: string;
        status: string;
        detectedIntent?: string;
        isEmergency?: boolean;
    };
}

export interface CallStatusEvent {
    callId: string;
    status: string;
    twilioCallSid?: string;
}

export interface EmergencyAlertEvent {
    callId: string;
    message: string;
    keywords: string[];
    priority: string;
    timestamp: string;
}

export interface TranscriptEvent {
    callId: string;
    segments: Array<{
        speaker: 'AI' | 'CALLER';
        text: string;
        timestamp: string;
    }>;
}

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'BREAK' | 'AWAY';

interface UseAgentWebSocketReturn {
    connected: boolean;
    setStatus: (status: AgentStatus) => void;
    acceptAssignment: (assignmentId: string) => void;
    rejectAssignment: (assignmentId: string, reason?: string) => void;
    completeAssignment: (assignmentId: string) => void;
}

export function useAgentWebSocket(
    options: AgentWebSocketOptions,
): UseAgentWebSocketReturn {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const { agentId, userId } = options;

    useEffect(() => {
        if (!agentId) return;

        const socket = io(CORE_API_URL, {
            auth: { agentId, userId },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            // Set agent as online on connect
            socket.emit('agent:status', { agentId, status: 'ONLINE' });
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('assignment:new', (data: AssignmentEvent) => {
            options.onAssignmentNew?.(data);
        });

        socket.on('assignment:status:changed', (data: AssignmentEvent) => {
            options.onAssignmentStatusChanged?.(data);
        });

        socket.on('call:status:changed', (data: CallStatusEvent) => {
            options.onCallStatusChanged?.(data);
        });

        socket.on('emergency:alert', (data: EmergencyAlertEvent) => {
            options.onEmergencyAlert?.(data);
        });

        socket.on('call:transcript', (data: TranscriptEvent) => {
            options.onTranscriptUpdate?.(data);
        });

        return () => {
            socket.emit('agent:status', { agentId, status: 'OFFLINE' });
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentId, userId]);

    const setStatus = useCallback((status: AgentStatus) => {
        socketRef.current?.emit('agent:status', { agentId, status });
    }, [agentId]);

    const acceptAssignment = useCallback((assignmentId: string) => {
        socketRef.current?.emit('assignment:accept', { assignmentId, agentId });
    }, [agentId]);

    const rejectAssignment = useCallback((assignmentId: string, reason = 'Agent declined') => {
        socketRef.current?.emit('assignment:reject', { assignmentId, agentId, reason });
    }, [agentId]);

    const completeAssignment = useCallback((assignmentId: string) => {
        socketRef.current?.emit('assignment:complete', { assignmentId, agentId });
    }, [agentId]);

    return { connected, setStatus, acceptAssignment, rejectAssignment, completeAssignment };
}
