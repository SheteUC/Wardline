"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

/**
 * Hospital Context
 * Manages the currently selected hospital for API calls
 */

interface HospitalContextType {
    hospitalId: string | null;
    setHospitalId: (id: string) => void;
    isLoading: boolean;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const { isLoaded } = useAuth();
    const [hospitalId, setHospitalId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isLoaded) return;

        // Try to get hospital ID from user metadata
        // In a real app, this would come from the user's hospital memberships
        // For now, we'll use a default from localStorage or user metadata
        const storedHospitalId = localStorage.getItem('selectedHospitalId');

        if (storedHospitalId) {
            setHospitalId(storedHospitalId);
        } else if (user?.publicMetadata?.defaultHospitalId) {
            const defaultId = user.publicMetadata.defaultHospitalId as string;
            setHospitalId(defaultId);
            localStorage.setItem('selectedHospitalId', defaultId);
        }

        setIsLoading(false);
    }, [isLoaded, user]);

    const handleSetHospitalId = (id: string) => {
        setHospitalId(id);
        localStorage.setItem('selectedHospitalId', id);
    };

    return (
        <HospitalContext.Provider value={{ hospitalId, setHospitalId: handleSetHospitalId, isLoading }}>
            {children}
        </HospitalContext.Provider>
    );
}

export function useHospital() {
    const context = useContext(HospitalContext);
    if (context === undefined) {
        throw new Error('useHospital must be used within a HospitalProvider');
    }
    return context;
}
