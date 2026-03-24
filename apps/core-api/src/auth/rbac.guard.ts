import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@wardline/types';
import { PERMISSIONS_KEY, hasAnyPermission } from './permissions.constants';
import { Logger } from '@wardline/utils';

@Injectable()
export class RbacGuard implements CanActivate {
    private readonly logger = new Logger(RbacGuard.name);

    constructor(private reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Get required roles from metadata
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no roles are specified, allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            this.logger.warn('RBAC check failed: No user in request');
            throw new ForbiddenException('User not authenticated');
        }

        // Extract business ID from request params or body
        const businessId =
            request.params.businessId ||
            request.body?.businessId ||
            request.query?.businessId ||
            request.params.hospitalId ||
            request.body?.hospitalId ||
            request.query?.hospitalId;

        if (!businessId) {
            this.logger.warn('RBAC check failed: No business context', {
                userId: user.id,
                path: request.path,
            });
            throw new ForbiddenException('Business context required');
        }

        // Find user's role in the specified business
        const businessUser = user.businesses.find(
            (membership: any) => membership.businessId === businessId
        );

        if (!businessUser) {
            this.logger.warn('User does not belong to business', {
                userId: user.id,
                businessId,
            });
            throw new ForbiddenException('User does not belong to this business');
        }

        // Check if user has any of the required roles
        const userRole = businessUser.role as UserRole;
        const hasAccess = hasAnyPermission(userRole, requiredRoles);

        if (!hasAccess) {
            this.logger.warn('RBAC check failed: Insufficient permissions', {
                userId: user.id,
                userRole,
                requiredRoles,
                businessId,
            });
            throw new ForbiddenException('Insufficient permissions');
        }

        this.logger.debug('RBAC check passed', {
            userId: user.id,
            userRole,
            requiredRoles,
            businessId,
        });

        return true;
    }
}
