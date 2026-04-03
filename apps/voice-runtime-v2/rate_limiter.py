"""
Small in-memory rate limiter for FastAPI endpoints.
"""
from __future__ import annotations

import asyncio
import math
import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import Request


class RateLimitExceeded(RuntimeError):
    def __init__(self, retry_after_s: int):
        super().__init__("rate_limit_exceeded")
        self.retry_after_s = retry_after_s


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def enforce(
        self,
        *,
        bucket: str,
        key: str,
        limit: int,
        window_s: float = 60.0,
    ) -> None:
        effective_limit = max(1, int(limit))
        now = time.monotonic()
        cutoff = now - window_s
        storage_key = f"{bucket}:{key}"

        async with self._lock:
            events = self._events[storage_key]
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= effective_limit:
                retry_after_s = max(1, math.ceil(window_s - (now - events[0])))
                raise RateLimitExceeded(retry_after_s)

            events.append(now)


def resolve_request_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


rate_limiter = InMemoryRateLimiter()
