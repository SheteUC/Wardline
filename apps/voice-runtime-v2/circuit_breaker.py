"""
Async circuit breakers for outbound integrations.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from config import settings

logger = logging.getLogger(__name__)


class CircuitOpenError(RuntimeError):
    """Raised when a circuit breaker is open and rejecting work."""


@dataclass(slots=True)
class CircuitSnapshot:
    name: str
    state: str
    consecutive_failures: int


class AsyncCircuitBreaker:
    def __init__(
        self,
        *,
        name: str,
        failure_threshold: int,
        recovery_timeout_s: float,
        half_open_successes: int,
    ) -> None:
        self.name = name
        self.failure_threshold = max(1, int(failure_threshold))
        self.recovery_timeout_s = max(0.01, float(recovery_timeout_s))
        self.half_open_successes = max(1, int(half_open_successes))
        self._state = "closed"
        self._opened_at_monotonic: float | None = None
        self._consecutive_failures = 0
        self._half_open_success_count = 0
        self._half_open_probe_in_flight = False
        self._lock = asyncio.Lock()

    @property
    def state(self) -> str:
        return self._state

    def snapshot(self) -> CircuitSnapshot:
        return CircuitSnapshot(
            name=self.name,
            state=self._state,
            consecutive_failures=self._consecutive_failures,
        )

    async def before_call(self) -> None:
        async with self._lock:
            now = time.monotonic()

            if self._state == "open":
                opened_at = self._opened_at_monotonic or now
                elapsed = now - opened_at
                if elapsed < self.recovery_timeout_s:
                    raise CircuitOpenError(f"{self.name} circuit is open")

                self._state = "half-open"
                self._half_open_success_count = 0
                self._half_open_probe_in_flight = True
                logger.warning("%s circuit entering half-open state", self.name)
                return

            if self._state == "half-open":
                if self._half_open_probe_in_flight:
                    raise CircuitOpenError(f"{self.name} circuit is half-open")
                self._half_open_probe_in_flight = True

    async def record_success(self) -> None:
        async with self._lock:
            if self._state == "half-open":
                self._half_open_probe_in_flight = False
                self._half_open_success_count += 1
                if self._half_open_success_count >= self.half_open_successes:
                    self._close_locked()
                return

            self._consecutive_failures = 0

    async def record_failure(self, exc: BaseException) -> None:
        async with self._lock:
            if self._state == "half-open":
                self._open_locked()
                logger.warning("%s circuit reopened during half-open probe: %s", self.name, exc)
                return

            self._consecutive_failures += 1
            if self._consecutive_failures >= self.failure_threshold:
                self._open_locked()
                logger.warning(
                    "%s circuit opened after %s consecutive failures: %s",
                    self.name,
                    self._consecutive_failures,
                    exc,
                )

    async def reset(self) -> None:
        async with self._lock:
            self._close_locked()

    def _open_locked(self) -> None:
        self._state = "open"
        self._opened_at_monotonic = time.monotonic()
        self._half_open_success_count = 0
        self._half_open_probe_in_flight = False

    def _close_locked(self) -> None:
        self._state = "closed"
        self._opened_at_monotonic = None
        self._consecutive_failures = 0
        self._half_open_success_count = 0
        self._half_open_probe_in_flight = False


_BREAKERS: dict[str, AsyncCircuitBreaker] = {}


def get_circuit_breaker(name: str) -> AsyncCircuitBreaker:
    breaker = _BREAKERS.get(name)
    if breaker is None:
        breaker = AsyncCircuitBreaker(
            name=name,
            failure_threshold=settings.voice_circuit_failure_threshold,
            recovery_timeout_s=settings.voice_circuit_recovery_seconds,
            half_open_successes=settings.voice_circuit_half_open_successes,
        )
        _BREAKERS[name] = breaker
    return breaker


async def reset_all_circuit_breakers() -> None:
    for breaker in _BREAKERS.values():
        await breaker.reset()
