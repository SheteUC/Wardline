import { UserRole } from '@wardline/types';

/**
 * Permission hierarchy - higher roles have all permissions of lower roles
 * OWNER > ADMIN > SUPERVISOR > AGENT > READONLY
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
    [UserRole.OWNER]: 5,
    [UserRole.ADMIN]: 4,
    [UserRole.SUPERVISOR]: 3,
    [UserRole.AGENT]: 2,
    [UserRole.READONLY]: 1,
};

/**
 * Check if a user's role has the required permission level
 * @param userRole The user's current role
 * @param requiredRole The minimum required role
 * @returns True if the user has sufficient permissions
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    const userLevel = ROLE_HIERARCHY[userRole];
    const requiredLevel = ROLE_HIERARCHY[requiredRole];
    return userLevel >= requiredLevel;
}

/**
 * Check if a user's role meets any of the required roles
 * @param userRole The user's current role
 * @param requiredRoles Array of acceptable roles
 * @returns True if the user has any of the required roles
 */
export function hasAnyPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    return requiredRoles.some(role => hasPermission(userRole, role));
}

/**
 * Get all roles that have at least the given permission level
 * @param minRole Minimum role required
 * @returns Array of roles that meet or exceed the minimum
 */
export function getRolesWithPermission(minRole: UserRole): UserRole[] {
    const minLevel = ROLE_HIERARCHY[minRole];
    return Object.entries(ROLE_HIERARCHY)
        .filter(([_, level]) => level >= minLevel)
        .map(([role, _]) => role as UserRole);
}

export const PERMISSIONS_KEY = 'permissions';
