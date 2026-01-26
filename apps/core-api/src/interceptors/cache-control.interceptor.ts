import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Cache Control Interceptor
 * 
 * Adds appropriate HTTP caching headers to responses for better
 * browser and CDN caching of API responses.
 */

// Decorator to set cache control options on a route
export const CACHE_CONTROL_KEY = 'cache_control';

export interface CacheControlOptions {
    maxAge?: number;        // Cache duration in seconds
    private?: boolean;      // Whether cache is private (user-specific)
    noStore?: boolean;      // Prevent any caching
    mustRevalidate?: boolean;
}

export const CacheControl = (options: CacheControlOptions) =>
    SetMetadata(CACHE_CONTROL_KEY, options);

// Convenience decorators
export const NoCache = () => CacheControl({ noStore: true });
export const PublicCache = (maxAge: number = 60) => CacheControl({ maxAge, private: false });
export const PrivateCache = (maxAge: number = 60) => CacheControl({ maxAge, private: true });

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
    constructor(private reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const options = this.reflector.getAllAndOverride<CacheControlOptions>(
            CACHE_CONTROL_KEY,
            [context.getHandler(), context.getClass()]
        );

        return next.handle().pipe(
            tap(() => {
                const response = context.switchToHttp().getResponse();
                const request = context.switchToHttp().getRequest();

                // Skip for non-GET requests (mutations should not be cached)
                if (request.method !== 'GET') {
                    response.setHeader('Cache-Control', 'no-store');
                    return;
                }

                // Apply explicit cache control options
                if (options) {
                    if (options.noStore) {
                        response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                        return;
                    }

                    const directives: string[] = [];

                    if (options.private) {
                        directives.push('private');
                    } else {
                        directives.push('public');
                    }

                    if (options.maxAge !== undefined) {
                        directives.push(`max-age=${options.maxAge}`);
                    }

                    if (options.mustRevalidate) {
                        directives.push('must-revalidate');
                    }

                    response.setHeader('Cache-Control', directives.join(', '));
                    return;
                }

                // Default cache behavior for GET requests without explicit options
                // Private cache with short duration (browser only, not CDN)
                response.setHeader('Cache-Control', 'private, max-age=30');
            }),
        );
    }
}

