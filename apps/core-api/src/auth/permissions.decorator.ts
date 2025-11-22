import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@wardline/types';
import { PERMISSIONS_KEY } from './permissions.constants';

/**
 * Decorator to specify required permissions/roles for a route
 * The user must have at least one of the specified roles (or higher in the hierarchy)
 * 
 * @param roles - Minimum role(s) required to access the route
 * 
 * @example
 * // Only ADMIN and OWNER can access this route
 * @Permissions(UserRole.ADMIN)
 * @Put('settings')
 * updateSettings() { }
 * 
 * @example
 * // Multiple acceptable roles
 * @Permissions(UserRole.SUPERVISOR, UserRole.ADMIN)
 * @Post('workflows')
 * createWorkflow() { }
 */
export const Permissions = (...roles: UserRole[]) => SetMetadata(PERMISSIONS_KEY, roles);
