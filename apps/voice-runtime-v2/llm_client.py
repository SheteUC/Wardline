"""
Shared async LLM client for OpenAI and Azure OpenAI (chat completions, JSON mode).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional

from openai import AsyncAzureOpenAI, AsyncOpenAI

from config import settings
from observability.metrics import llm_chat_json_seconds
from retry_async import retry_async

logger = logging.getLogger(__name__)

_client: Optional[AsyncOpenAI | AsyncAzureOpenAI] = None


def _get_client() -> Optional[AsyncOpenAI | AsyncAzureOpenAI]:
    global _client
    if _client is not None:
        return _client

    provider = settings.active_llm_provider()
    timeout = max(1.0, float(settings.voice_llm_timeout_seconds or 12.0))

    if provider == "openai":
        if not settings.openai_api_key.strip():
            return None
        _client = AsyncOpenAI(api_key=settings.openai_api_key.strip(), timeout=timeout)
        return _client

    if provider == "azure":
        if not (settings.azure_openai_key.strip() and settings.azure_openai_endpoint.strip()):
            return None
        _client = AsyncAzureOpenAI(
            api_version=(settings.azure_openai_api_version or "2024-08-01-preview").strip(),
            azure_endpoint=settings.azure_openai_endpoint.strip().rstrip("/"),
            api_key=settings.azure_openai_key.strip(),
            timeout=timeout,
        )
        return _client

    return None


def active_llm_model_name() -> str:
    return settings.active_llm_model()


def _should_retry_llm_error(exc: BaseException) -> bool:
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int):
        return status_code == 429 or status_code >= 500
    return True


async def chat_json_completion(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    client = _get_client()
    if client is None:
        return None

    model = active_llm_model_name()
    if not model:
        return None

    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    async def _once() -> Dict[str, Any]:
        response = await client.chat.completions.create(**kwargs)
        choice = response.choices[0] if response.choices else None
        raw = choice.message.content if choice and choice.message else None
        if not raw or not raw.strip():
            raise ValueError("empty LLM content")
        return json.loads(raw)

    started = time.perf_counter()
    try:
        result = await retry_async(
            _once,
            attempts=3,
            operation="llm_chat_json",
            should_retry=_should_retry_llm_error,
        )
        llm_chat_json_seconds.observe(time.perf_counter() - started)
        return result
    except Exception as exc:
        llm_chat_json_seconds.observe(time.perf_counter() - started)
        logger.warning("LLM chat_json_completion failed: %s", exc)
        return None


def reset_client_for_tests():
    global _client
    _client = None
