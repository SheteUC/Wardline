"""
Core API client for Voice Runtime V2.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

import httpx

from circuit_breaker import CircuitOpenError
from config import settings
from observability.metrics import record_provider_error
from observability.context import outbound_headers
from retry_async import retry_async


def _retryable_status(status_code: int) -> bool:
    return status_code in (408, 429, 502, 503, 504)


class RetryableCoreApiError(RuntimeError):
    """Raised when the core API fails with a retryable status."""


class CoreApiClient:
    def __init__(self):
        self.base_url = settings.resolved_core_api_url().rstrip("/")
        prefix = (settings.core_api_path_prefix or "/v1").strip() or "/v1"
        self._path_prefix = prefix.rstrip("/") or "/v1"
        self.client = httpx.AsyncClient(timeout=settings.voice_core_api_timeout_seconds)
        self._http_attempts = max(1, int(settings.voice_http_max_retries or 3))

    def _versioned_path(self, path: str) -> str:
        p = path if path.startswith("/") else f"/{path}"
        return f"{self._path_prefix}{p}"

    def _internal_headers(self) -> Dict[str, str]:
        secret = settings.wardline_internal_api_secret.strip()
        base: Dict[str, str] = {**outbound_headers()}
        if secret:
            base["X-Wardline-Internal-Secret"] = secret
        return base

    async def _request_json(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        success_codes: tuple[int, ...] = (200,),
    ) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}{path}"
        headers = self._internal_headers()
        request_method = getattr(self.client, method)

        async def _once() -> Optional[Dict[str, Any]]:
            request_kwargs: Dict[str, Any] = {
                "headers": headers,
            }
            if params is not None:
                request_kwargs["params"] = params
            if payload is not None:
                request_kwargs["json"] = payload

            response = await request_method(url, **request_kwargs)
            if response.status_code in success_codes:
                if not response.content:
                    return {}
                return response.json()
            if _retryable_status(response.status_code):
                raise RetryableCoreApiError(
                    f"Core API {method.upper()} {path} returned HTTP {response.status_code}",
                )
            return None

        try:
            return await retry_async(
                _once,
                attempts=self._http_attempts,
                base_delay_s=0.2,
                max_delay_s=2.0,
                operation=f"core_api_{method}",
                circuit_name="core_api",
            )
        except httpx.RequestError:
            record_provider_error("core_api", "request_error")
            return None
        except RetryableCoreApiError:
            record_provider_error("core_api", "retryable_http")
            return None
        except CircuitOpenError:
            record_provider_error("core_api", "circuit_open")
            return None

    async def close(self):
        await self.client.aclose()

    async def _get_json(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        return await self._request_json("get", path, params=params)

    async def _post_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._request_json(
            "post",
            self._versioned_path(path),
            payload=payload,
            success_codes=(200, 201),
        )

    async def _patch_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._request_json(
            "patch",
            self._versioned_path(path),
            payload=payload,
        )

    async def get_caller_context(self, business_id: str, caller_phone: str) -> Optional[Dict[str, Any]]:
        digits = "".join(filter(str.isdigit, caller_phone))
        return await self._get_json(
            "/api/internal/voice/caller-context",
            params={"businessId": business_id, "callerPhone": digits},
        )

    async def get_business_by_phone(self, phone_number: str) -> Optional[Dict[str, Any]]:
        digits = "".join(filter(str.isdigit, phone_number))
        return await self._get_json("/businesses/by-phone", params={"phoneNumber": digits})

    async def get_runtime_config(self, business_id: str) -> Optional[Dict[str, Any]]:
        return await self._get_json(f"/businesses/{business_id}/runtime-config")

    async def bootstrap_voice_session(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json("/api/internal/voice/bootstrap", payload)

    async def ingest_call(
        self,
        call_id: str,
        payload: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        return await self._post_json(f"/api/internal/calls/{call_id}/ingest", payload)

    async def create_call_session(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json("/api/calls", payload)

    async def update_call_session(self, call_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._patch_json(f"/api/calls/{call_id}", payload)

    async def create_voicemail(self, call_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json(f"/api/calls/{call_id}/voicemail", payload)

    async def save_transcript(self, call_id: str, segments: list[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return await self._post_json(f"/api/calls/{call_id}/transcript", {"segments": segments})

    async def escalate_to_human(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json("/api/escalations/human-transfer", payload)

    async def execute_runtime_action(
        self,
        business_id: str,
        action_name: str,
        payload: Dict[str, Any],
    ) -> tuple[Optional[Dict[str, Any]], float]:
        started_at = time.perf_counter()
        result = await self._post_json(
            f"/api/businesses/{business_id}/runtime-actions/{action_name}",
            payload,
        )
        return result, round((time.perf_counter() - started_at) * 1000, 2)
