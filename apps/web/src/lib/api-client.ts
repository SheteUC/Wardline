"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { CORE_API_V1 } from "./core-api-url";

/**
 * API client for making authenticated requests to the backend.
 * Returns stable method references so effects can depend on it safely.
 */

export function useApiClient() {
    const { getToken } = useAuth();
    const baseUrl = CORE_API_V1;

    const parseResponse = useCallback(async <T,>(res: Response): Promise<T> => {
        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        if (res.status === 204) {
            return undefined as T;
        }

        const text = await res.text();
        return (text ? JSON.parse(text) : undefined) as T;
    }, []);

    const get = useCallback(async <T,>(endpoint: string): Promise<T> => {
        const token = await getToken();
        return fetch(`${baseUrl}${endpoint}`, {
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        }).then((res) => parseResponse<T>(res));
    }, [baseUrl, getToken, parseResponse]);

    const post = useCallback(async <T,>(endpoint: string, data: unknown): Promise<T> => {
        const token = await getToken();
        return fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(data),
        }).then((res) => parseResponse<T>(res));
    }, [baseUrl, getToken, parseResponse]);

    const put = useCallback(async <T,>(endpoint: string, data: unknown): Promise<T> => {
        const token = await getToken();
        return fetch(`${baseUrl}${endpoint}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(data),
        }).then((res) => parseResponse<T>(res));
    }, [baseUrl, getToken, parseResponse]);

    const patch = useCallback(async <T,>(endpoint: string, data: unknown): Promise<T> => {
        const token = await getToken();
        return fetch(`${baseUrl}${endpoint}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(data),
        }).then((res) => parseResponse<T>(res));
    }, [baseUrl, getToken, parseResponse]);

    const remove = useCallback(async <T,>(endpoint: string): Promise<T> => {
        const token = await getToken();
        return fetch(`${baseUrl}${endpoint}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        }).then((res) => parseResponse<T>(res));
    }, [baseUrl, getToken, parseResponse]);

    return useMemo(() => ({
        get,
        post,
        put,
        patch,
        delete: remove,
    }), [get, patch, post, put, remove]);
}
