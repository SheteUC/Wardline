"""
Small async retry helpers for transient network/API failures.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry_async(
    factory: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay_s: float = 0.25,
    max_delay_s: float = 4.0,
    operation: str = "request",
) -> T:
    """Run async factory with exponential backoff; last exception propagates."""
    if attempts < 1:
        attempts = 1
    last_exc: BaseException | None = None
    for attempt in range(attempts):
        try:
            return await factory()
        except BaseException as exc:
            last_exc = exc
            if attempt + 1 >= attempts:
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
    raise last_exc
