import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';

export interface RequestContextStore {
    requestId: string;
    correlationId: string;
    /** 32-char hex W3C-style trace id */
    traceId: string;
    /** 16-char hex parent span id from inbound traceparent, when present */
    parentSpanId?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
    return storage.getStore();
}

export function runWithRequestContext<T>(store: RequestContextStore, fn: () => T): T {
    return storage.run(store, fn);
}

/** Parse W3C traceparent: `00-{trace-id}-{parent-id}-{flags}` */
export function parseTraceparent(header: string | undefined): { traceId: string; parentSpanId: string } | null {
    if (!header || typeof header !== 'string') {
        return null;
    }
    const parts = header.trim().split('-');
    if (parts.length !== 4 || parts[0] !== '00') {
        return null;
    }
    const [, traceId, parentSpanId] = parts;
    if (!/^[0-9a-f]{32}$/i.test(traceId) || !/^[0-9a-f]{16}$/i.test(parentSpanId)) {
        return null;
    }
    return { traceId: traceId.toLowerCase(), parentSpanId: parentSpanId.toLowerCase() };
}

export function newTraceId(): string {
    return randomBytes(16).toString('hex');
}

export function newSpanId(): string {
    return randomBytes(8).toString('hex');
}

export function normalizeRequestId(header: string | string[] | undefined): string | undefined {
    if (header === undefined) {
        return undefined;
    }
    const v = Array.isArray(header) ? header[0] : header;
    const s = typeof v === 'string' ? v.trim() : '';
    return s.length > 0 ? s : undefined;
}

export function createInboundContext(reqHeaders: {
    get(name: string): string | undefined;
}): RequestContextStore {
    const requestId = normalizeRequestId(reqHeaders.get('x-request-id')) ?? randomUUID();
    const correlationId =
        normalizeRequestId(reqHeaders.get('x-correlation-id')) ?? normalizeRequestId(reqHeaders.get('x-request-id')) ?? requestId;

    const tp = parseTraceparent(reqHeaders.get('traceparent') ?? undefined);
    if (tp) {
        return {
            requestId,
            correlationId,
            traceId: tp.traceId,
            parentSpanId: tp.parentSpanId,
        };
    }

    return {
        requestId,
        correlationId,
        traceId: newTraceId(),
    };
}

/**
 * Build W3C traceparent for an outbound client call using current trace + a new span id.
 */
export function buildOutboundTraceparent(): string | undefined {
    const ctx = getRequestContext();
    if (!ctx) {
        return undefined;
    }
    const spanId = newSpanId();
    return `00-${ctx.traceId}-${spanId}-01`;
}
