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

export function HospitalProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const { isLoaded } = useAuth();
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isLoaded) return;

        const storedBusinessId =
            localStorage.getItem(STORAGE_KEY) ||
            localStorage.getItem('selectedHospitalId');
        const defaultBusinessId =
            (user?.publicMetadata?.defaultBusinessId as string | undefined) ||
            (user?.publicMetadata?.defaultHospitalId as string | undefined);

        if (storedBusinessId) {
            setBusinessId(storedBusinessId);
        } else if (defaultBusinessId) {
            setBusinessId(defaultBusinessId);
            localStorage.setItem(STORAGE_KEY, defaultBusinessId);
            localStorage.setItem('selectedHospitalId', defaultBusinessId);
        }

        setIsLoading(false);
    }, [isLoaded, user]);

    const handleSetBusinessId = (id: string) => {
        setBusinessId(id);
        localStorage.setItem(STORAGE_KEY, id);
        localStorage.setItem('selectedHospitalId', id);
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
