"use client";

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * React Query provider for the application
 * Configures default query options for optimal performance:
 * - Aggressive stale time to reduce refetches
 * - Background refetch for fresh data
 * - Smart retry logic for transient failures
 */

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Data is fresh for 2 minutes - won't refetch during this time
                staleTime: 1000 * 60 * 2,
                // Keep data in cache for 10 minutes even if no components use it
                gcTime: 1000 * 60 * 10,
                // Retry logic - don't retry auth errors
                retry: (failureCount, error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    // Don't retry on 401/403 (auth errors) or 404 (not found)
                    if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('404')) {
                        return false;
                    }
                    return failureCount < 2;
                },
                // Refetch in background when window regains focus (good for stale tabs)
                refetchOnWindowFocus: true,
                // Don't refetch on mount if data is still fresh
                refetchOnMount: false,
                // Refetch when reconnecting after losing connection
                refetchOnReconnect: true,
                // Use previous data while fetching new data (no loading flash)
                placeholderData: (prev: unknown) => prev,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

// Browser-side singleton to avoid creating new QueryClient on every render
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
    if (typeof window === 'undefined') {
        // Server: always create a new QueryClient
        return makeQueryClient();
    } else {
        // Browser: use singleton pattern
        if (!browserQueryClient) {
            browserQueryClient = makeQueryClient();
        }
        return browserQueryClient;
    }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
    // Use useState to ensure the same client is used throughout the component lifecycle
    // This pattern is recommended by TanStack Query for Next.js App Router
    const [queryClient] = useState(getQueryClient);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
