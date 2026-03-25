"""
Client for communicating with the Wardline Core API.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from config import settings


class CoreAPIClient:
    def __init__(self):
        self.base_url = settings.core_api_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=10.0)
        self._cache_ttl_seconds = 300
        self._runtime_config_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
        self._workflow_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}

    async def close(self):
        await self.client.aclose()

    async def _get_json(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        try:
            response = await self.client.get(f"{self.base_url}{path}", params=params)
            if response.status_code == 200:
                return response.json()
            logger.warning(f"GET {path} failed: {response.status_code}: {response.text}")
            return None
        except Exception as exc:
            logger.error(f"GET {path} failed: {exc}")
            return None

    async def _post_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            response = await self.client.post(f"{self.base_url}{path}", json=payload)
            if response.status_code in (200, 201):
                return response.json()
            logger.warning(f"POST {path} failed: {response.status_code}: {response.text}")
            return None
        except Exception as exc:
            logger.error(f"POST {path} failed: {exc}")
            return None

    async def _patch_json(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            response = await self.client.patch(f"{self.base_url}{path}", json=payload)
            if response.status_code == 200:
                return response.json()
            logger.warning(f"PATCH {path} failed: {response.status_code}: {response.text}")
            return None
        except Exception as exc:
            logger.error(f"PATCH {path} failed: {exc}")
            return None

    def _cache_get(self, cache: Dict[str, tuple[float, Dict[str, Any]]], key: str) -> Optional[Dict[str, Any]]:
        if key not in cache:
            return None
        cached_at, value = cache[key]
        if time.time() - cached_at > self._cache_ttl_seconds:
            cache.pop(key, None)
            return None
        return value

    def _cache_set(self, cache: Dict[str, tuple[float, Dict[str, Any]]], key: str, value: Dict[str, Any]):
        cache[key] = (time.time(), value)

    def invalidate_business_cache(self, business_id: str):
        self._runtime_config_cache.pop(business_id, None)
        for cache_key in list(self._workflow_cache.keys()):
            if cache_key.startswith(f"{business_id}:"):
                self._workflow_cache.pop(cache_key, None)

    async def get_business_by_phone(self, phone_number: str) -> Optional[Dict[str, Any]]:
        formatted = "".join(filter(str.isdigit, phone_number))
        return await self._get_json("/businesses/by-phone", params={"phoneNumber": formatted})

    async def get_business(self, business_id: str) -> Optional[Dict[str, Any]]:
        return await self._get_json(f"/businesses/{business_id}", params={"includeRelations": "true"})

    async def get_runtime_config(self, business_id: str) -> Optional[Dict[str, Any]]:
        cached = self._cache_get(self._runtime_config_cache, business_id)
        if cached is not None:
            return cached

        runtime_config = await self._get_json(f"/businesses/{business_id}/runtime-config")
        if runtime_config is not None:
            self._cache_set(self._runtime_config_cache, business_id, runtime_config)
        return runtime_config

    async def get_business_config(self, business_id: str) -> Optional[Dict[str, Any]]:
        runtime_config = await self.get_runtime_config(business_id)
        if runtime_config:
            return runtime_config.get("settings")
        return None

    async def get_active_workflow(
        self,
        business_id: str,
        phone_number_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        cache_key = f"{business_id}:{phone_number_id or 'default'}"
        cached = self._cache_get(self._workflow_cache, cache_key)
        if cached is not None:
            return cached

        workflow = await self._get_json(
            "/workflows/active",
            params={"businessId": business_id, "phoneNumberId": phone_number_id} if phone_number_id else {"businessId": business_id},
        )

        if workflow is None:
            runtime_config = await self.get_runtime_config(business_id)
            workflow = runtime_config.get("activeWorkflow") if runtime_config else None

        if workflow is not None:
            self._cache_set(self._workflow_cache, cache_key, workflow)
        return workflow

    async def get_workflow(self, business_id: str, workflow_id: str) -> Optional[Dict[str, Any]]:
        active_workflow = await self.get_active_workflow(business_id)
        if active_workflow and active_workflow.get("id") == workflow_id:
            return active_workflow
        return None

    async def get_intents(self, _business_id: str) -> List[Dict[str, Any]]:
        return []

    async def get_departments(self, _business_id: str) -> List[Dict[str, Any]]:
        return []

    async def get_call_by_twilio_sid(self, twilio_call_sid: str) -> Optional[Dict[str, Any]]:
        result = await self._get_json("/api/calls", params={"twilioCallSid": twilio_call_sid})
        if isinstance(result, list):
            return result[0] if result else None
        calls = result.get("data", []) if isinstance(result, dict) else []
        return calls[0] if calls else None

    async def create_call_session(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        payload = {
            "direction": data.get("direction", "INBOUND"),
            "fromNumber": data.get("fromNumber", ""),
            "toNumber": data.get("toNumber", ""),
            "twilioCallSid": data.get("twilioCallSid", ""),
        }
        return await self._post_json("/api/calls", payload)

    async def update_call_session(self, call_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._patch_json(f"/api/calls/{call_id}", data)

    async def create_voicemail(self, call_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json(f"/api/calls/{call_id}/voicemail", payload)

    async def create_follow_up_task(self, business_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await self._post_json(f"/api/businesses/{business_id}/follow-up-tasks", payload)

    async def execute_runtime_action(
        self,
        business_id: str,
        action_name: str,
        payload: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        return await self._post_json(
            f"/api/businesses/{business_id}/runtime-actions/{action_name}",
            payload,
        )

    async def check_insurance_plan(
        self,
        business_id: str,
        carrier_name: str,
        plan_name: str = "",
        call_id: Optional[str] = None,
        caller_name: str = "",
        caller_phone: str = "",
    ) -> Optional[Dict[str, Any]]:
        result = await self.execute_runtime_action(
            business_id,
            "insurance-check",
            {
                "callId": call_id,
                "callerName": caller_name or None,
                "callerPhone": caller_phone or None,
                "carrierName": carrier_name,
                "planName": plan_name or None,
                "inquiryType": "acceptance",
            },
        )
        if result is None:
            return None

        data = result.get("data", {})
        if data:
            return {
                "isAccepted": data.get("isAccepted", False),
                "planName": data.get("planName", plan_name),
                "carrierName": data.get("carrierName", carrier_name),
            }

        return {
            "isAccepted": False,
            "planName": plan_name,
            "carrierName": carrier_name,
        }

    async def create_appointment(
        self,
        business_id: str,
        patient_name: str,
        patient_phone: str,
        service_type: str,
        preferred_date: str = "",
        preferred_time: str = "",
        notes: str = "",
        call_id: Optional[str] = None,
        confirmed: bool = False,
    ) -> Optional[Dict[str, Any]]:
        return await self.execute_runtime_action(
            business_id,
            "appointment-request",
            {
                "callId": call_id,
                "callerName": patient_name,
                "callerPhone": patient_phone,
                "serviceType": service_type,
                "preferredDate": preferred_date or None,
                "preferredTime": preferred_time or None,
                "notes": notes or None,
                "confirmed": confirmed,
            },
        )

    async def create_prescription_refill(
        self,
        business_id: str,
        patient_name: str,
        patient_phone: str,
        medication_name: str,
        pharmacy_name: str = "",
        pharmacy_phone: str = "",
        call_id: Optional[str] = None,
        confirmed: bool = False,
    ) -> Optional[Dict[str, Any]]:
        return await self.execute_runtime_action(
            business_id,
            "refill-request",
            {
                "callId": call_id,
                "callerName": patient_name,
                "callerPhone": patient_phone,
                "medicationName": medication_name,
                "pharmacyName": pharmacy_name or None,
                "pharmacyPhone": pharmacy_phone or None,
                "confirmed": confirmed,
            },
        )

    async def create_billing_request(
        self,
        business_id: str,
        caller_name: str,
        caller_phone: str,
        billing_topic: str,
        account_reference: str = "",
        notes: str = "",
        call_id: Optional[str] = None,
        confirmed: bool = False,
    ) -> Optional[Dict[str, Any]]:
        return await self.execute_runtime_action(
            business_id,
            "billing-request",
            {
                "callId": call_id,
                "callerName": caller_name,
                "callerPhone": caller_phone,
                "billingTopic": billing_topic,
                "accountReference": account_reference or None,
                "notes": notes or None,
                "confirmed": confirmed,
            },
        )

    async def check_insurance(self, carrier_name: str, plan_name: str = "") -> Optional[Dict[str, Any]]:
        return await self.check_insurance_plan("", carrier_name, plan_name)

    async def request_prescription_refill(
        self,
        business_id: str,
        patient_name: str,
        patient_phone: str,
        medication_name: str,
        pharmacy_name: str = "",
        pharmacy_phone: str = "",
        call_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        return await self.create_prescription_refill(
            business_id=business_id,
            patient_name=patient_name,
            patient_phone=patient_phone,
            medication_name=medication_name,
            pharmacy_name=pharmacy_name,
            pharmacy_phone=pharmacy_phone,
            call_id=call_id,
        )

    async def create_escalation(self, context_package: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        business_id = context_package.get("businessId")
        if not business_id:
            logger.warning("Cannot create escalation without business ID")
            return None

        title = "Urgent follow-up requested" if context_package.get("isUrgent") else "Manual follow-up requested"
        result = await self.execute_runtime_action(
            business_id,
            "manual-follow-up",
            {
                "callId": context_package.get("callId"),
                "callerName": context_package.get("callerName"),
                "callerPhone": context_package.get("callerPhone"),
                "title": title,
                "summary": context_package.get("reason") or context_package.get("context_summary") or "Caller requested staff follow-up.",
                "priority": "URGENT" if context_package.get("isUrgent") else "HIGH",
                "urgencyKeywords": context_package.get("urgencyKeywords") or [],
            },
        )
        if result is not None:
            self.invalidate_business_cache(business_id)
        return result

    async def get_available_agents(
        self,
        _business_id: str,
        _queue_id: str,
        required_skills: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        logger.debug(f"Agent lookup not implemented for V1 runtime; required_skills={required_skills}")
        return []

    async def update_call_workflow_progress(
        self,
        call_id: str,
        progress_data: Dict[str, Any],
    ) -> bool:
        result = await self.update_call_session(call_id, progress_data)
        return result is not None

    async def create_safety_event(self, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        business_id = event_data.get("businessId")
        if not business_id:
            return None
        return await self.create_follow_up_task(
            business_id,
            {
                "callId": event_data.get("callId"),
                "type": "URGENT_CALLBACK",
                "priority": "URGENT",
                "title": "Safety event follow-up",
                "summary": event_data.get("context") or event_data.get("action_taken") or "Safety event captured during call.",
                "callerName": event_data.get("callerName"),
                "callerPhone": event_data.get("callerPhone"),
                "urgencyKeywords": [event_data.get("keyword")] if event_data.get("keyword") else [],
            },
        )

    async def create_workflow_execution_log(self, log_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        logger.debug(
            "Workflow execution log recorded locally only",
            workflow_id=log_data.get("workflow_id"),
            call_id=log_data.get("call_id"),
        )
        return {"accepted": True}


api_client = CoreAPIClient()
