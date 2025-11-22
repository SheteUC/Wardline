"use client";

import { useAuth } from "@clerk/nextjs";

/**
 * API client wrapper with Clerk token injection
 */

type FetchOptions = RequestInit & {
    includeAuth?: boolean;
};

class ApiClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
    }

    private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
        const { includeAuth = true, ...fetchOptions } = options;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(fetchOptions.headers as Record<string, string>),
        };

        // If auth is needed, get token from Clerk
        if (includeAuth && typeof window !== "undefined") {
            try {
                // This will be called from client components
                const { getToken } = useAuth();
                const token = await getToken();
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                }
            } catch (error) {
                console.warn("Could not get Clerk token:", error);
            }
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...fetchOptions,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({
                message: response.statusText,
            }));
            throw new Error(error.message || `API error: ${response.status}`);
        }

        return response.json();
    }

    async get<T>(endpoint: string, includeAuth = true): Promise<T> {
        return this.request<T>(endpoint, { method: "GET", includeAuth });
    }

    async post<T>(endpoint: string, data: unknown, includeAuth = true): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            body: JSON.stringify(data),
            includeAuth,
        });
    }

    async put<T>(endpoint: string, data: unknown, includeAuth = true): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PUT",
            body: JSON.stringify(data),
            includeAuth,
        });
    }

    async patch<T>(endpoint: string, data: unknown, includeAuth = true): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PATCH",
            body: JSON.stringify(data),
            includeAuth,
        });
    }

    async delete<T>(endpoint: string, includeAuth = true): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE", includeAuth });
    }
}

export const apiClient = new ApiClient();

/**
 * Hook to get API client with automatic token injection
 * Use this in client components
 */
export function useApiClient() {
    const { getToken } = useAuth();

    return {
        async get<T>(endpoint: string): Promise<T> {
            const token = await getToken();
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
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
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
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
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
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
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
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
            return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}${endpoint}`, {
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
