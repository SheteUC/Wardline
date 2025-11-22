import pino from 'pino';

/**
 * PHI-sensitive field patterns for redaction
 */
const PHI_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{10}\b/g,             // Phone numbers
    /\b[A-Z]{2}\d{6}\b/g,      // MRN patterns
    /\b\d{2}\/\d{2}\/\d{4}\b/g, // DOB
];

/**
 * PHI-sensitive field keys to redact
 */
const PHI_KEYS = new Set([
    'ssn',
    'social_security',
    'dob',
    'date_of_birth',
    'mrn',
    'medical_record_number',
    'phone',
    'phone_number',
    'email',
    'address',
    'name',
    'patient_name',
]);

/**
 * Redacts PHI from a string
 */
export function redactPHI(text: string): string {
    let redacted = text;

    for (const pattern of PHI_PATTERNS) {
        redacted = redacted.replace(pattern, '[REDACTED]');
    }

    return redacted;
}

/**
 * Recursively redacts PHI from objects
 */
export function redactPHIFromObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        if (typeof obj === 'string') {
            return redactPHI(obj);
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(redactPHIFromObject);
    }

    const redacted: any = {};

    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        if (PHI_KEYS.has(lowerKey)) {
            redacted[key] = '[REDACTED]';
        } else {
            redacted[key] = redactPHIFromObject(value);
        }
    }

    return redacted;
}

/**
 * Creates a logger instance with PHI redaction
 */
export function createLogger(name: string, options: pino.LoggerOptions = {}) {
    const isDevelopment = process.env.NODE_ENV === 'development';

    return pino({
        name,
        level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
        ...options,
        transport: isDevelopment
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            }
            : undefined,
        // Redact PHI in logs
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                '*.ssn',
                '*.social_security',
                '*.dob',
                '*.date_of_birth',
                '*.mrn',
                '*.medical_record_number',
                '*.phone',
                '*.phone_number',
                '*.email',
                '*.address',
                '*.patient_name',
            ],
            remove: true,
        },
    });
}

/**
 * Logger utility with structured logging methods
 */
export class Logger {
    private logger: pino.Logger;

    constructor(name: string, options?: pino.LoggerOptions) {
        this.logger = createLogger(name, options);
    }

    info(message: string, meta?: object) {
        this.logger.info(meta ? redactPHIFromObject(meta) : {}, message);
    }

    error(message: string, error?: Error | unknown, meta?: object) {
        const errorObj = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : error;

        this.logger.error(
            {
                error: errorObj,
                ...(meta ? redactPHIFromObject(meta) : {}),
            },
            message
        );
    }

    warn(message: string, meta?: object) {
        this.logger.warn(meta ? redactPHIFromObject(meta) : {}, message);
    }

    debug(message: string, meta?: object) {
        this.logger.debug(meta ? redactPHIFromObject(meta) : {}, message);
    }

    child(bindings: object) {
        return new Logger(this.logger.bindings().name as string, {
            ...this.logger.bindings(),
            ...bindings,
        });
    }
}
