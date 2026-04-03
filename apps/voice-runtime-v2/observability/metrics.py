from __future__ import annotations

import re

from prometheus_client import Counter, Gauge, Histogram

llm_chat_json_seconds = Histogram(
    "wardline_voice_llm_chat_json_seconds",
    "LLM chat JSON completion latency (includes retries)",
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 15.0, 30.0, 60.0),
)

turn_processing_seconds = Histogram(
    "wardline_voice_text_turn_seconds",
    "End-to-end process_text_turn duration per request",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 15.0, 30.0, 60.0),
)

voice_sessions_started_total = Counter(
    "wardline_voice_sessions_started_total",
    "Voice sessions started by the runtime",
)

voice_sessions_completed_total = Counter(
    "wardline_voice_sessions_completed_total",
    "Voice sessions completed successfully",
)

voice_sessions_failed_total = Counter(
    "wardline_voice_sessions_failed_total",
    "Voice sessions that terminated with a failure",
)

voice_sessions_abandoned_total = Counter(
    "wardline_voice_sessions_abandoned_total",
    "Voice sessions that ended without a meaningful interaction",
)

voice_active_sessions = Gauge(
    "wardline_voice_active_sessions",
    "Voice sessions currently held in the runtime",
)

voice_provider_errors_total = Counter(
    "wardline_voice_provider_errors_total",
    "Provider and external-service errors by coarse type",
    labelnames=("provider", "error_type"),
)

voice_deepgram_reconnect_attempts_total = Counter(
    "wardline_voice_deepgram_reconnect_attempts_total",
    "Deepgram reconnect attempts",
)

voice_deepgram_reconnect_failures_total = Counter(
    "wardline_voice_deepgram_reconnect_failures_total",
    "Deepgram reconnect attempts that failed",
)


def _normalize_label(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9_]+", "_", (value or "").strip().lower()).strip("_")
    return normalized or "unknown"


def record_session_started() -> None:
    voice_sessions_started_total.inc()
    voice_active_sessions.inc()


def record_session_ended(outcome: str) -> None:
    normalized = _normalize_label(outcome)
    if normalized == "completed":
        voice_sessions_completed_total.inc()
    elif normalized == "failed":
        voice_sessions_failed_total.inc()
    elif normalized == "abandoned":
        voice_sessions_abandoned_total.inc()
    voice_active_sessions.dec()


def record_provider_error(provider: str, error_type: str) -> None:
    voice_provider_errors_total.labels(
        provider=_normalize_label(provider),
        error_type=_normalize_label(error_type),
    ).inc()


def record_deepgram_reconnect_attempt() -> None:
    voice_deepgram_reconnect_attempts_total.inc()


def record_deepgram_reconnect_failure() -> None:
    voice_deepgram_reconnect_failures_total.inc()
