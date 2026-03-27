"""
Core API client for Voice Runtime V2.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

import httpx

from config import settings


class CoreApiClient:
    def __init__(self):
        self.base_url = settings.core_api_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=10.0)

    async def close(self):
        await self.client.aclose()

    async def _get_json(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        response = await self.client.get(f"{self.base_url}{path}", params=params)
        if response.status_code == 200:
            return response.json()
        return None

    async def _post_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        response = await self.client.post(f"{self.base_url}{path}", json=payload)
        if response.status_code in (200, 201):
            return response.json()
        return None

    async def _patch_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        response = await self.client.patch(f"{self.base_url}{path}", json=payload)
        if response.status_code == 200:
            return response.json()
        return None

    async def get_business_by_phone(self, phone_number: str) -> Optional[Dict[str, Any]]:
        digits = "".join(filter(str.isdigit, phone_number))
        return await self._get_json("/businesses/by-phone", params={"phoneNumber": digits})

    async def get_runtime_config(self, business_id: str) -> Optional[Dict[str, Any]]:
        return await self._get_json(f"/businesses/{business_id}/runtime-config")

    async def create_call_session(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json("/api/calls", payload)

    async def update_call_session(self, call_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._patch_json(f"/api/calls/{call_id}", payload)

    async def create_voicemail(self, call_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json(f"/api/calls/{call_id}/voicemail", payload)

    async def execute_runtime_action(
        self,
        business_id: str,
        action_name: str,
        payload: Dict[str, Any],
    ) -> tuple[Optional[Dict[str, Any]], float]:
        started_at = time.perf_counter()
        result = await self._post_json(f"/api/businesses/{business_id}/runtime-actions/{action_name}", payload)
        return result, round((time.perf_counter() - started_at) * 1000, 2)
