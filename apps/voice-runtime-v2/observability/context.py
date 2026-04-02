from __future__ import annotations

import secrets
from contextvars import ContextVar
from typing import Optional

_request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_correlation_id: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)
_trace_id: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)
_parent_span_id: ContextVar[Optional[str]] = ContextVar("parent_span_id", default=None)


def get_request_id() -> Optional[str]:
    return _request_id.get()


def get_correlation_id() -> Optional[str]:
    return _correlation_id.get()


def get_trace_id() -> Optional[str]:
    return _trace_id.get()


def set_request_context(
    *,
    request_id: str,
    correlation_id: str,
    trace_id: str,
    parent_span_id: Optional[str] = None,
) -> None:
    _request_id.set(request_id)
    _correlation_id.set(correlation_id)
    _trace_id.set(trace_id)
    _parent_span_id.set(parent_span_id)


def new_trace_id() -> str:
    return secrets.token_hex(16)


def new_span_id() -> str:
    return secrets.token_hex(8)


def outbound_traceparent() -> Optional[str]:
    tid = _trace_id.get()
    if not tid:
        return None
    span_id = new_span_id()
    return f"00-{tid}-{span_id}-01"


def outbound_headers() -> dict[str, str]:
    h: dict[str, str] = {}
    rid = get_request_id()
    if rid:
        h["X-Request-Id"] = rid
    cid = get_correlation_id()
    if cid:
        h["X-Correlation-Id"] = cid
    tp = outbound_traceparent()
    if tp:
        h["traceparent"] = tp
    return h
