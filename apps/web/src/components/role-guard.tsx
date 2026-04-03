"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { useAuthContext, type ExtendedUserRole } from "@/lib/auth-context";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ExtendedUserRole[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo,
}: RoleGuardProps) {
  const router = useRouter();
  const { userRole, isLoading } = useAuthContext();
  const hasAccess = userRole ? allowedRoles.includes(userRole) : false;

  useEffect(() => {
    if (!isLoading && !hasAccess && redirectTo) {
      router.replace(redirectTo);
    }
  }, [hasAccess, isLoading, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex animate-pulse flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (redirectTo) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 rounded-full bg-rose-50 p-4">
        <Shield className="h-12 w-12 text-rose-500" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">Access Denied</h2>
      <p className="max-w-md text-muted-foreground">
        You don&apos;t have permission to view this page. If you believe this is an error,
        please contact your administrator.
      </p>
    </div>
  );
}

export function useUserRole(): { role: ExtendedUserRole | null; isLoading: boolean } {
  const { userRole, isLoading } = useAuthContext();
  return {
    role: userRole,
    isLoading,
  };
}

export function useHasRole(allowedRoles: ExtendedUserRole[]): { hasRole: boolean; isLoading: boolean } {
  const { role, isLoading } = useUserRole();
  return {
    hasRole: role ? allowedRoles.includes(role) : false,
    isLoading,
  };
}

export function withRoleGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  allowedRoles: ExtendedUserRole[],
  redirectTo?: string,
) {
  return function RoleProtectedComponent(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} redirectTo={redirectTo}>
        <WrappedComponent {...props} />
      </RoleGuard>
    );
  };
}
