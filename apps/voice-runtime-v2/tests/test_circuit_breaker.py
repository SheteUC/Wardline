import asyncio
import pathlib
import sys
import unittest

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from circuit_breaker import AsyncCircuitBreaker, CircuitOpenError  # noqa: E402
from retry_async import retry_async  # noqa: E402


class CircuitBreakerTests(unittest.IsolatedAsyncioTestCase):
    async def test_retry_async_opens_circuit_after_repeated_failures(self):
        breaker = AsyncCircuitBreaker(
            name="test-core-api",
            failure_threshold=2,
            recovery_timeout_s=0.05,
            half_open_successes=1,
        )

        async def fail_once():
            raise RuntimeError("core api unavailable")

        with self.assertRaises(RuntimeError):
            await retry_async(fail_once, attempts=1, circuit_breaker=breaker, operation="core_api")

        with self.assertRaises(RuntimeError):
            await retry_async(fail_once, attempts=1, circuit_breaker=breaker, operation="core_api")

        with self.assertRaises(CircuitOpenError):
            await retry_async(fail_once, attempts=1, circuit_breaker=breaker, operation="core_api")

        self.assertEqual(breaker.state, "open")

    async def test_half_open_probe_closes_the_circuit_after_recovery(self):
        breaker = AsyncCircuitBreaker(
            name="test-deepgram",
            failure_threshold=1,
            recovery_timeout_s=0.01,
            half_open_successes=1,
        )

        async def fail_once():
            raise RuntimeError("deepgram unavailable")

        async def succeed_once():
            return "ok"

        with self.assertRaises(RuntimeError):
            await retry_async(fail_once, attempts=1, circuit_breaker=breaker, operation="deepgram")

        self.assertEqual(breaker.state, "open")

        await asyncio.sleep(0.02)
        result = await retry_async(succeed_once, attempts=1, circuit_breaker=breaker, operation="deepgram")

        self.assertEqual(result, "ok")
        self.assertEqual(breaker.state, "closed")


if __name__ == "__main__":
    unittest.main()
