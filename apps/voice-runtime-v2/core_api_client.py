"""
Core API client for Voice Runtime V2.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional

import httpx

from config import settings


def _retryable_status(status_code: int) -> bool:
    return status_code in (408, 429, 502, 503, 504)


class CoreApiClient:
    def __init__(self):
        self.base_url = settings.resolved_core_api_url().rstrip("/")
        self.client = httpx.AsyncClient(timeout=10.0)
        self._http_attempts = max(1, int(settings.voice_http_max_retries or 3))

    def _internal_headers(self) -> Dict[str, str]:
        secret = settings.wardline_internal_api_secret.strip()
        if not secret:
            return {}
        return {"X-Wardline-Internal-Secret": secret}

    async def close(self):
        await self.client.aclose()

    async def _get_json(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}{path}"
        headers = self._internal_headers()
        for attempt in range(self._http_attempts):
            try:
                response = await self.client.get(url, params=params, headers=headers)
                if response.status_code == 200:
                    return response.json()
                if _retryable_status(response.status_code) and attempt + 1 < self._http_attempts:
                    await asyncio.sleep(min(2.0, 0.2 * (2**attempt)))
                    continue
                return None
            except httpx.RequestError:
                if attempt + 1 < self._http_attempts:
                    await asyncio.sleep(min(2.0, 0.2 * (2**attempt)))
                    continue
                return None
        return None

    async def _post_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}{path}"
        headers = self._internal_headers()
        for attempt in range(self._http_attempts):
            try:
                response = await self.client.post(url, json=payload, headers=headers)
                if response.status_code in (200, 201):
                    return response.json()
                if _retryable_status(response.status_code) and attempt + 1 < self._http_attempts:
                    await asyncio.sleep(min(2.0, 0.2 * (2**attempt)))
                    continue
                return None
            except httpx.RequestError:
                if attempt + 1 < self._http_attempts:
                    await asyncio.sleep(min(2.0, 0.2 * (2**attempt)))
                    continue
                return None
        return None

    async def _patch_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}{path}"
        headers = self._internal_headers()
        for attempt in range(self._http_attempts):
            try:
                response = await self.client.patch(url, json=payload, headers=headers)
                if response.status_code == 200:
                    return response.json()
                if _retryable_status(response.status_code) and attempt + 1 < self._http_attempts:
                    await asyncio.sleep(min(2.0, 0.2 * (2**attempt)))
                    continue
                return None
            except httpx.RequestError:
                if attempt + 1 < self._http_attempts:
                    await asyncio.sleep(min(2.0, 0.2 * (2**attempt)))
                    continue
                return None
        return None

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
