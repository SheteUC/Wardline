from __future__ import annotations

import time
import uuid
from typing import Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from observability import context as ctx
from observability.traceparse import parse_traceparent

_http_log = structlog.get_logger("http")


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        hdr = request.headers
        request_id = (hdr.get("x-request-id") or "").strip() or str(uuid.uuid4())
        correlation_id = (hdr.get("x-correlation-id") or "").strip() or request_id
        tp = parse_traceparent(hdr.get("traceparent"))
        if tp:
            trace_id, parent_span_id = tp
        else:
            trace_id = ctx.new_trace_id()
            parent_span_id = None

        ctx.set_request_context(
            request_id=request_id,
            correlation_id=correlation_id,
            trace_id=trace_id,
            parent_span_id=parent_span_id,
        )

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            correlation_id=correlation_id,
            trace_id=trace_id,
        )

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except BaseException:
            structlog.contextvars.clear_contextvars()
            raise
        else:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            structlog.contextvars.clear_contextvars()
            response.headers["x-request-id"] = request_id
            response.headers["x-correlation-id"] = correlation_id
            _http_log.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=duration_ms,
            )
            return response
