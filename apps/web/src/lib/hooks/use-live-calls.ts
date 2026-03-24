"use client";

import { useEffect, useState, useCallback } from 'react';
import { getWebSocketClient, disconnectWebSocket } from '../websocket-client';
import { useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '../business-context';
import { queryKeys } from './query-hooks';

/**
 * Hook for real-time call updates via WebSocket
 * Automatically connects to voice orchestrator and updates React Query cache
 */

interface LiveCallEvent {
    callId: string;
    status: string;
    duration?: number;
    state?: string;
}

export function useLiveCalls() {
    const [isConnected, setIsConnected] = useState(false);
    const [liveCallCount, setLiveCallCount] = useState(0);
    const queryClient = useQueryClient();
    const { businessId } = useBusiness();

    const handleCallStarted = useCallback((payload: LiveCallEvent) => {
        console.log('[LiveCalls] Call started:', payload);
        setLiveCallCount(prev => prev + 1);

        // Invalidate calls query to fetch updated list
        if (businessId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.calls(businessId) });
        }
    }, [businessId, queryClient]);

    const handleCallUpdated = useCallback((payload: LiveCallEvent) => {
        console.log('[LiveCalls] Call updated:', payload);

        // Update specific call if it's in the cache
        if (businessId && payload.callId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.callDetail(businessId, payload.callId) });
        }
    }, [businessId, queryClient]);

    const handleCallCompleted = useCallback((payload: LiveCallEvent) => {
        console.log('[LiveCalls] Call completed:', payload);
        setLiveCallCount(prev => Math.max(0, prev - 1));

        // Invalidate queries to refresh data
        if (businessId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.calls(businessId) });
        }
    }, [businessId, queryClient]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const wsClient = getWebSocketClient();

        // Connect to WebSocket
        wsClient.connect();

        // Register event handlers
        wsClient.on('call:started', handleCallStarted);
        wsClient.on('call:updated', handleCallUpdated);
        wsClient.on('call:completed', handleCallCompleted);

        // Check connection status
        const checkConnection = setInterval(() => {
            setIsConnected(wsClient.isConnected);
        }, 1000);

        // Cleanup
        return () => {
            clearInterval(checkConnection);
            wsClient.off('call:started', handleCallStarted);
            wsClient.off('call:updated', handleCallUpdated);
            wsClient.off('call:completed', handleCallCompleted);
            disconnectWebSocket();
        };
    }, [handleCallStarted, handleCallUpdated, handleCallCompleted]);

    return {
        isConnected,
        liveCallCount,
    };
}
