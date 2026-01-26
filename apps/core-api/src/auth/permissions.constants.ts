import { UserRole } from '@wardline/types';
import { UserRole as PrismaUserRole } from '@wardline/db';

/**
 * Permission hierarchy - higher roles have all permissions of lower roles
 * OWNER > ADMIN > SUPERVISOR > AGENT > READONLY
 * 
 * Note: We use Prisma's generated enum which matches the database values
 */
const ROLE_HIERARCHY: Record<string, number> = {
    [PrismaUserRole.OWNER]: 5,
    [PrismaUserRole.ADMIN]: 4,
    [PrismaUserRole.SUPERVISOR]: 3,
    [PrismaUserRole.AGENT]: 2,
    [PrismaUserRole.READONLY]: 1,
};

/**
 * Check if a user's role has the required permission level
 * @param userRole The user's current role (from database)
 * @param requiredRole The minimum required role
 * @returns True if the user has sufficient permissions
 */
export function hasPermission(userRole: string, requiredRole: UserRole): boolean {
    // Convert both to uppercase for comparison (DB uses uppercase, decorators use lowercase)
    const userRoleUpper = userRole.toUpperCase();
    const requiredRoleUpper = requiredRole.toUpperCase();
    
    const userLevel = ROLE_HIERARCHY[userRoleUpper];
    const requiredLevel = ROLE_HIERARCHY[requiredRoleUpper];
    return userLevel !== undefined && requiredLevel !== undefined && userLevel >= requiredLevel;
}

/**
 * Check if a user's role meets any of the required roles
 * @param userRole The user's current role (from database)
 * @param requiredRoles Array of acceptable roles
 * @returns True if the user has any of the required roles
 */
export function hasAnyPermission(userRole: string, requiredRoles: UserRole[]): boolean {
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
