/**
 * Base application error class
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        statusCode: number = 500,
        isOperational: boolean = true,
        context?: Record<string, unknown>
    ) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;

        Error.captureStackTrace(this);
    }
}

/**
 * HIPAA-related compliance error
 */
export class HIPAAError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 500, true, context);
    }
}

/**
 * Twilio integration error
 */
export class TwilioError extends AppError {
    constructor(message: string, statusCode: number = 500, context?: Record<string, unknown>) {
        super(message, statusCode, true, context);
    }
}

/**
 * Azure AI service error
 */
export class AzureAIError extends AppError {
    constructor(message: string, statusCode: number = 500, context?: Record<string, unknown>) {
        super(message, statusCode, true, context);
    }
}

/**
 * Scheduling integration error
 */
export class SchedulingError extends AppError {
    constructor(message: string, statusCode: number = 500, context?: Record<string, unknown>) {
        super(message, statusCode, true, context);
    }
}

/**
 * Authentication/authorization error
 */
export class AuthError extends AppError {
    constructor(message: string, statusCode: number = 401, context?: Record<string, unknown>) {
        super(message, statusCode, true, context);
    }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 400, true, context);
    }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
    constructor(resource: string, identifier?: string) {
        const message = identifier
            ? `${resource} with identifier '${identifier}' not found`
            : `${resource} not found`;
        super(message, 404, true);
    }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 409, true, context);
    }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests', context?: Record<string, unknown>) {
        super(message, 429, true, context);
    }
}

/**
 * Serialize error for API response
 */
export function serializeError(error: Error | AppError): {
    message: string;
    statusCode: number;
    stack?: string;
    context?: Record<string, unknown>;
} {
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (error instanceof AppError) {
        return {
            message: error.message,
            statusCode: error.statusCode,
            ...(isDevelopment && { stack: error.stack }),
            ...(error.context && { context: error.context }),
        };
    }

    return {
        message: isDevelopment ? error.message : 'Internal server error',
        statusCode: 500,
        ...(isDevelopment && { stack: error.stack }),
    };
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}
