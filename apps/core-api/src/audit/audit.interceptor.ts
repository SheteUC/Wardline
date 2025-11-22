import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDITABLE_KEY, AuditableMetadata } from './auditable.decorator';
import { Logger } from '@wardline/utils';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditInterceptor.name);

    constructor(
        private auditService: AuditService,
        private reflector: Reflector,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const auditMetadata = this.reflector.get<AuditableMetadata>(
            AUDITABLE_KEY,
            context.getHandler(),
        );

        if (!auditMetadata) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const { entityType, action } = auditMetadata;

        // Extract hospital ID from request
        const hospitalId = request.params.hospitalId || request.body?.hospitalId || request.query?.hospitalId;

        if (!hospitalId) {
            this.logger.warn('Cannot create audit log: No hospital context', {
                entityType,
                action,
                path: request.path,
            });
            return next.handle();
        }

        // Extract entity ID from request params or body
        const entityId = request.params.id || request.body?.id;

        return next.handle().pipe(
            tap({
                next: (response) => {
                    // Log successful operations
                    this.auditService.logAction({
                        hospitalId,
                        userId: user?.id,
                        action,
                        entityType,
                        entityId: entityId || response?.id,
                        metadata: {
                            method: request.method,
                            path: request.path,
                            ip: request.ip,
                            userAgent: request.headers['user-agent'],
                            body: this.sanitizeBody(request.body),
                        },
                    });
                },
                error: (error) => {
                    // Log failed operations as well for compliance
                    this.auditService.logAction({
                        hospitalId,
                        userId: user?.id,
                        action: `${action}_FAILED`,
                        entityType,
                        entityId,
                        metadata: {
                            method: request.method,
                            path: request.path,
                            ip: request.ip,
                            error: error.message,
                            body: this.sanitizeBody(request.body),
                        },
                    });
                },
            }),
        );
    }

    /**
     * Remove sensitive fields from request body before logging
     */
    private sanitizeBody(body: any): any {
        if (!body) return body;

        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'];

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '***REDACTED***';
            }
        }

        return sanitized;
    }
}
