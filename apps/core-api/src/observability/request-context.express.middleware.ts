import { NextFunction, Request, Response } from 'express';
import { createInboundContext, runWithRequestContext } from '@wardline/utils';

/**
 * Runs first on the Express stack so all Nest handlers share AsyncLocalStorage context.
 */
export function requestContextExpressMiddleware(req: Request, res: Response, next: NextFunction): void {
    const headerBag = {
        get(name: string): string | undefined {
            const v = req.headers[name.toLowerCase()];
            if (Array.isArray(v)) {
                return v[0];
            }
            return typeof v === 'string' ? v : undefined;
        },
    };
    const store = createInboundContext(headerBag);
    res.setHeader('x-request-id', store.requestId);
    res.setHeader('x-correlation-id', store.correlationId);
    runWithRequestContext(store, () => next());
}
