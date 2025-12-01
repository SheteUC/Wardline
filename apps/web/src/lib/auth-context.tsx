"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useHospital } from './hospital-context';
import { UserRole } from '@wardline/types';

/**
 * Extended Auth Context with Role-Based Access Control
 * Provides user role information for dashboard routing and access control
 */

// Extended role types to include patient and system_admin
export type ExtendedUserRole = UserRole | 'patient' | 'system_admin';

interface AuthContextType {
    userId: string | null;
    userRole: ExtendedUserRole | null;
    isPatient: boolean;
    isSystemAdmin: boolean;
    isCallCenterAdmin: boolean;
    isHospitalStaff: boolean;
    isLoading: boolean;
    hasPermission: (requiredRoles: ExtendedUserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoaded: userLoaded } = useUser();
    const { isLoaded: authLoaded } = useAuth();
    const { hospitalId } = useHospital();
    const [userRole, setUserRole] = useState<ExtendedUserRole | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userLoaded || !authLoaded) return;

        // Get role from user metadata
        // In production, this would come from the database via API
        const metadata = user?.publicMetadata as {
            role?: ExtendedUserRole;
            hospitalRoles?: Record<string, ExtendedUserRole>;
        } | undefined;

        let role: ExtendedUserRole | null = null;

        // Check for system-level role first
        if (metadata?.role === 'system_admin') {
            role = 'system_admin';
        } else if (metadata?.role === 'patient') {
            role = 'patient';
        } else if (hospitalId && metadata?.hospitalRoles?.[hospitalId]) {
            // Hospital-specific role
            role = metadata.hospitalRoles[hospitalId];
        } else if (metadata?.role) {
            role = metadata.role as ExtendedUserRole;
        } else {
            // Default to 'readonly' for authenticated users without explicit role
            // In production, you'd want to handle this differently
            role = UserRole.READONLY;
        }

        setUserRole(role);
        setIsLoading(false);
    }, [userLoaded, authLoaded, user, hospitalId]);

    const value = useMemo(() => {
        const isPatient = userRole === 'patient';
        const isSystemAdmin = userRole === 'system_admin';
        const isCallCenterAdmin = userRole === UserRole.ADMIN || 
                                   userRole === UserRole.SUPERVISOR || 
                                   userRole === UserRole.OWNER;
        const isHospitalStaff = userRole === UserRole.ADMIN || 
                                userRole === UserRole.SUPERVISOR || 
                                userRole === UserRole.AGENT ||
                                userRole === UserRole.OWNER ||
                                userRole === UserRole.READONLY;

        const hasPermission = (requiredRoles: ExtendedUserRole[]) => {
            if (!userRole) return false;
            return requiredRoles.includes(userRole);
        };

        return {
            userId: user?.id || null,
            userRole,
            isPatient,
            isSystemAdmin,
            isCallCenterAdmin,
            isHospitalStaff,
            isLoading,
            hasPermission,
        };
    }, [user?.id, userRole, isLoading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
}

/**
 * Hook to check if user has required role
 */
export function useRequireRole(requiredRoles: ExtendedUserRole[]) {
    const { userRole, isLoading, hasPermission } = useAuthContext();
    
    return {
        isAuthorized: hasPermission(requiredRoles),
        isLoading,
        userRole,
    };
}

