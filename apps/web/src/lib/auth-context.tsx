"use client";

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useBusiness } from './business-context';
import { normalizeUserRole, UserRole } from '@wardline/types';

/**
 * Extended Auth Context with Role-Based Access Control
 * Provides user role information for dashboard routing and access control
 */

// Extended role types to include patient and system_admin
export type ExtendedUserRole = UserRole | 'patient' | 'system_admin';

function normalizeExtendedUserRole(role: string | undefined): ExtendedUserRole | null {
    if (!role) {
        return null;
    }

    if (role === 'system_admin' || role === 'patient') {
        return role;
    }

    return normalizeUserRole(role);
}

interface AuthContextType {
    userId: string | null;
    userRole: ExtendedUserRole | null;
    isPatient: boolean;
    isSystemAdmin: boolean;
    isCallCenterAdmin: boolean;
    isBusinessStaff: boolean;
    isLoading: boolean;
    hasPermission: (requiredRoles: ExtendedUserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoaded: userLoaded } = useUser();
    const { isLoaded: authLoaded } = useAuth();
    const { businessId } = useBusiness();
    const isLoading = !userLoaded || !authLoaded;
    const userRole = useMemo<ExtendedUserRole | null>(() => {
        if (isLoading) {
            return null;
        }

        // Get role from user metadata
        // In production, this would come from the database via API
        const metadata = user?.publicMetadata as {
            role?: ExtendedUserRole;
            businessRoles?: Record<string, ExtendedUserRole>;
        } | undefined;

        if (metadata?.role === 'system_admin' || metadata?.role === 'patient') {
            return metadata.role;
        }

        const normalizedBusinessRole = businessId
            ? normalizeExtendedUserRole(metadata?.businessRoles?.[businessId])
            : null;
        if (normalizedBusinessRole) {
            return normalizedBusinessRole;
        }

        const normalizedMetadataRole = normalizeExtendedUserRole(metadata?.role);
        if (normalizedMetadataRole) {
            return normalizedMetadataRole;
        }

        return UserRole.READONLY;
    }, [businessId, isLoading, user]);

    const value = useMemo(() => {
        const isPatient = userRole === 'patient';
        const isSystemAdmin = userRole === 'system_admin';
        const isCallCenterAdmin = userRole === UserRole.ADMIN || 
                                   userRole === UserRole.SUPERVISOR || 
                                   userRole === UserRole.OWNER;
        const isBusinessStaff = userRole === UserRole.ADMIN ||
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
            isBusinessStaff,
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

