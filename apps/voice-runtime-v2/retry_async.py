"""
Small async retry helpers for transient network/API failures.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, TypeVar

from circuit_breaker import AsyncCircuitBreaker, get_circuit_breaker

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry_async(
    factory: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay_s: float = 0.25,
    max_delay_s: float = 4.0,
    operation: str = "request",
    circuit_name: str | None = None,
    circuit_breaker: AsyncCircuitBreaker | None = None,
    should_retry: Callable[[BaseException], bool] | None = None,
) -> T:
    """Run async factory with exponential backoff; last exception propagates."""
    if attempts < 1:
        attempts = 1

    breaker = circuit_breaker or (get_circuit_breaker(circuit_name) if circuit_name else None)
    if breaker is not None:
        await breaker.before_call()

    last_exc: BaseException | None = None
    for attempt in range(attempts):
        try:
            result = await factory()
            if breaker is not None:
                await breaker.record_success()
            return result
        except BaseException as exc:
            last_exc = exc
            retryable = should_retry(exc) if should_retry is not None else True
            if not retryable or attempt + 1 >= attempts:
                break
            delay = min(max_delay_s, base_delay_s * (2**attempt))
            logger.warning(
                "%s failed (attempt %s/%s): %s; retrying in %.2fs",
                operation,
                attempt + 1,
                attempts,
                exc,
                delay,
            )
            await asyncio.sleep(delay)
    assert last_exc is not None
    if breaker is not None:
        await breaker.record_failure(last_exc)
    raise last_exc
