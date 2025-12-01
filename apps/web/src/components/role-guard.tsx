"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Shield, AlertTriangle } from 'lucide-react';

export type UserRole = 'patient' | 'system_admin' | 'owner' | 'admin' | 'supervisor' | 'agent' | 'readonly';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    fallback?: React.ReactNode;
    redirectTo?: string;
}

/**
 * RoleGuard Component
 * Protects routes/components based on user role
 * 
 * Usage:
 * <RoleGuard allowedRoles={['admin', 'supervisor']}>
 *   <AdminContent />
 * </RoleGuard>
 */
export function RoleGuard({ 
    children, 
    allowedRoles, 
    fallback,
    redirectTo 
}: RoleGuardProps) {
    const { user, isLoaded } = useUser();

    // Show loading state while checking auth
    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-full"></div>
                    <div className="h-4 w-32 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    // Get user role from metadata
    const userRole = (user?.publicMetadata?.role as UserRole) || 'readonly';

    // Check if user has required role
    const hasAccess = allowedRoles.includes(userRole);

    if (!hasAccess) {
        // Redirect if specified
        if (redirectTo) {
            redirect(redirectTo);
        }

        // Show fallback or default access denied
        if (fallback) {
            return <>{fallback}</>;
        }

        return <AccessDenied />;
    }

    return <>{children}</>;
}

/**
 * Default Access Denied Component
 */
function AccessDenied() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
            <div className="bg-rose-50 p-4 rounded-full mb-4">
                <Shield className="w-12 h-12 text-rose-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
                Access Denied
            </h2>
            <p className="text-muted-foreground max-w-md">
                You don't have permission to view this page. If you believe this is an error,
                please contact your administrator.
            </p>
        </div>
    );
}

/**
 * Hook to check user role
 */
export function useUserRole(): { role: UserRole; isLoading: boolean } {
    const { user, isLoaded } = useUser();
    const role = (user?.publicMetadata?.role as UserRole) || 'readonly';
    
    return {
        role,
        isLoading: !isLoaded,
    };
}

/**
 * Hook to check if user has specific roles
 */
export function useHasRole(allowedRoles: UserRole[]): { hasRole: boolean; isLoading: boolean } {
    const { role, isLoading } = useUserRole();
    
    return {
        hasRole: allowedRoles.includes(role),
        isLoading,
    };
}

/**
 * Higher-order component for role protection
 */
export function withRoleGuard<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    allowedRoles: UserRole[],
    redirectTo?: string
) {
    return function RoleProtectedComponent(props: P) {
        return (
            <RoleGuard allowedRoles={allowedRoles} redirectTo={redirectTo}>
                <WrappedComponent {...props} />
            </RoleGuard>
        );
    };
}

