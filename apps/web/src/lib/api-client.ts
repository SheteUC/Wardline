"use client";

import { useAuth } from "@clerk/nextjs";

/**
 * API client for making authenticated requests to the backend
 * Use the useApiClient hook in components to get an authenticated client
 */

interface RequestOptions extends RequestInit {
    token?: string | null;
}

/**
 * Hook to get API client with automatic token injection
 * Use this in client components
 */
export function useApiClient() {
    const { getToken } = useAuth();

    const parseResponse = async <T,>(res: Response): Promise<T> => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        if (res.status === 204) {
            return undefined as T;
        }

        const text = await res.text();
        return (text ? JSON.parse(text) : undefined) as T;
    };

    return {
        async get<T>(endpoint: string): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }).then((res) => parseResponse<T>(res));
        },

        async post<T>(endpoint: string, data: unknown): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            }).then((res) => parseResponse<T>(res));
        },

        async put<T>(endpoint: string, data: unknown): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            }).then((res) => parseResponse<T>(res));
        },

        async patch<T>(endpoint: string, data: unknown): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            }).then((res) => parseResponse<T>(res));
        },

        async delete<T>(endpoint: string): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }).then((res) => parseResponse<T>(res));
        },
    };
}
