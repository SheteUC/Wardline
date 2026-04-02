import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@wardline/types';
import { PERMISSIONS_KEY, hasAnyPermission } from './permissions.constants';
import { Logger } from '@wardline/utils';

/**
 * Resolves tenant (business) id from common Nest route shapes.
 * `businesses/:id` uses `id` as the business UUID (not `by-phone` / `by-slug` prefixes).
 */
function extractBusinessId(request: any): string | undefined {
    const p = request.params ?? {};
    if (p.businessId) {
        return String(p.businessId);
    }
    const path: string = request.path ?? request.url?.split('?')[0] ?? '';
    if (p.id && path.startsWith('/businesses/')) {
        const first = path.split('/').filter(Boolean)[1];
        if (first && first !== 'by-phone' && first !== 'by-slug') {
            return String(p.id);
        }
    }
    if (request.body?.businessId) {
        return String(request.body.businessId);
    }
    if (request.query?.businessId) {
        return String(request.query.businessId);
    }
    return undefined;
}

@Injectable()
export class RbacGuard implements CanActivate {
    private readonly logger = new Logger(RbacGuard.name);

    constructor(private reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const businessId = extractBusinessId(request);

        if (!user) {
            if (requiredRoles?.length) {
                this.logger.warn('RBAC check failed: No user in request');
                throw new ForbiddenException('User not authenticated');
            }
            return true;
        }

        if (businessId) {
            const businessUser = user.businesses.find(
                (membership: any) => membership.businessId === businessId,
            );

            if (!businessUser) {
                this.logger.warn('User does not belong to business', {
                    userId: user.id,
                    businessId,
                });
                throw new ForbiddenException('User does not belong to this business');
            }

            if (requiredRoles?.length) {
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
            }

            return true;
        }

        if (requiredRoles?.length) {
            this.logger.warn('RBAC check failed: No business context', {
                userId: user.id,
                path: request.path,
            });
            throw new ForbiddenException('Business context required');
        }

        return true;
    }
}
