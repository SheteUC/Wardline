from __future__ import annotations

from prometheus_client import Histogram

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
