import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { INTERNAL_API_KEY } from './internal-api.decorator';

@Injectable()
export class InternalApiGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const needsSecret = this.reflector.getAllAndOverride<boolean>(INTERNAL_API_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!needsSecret) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const headerRaw =
            request.headers['x-wardline-internal-secret'] ??
            request.headers['X-Wardline-Internal-Secret'];
        const headerSecret = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
        const expected = process.env.WARDLINE_INTERNAL_API_SECRET?.trim();

        const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

        if (!expected) {
            if (isProd) {
                throw new ForbiddenException('Internal API is not configured');
            }
            return true;
        }

        if (!headerSecret || headerSecret !== expected) {
            throw new ForbiddenException('Invalid internal API secret');
        }

        return true;
    }
}
