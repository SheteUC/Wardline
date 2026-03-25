"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { selectPreferredBusinessId } from './business-selection';

interface BusinessContextType {
    businessId: string | null;
    setBusinessId: (id: string) => void;
    isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);
const STORAGE_KEY = 'selectedBusinessId';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

function clearStoredBusinessId() {
    localStorage.removeItem(STORAGE_KEY);
}

function persistBusinessId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const { isLoaded, getToken } = useAuth();
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isLoaded) return;

        let cancelled = false;

        const syncBusinessSelection = async () => {
            if (!user) {
                clearStoredBusinessId();
                if (!cancelled) {
                    setBusinessId(null);
                    setIsLoading(false);
                }
                return;
            }

            const storedBusinessId = localStorage.getItem(STORAGE_KEY);
            const defaultBusinessId = user.publicMetadata?.defaultBusinessId as string | undefined;

            try {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/businesses?includeSettings=true`, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to load businesses (${response.status})`);
                }

                const businesses = (await response.json()) as Array<{ id: string }>;
                const nextBusinessId = selectPreferredBusinessId({
                    businesses,
                    storedBusinessId,
                    defaultBusinessId,
                });

                if (cancelled) return;

                if (nextBusinessId) {
                    persistBusinessId(nextBusinessId);
                } else {
                    clearStoredBusinessId();
                }

                setBusinessId(nextBusinessId);
            } catch (error) {
                console.error('Failed to sync business selection', error);
                if (!cancelled) {
                    setBusinessId(null);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void syncBusinessSelection();

        return () => {
            cancelled = true;
        };
    }, [getToken, isLoaded, user]);

    const handleSetBusinessId = (id: string) => {
        setBusinessId(id);
        persistBusinessId(id);
    };

    return (
        <BusinessContext.Provider
            value={{
                businessId,
                setBusinessId: handleSetBusinessId,
                isLoading,
            }}
        >
            {children}
        </BusinessContext.Provider>
    );
}

export function useBusiness() {
    const context = useContext(BusinessContext);
    if (context === undefined) {
        throw new Error('useBusiness must be used within a BusinessProvider');
    }
    return context;
}
