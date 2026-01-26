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

    return {
        async get<T>(endpoint: string): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}${endpoint}`, {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }).then(async (res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            });
        },

        async post<T>(endpoint: string, data: unknown): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            }).then(async (res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            });
        },

        async put<T>(endpoint: string, data: unknown): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}${endpoint}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            }).then(async (res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            });
        },

        async patch<T>(endpoint: string, data: unknown): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}${endpoint}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            }).then(async (res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            });
        },

        async delete<T>(endpoint: string): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}${endpoint}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }).then(async (res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            });
        },
    };
}
