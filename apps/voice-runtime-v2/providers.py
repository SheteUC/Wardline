"""
Provider adapters for Voice Runtime V2.

These adapters keep transport and provider configuration separate from the
supervisor/specialist logic so the runtime can evolve without rewriting the
business brain.
"""
from __future__ import annotations

import re
from typing import Dict

from config import settings


class LiveKitTransportAdapter:
    def validate(self) -> Dict[str, bool]:
        return {
            "configured": bool(settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret),
            "twilioConfigured": bool(settings.twilio_account_sid and settings.twilio_auth_token),
        }

    def build_room_name(self, business_id: str, call_sid: str) -> str:
        normalized_business = re.sub(r"[^a-z0-9-]", "-", business_id.lower()).strip("-") or "business"
        normalized_call = re.sub(r"[^a-zA-Z0-9]", "", call_sid) or "call"
        return f"wardline-{normalized_business[:32]}-{normalized_call[-12:]}".lower()

    def build_participant_identity(self, session_id: str) -> str:
        return f"wardline-session-{session_id}"

    def build_dispatch_metadata(self, session_id: str, business_id: str, call_sid: str) -> Dict[str, str]:
        return {
            "runtime": "voice-runtime-v2",
            "transport": "livekit",
            "sessionId": session_id,
            "businessId": business_id,
            "roomName": self.build_room_name(business_id, call_sid),
            "participantIdentity": self.build_participant_identity(session_id),
            "livekitUrl": settings.livekit_url,
        }


class DeepgramSttAdapter:
    def validate(self) -> Dict[str, bool]:
        return {"configured": bool(settings.deepgram_api_key)}

    def stream_config(self) -> Dict[str, str | bool]:
        return {
            "provider": "deepgram",
            "interimResults": True,
            "endpointing": "auto",
        }


class ManagedTtsAdapter:
    def validate(self) -> Dict[str, str | bool]:
        return {
            "configured": bool(settings.managed_tts_provider),
            "provider": settings.managed_tts_provider,
        }

    def output_config(self) -> Dict[str, str]:
        return {
            "provider": settings.managed_tts_provider,
            "format": "pcm16",
        }


class ReasoningAdapter:
    def validate(self) -> Dict[str, str | bool]:
        return {
            "configured": bool(settings.azure_openai_key or settings.openai_api_key),
            "provider": "azure_openai" if settings.azure_openai_key else "openai" if settings.openai_api_key else "none",
            "model": settings.azure_openai_deployment,
        }

    def request_config(self) -> Dict[str, str]:
        return {
            "provider": "azure_openai" if settings.azure_openai_key else "openai",
            "model": settings.azure_openai_deployment,
        }
