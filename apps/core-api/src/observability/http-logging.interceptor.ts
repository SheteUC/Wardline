import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from '@wardline/utils';
import { httpRequestDurationSeconds, httpRequestsTotal } from './metrics';

const logger = new Logger('HTTP');

function routeLabel(req: Request): string {
    let path = (req.originalUrl || req.url || '/').split('?')[0] || '/';
    path = path.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
    );
    if (path.length > 160) {
        path = `${path.slice(0, 157)}...`;
    }
    return path;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const http = context.switchToHttp();
        const req = http.getRequest<Request>();
        const res = http.getResponse<Response>();
        const path = routeLabel(req);
        if (path === '/health' || path === '/metrics' || path.endsWith('/health')) {
            return next.handle();
        }
        const start = process.hrtime.bigint();
        return next.handle().pipe(
            tap({
                finalize: () => {
                    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
                    const status = String(res.statusCode || 0);
                    const labels = { method: req.method, route: path, status_code: status };
                    httpRequestDurationSeconds.observe(labels, durationSec);
                    httpRequestsTotal.inc(labels);
                    logger.info('request_completed', {
                        method: req.method,
                        path,
                        statusCode: res.statusCode,
                        durationMs: Math.round(durationSec * 1000),
                    });
                },
            }),
        );
    }
}
