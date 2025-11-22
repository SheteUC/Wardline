import { Request, Response, NextFunction } from 'express';

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error('Error:', err);

    // Log error with sanitized info (no PHI)
    const errorLog = {
        timestamp: new Date().toISOString(),
        method: _req.method,
        path: _req.path,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };

    console.error('Error details:', JSON.stringify(errorLog, null, 2));

    // Return generic error response
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    });
}
