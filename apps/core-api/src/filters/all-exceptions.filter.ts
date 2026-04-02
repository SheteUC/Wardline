import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { getRequestContext } from '@wardline/utils';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const isProd = (process.env.NODE_ENV ?? 'development') === 'production';
        const reqCtx = getRequestContext();

        if (exception instanceof HttpException) {
            const res = exception.getResponse();
            const body =
                typeof res === 'string'
                    ? { message: res }
                    : (res as Record<string, unknown>);
            response.status(status).json({
                ...body,
                statusCode: status,
                path: request.url,
                timestamp: new Date().toISOString(),
                ...(reqCtx
                    ? {
                          requestId: reqCtx.requestId,
                          correlationId: reqCtx.correlationId,
                          traceId: reqCtx.traceId,
                      }
                    : {}),
            });
            return;
        }

        const err = exception instanceof Error ? exception : new Error(String(exception));
        this.logger.error(err.message, err.stack);

        response.status(status).json({
            statusCode: status,
            message: 'Internal server error',
            path: request.url,
            timestamp: new Date().toISOString(),
            ...(reqCtx
                ? {
                      requestId: reqCtx.requestId,
                      correlationId: reqCtx.correlationId,
                      traceId: reqCtx.traceId,
                  }
                : {}),
            ...(isProd
                ? {}
                : {
                      error: err.message,
                      stack: err.stack,
                  }),
        });
    }
}
