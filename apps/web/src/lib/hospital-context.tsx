"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

/**
 * Business Context
 * Manages the currently selected business for API calls.
 * `Hospital*` names are kept as aliases while the active app surface finishes migrating.
 */

interface BusinessContextType {
    businessId: string | null;
    setBusinessId: (id: string) => void;
    hospitalId: string | null;
    setHospitalId: (id: string) => void;
    isLoading: boolean;
}

const HospitalContext = createContext<BusinessContextType | undefined>(undefined);
const STORAGE_KEY = 'selectedBusinessId';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

function clearStoredBusinessId() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('selectedHospitalId');
}

function persistBusinessId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    localStorage.setItem('selectedHospitalId', id);
}

export function HospitalProvider({ children }: { children: React.ReactNode }) {
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

            const storedBusinessId =
                localStorage.getItem(STORAGE_KEY) ||
                localStorage.getItem('selectedHospitalId');
            const defaultBusinessId =
                (user.publicMetadata?.defaultBusinessId as string | undefined) ||
                (user.publicMetadata?.defaultHospitalId as string | undefined);

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
                const nextBusinessId =
                    [storedBusinessId, defaultBusinessId].find(
                        (candidate): candidate is string =>
                            !!candidate && businesses.some((business) => business.id === candidate),
                    ) ||
                    businesses[0]?.id ||
                    null;

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
        <HospitalContext.Provider
            value={{
                businessId,
                setBusinessId: handleSetBusinessId,
                hospitalId: businessId,
                setHospitalId: handleSetBusinessId,
                isLoading,
            }}
        >
            {children}
        </HospitalContext.Provider>
    );
}

export function useBusiness() {
    const context = useContext(HospitalContext);
    if (context === undefined) {
        throw new Error('useBusiness must be used within a HospitalProvider');
    }
    return context;
}

export function useHospital() {
    return useBusiness();
}

export const BusinessProvider = HospitalProvider;
