"""
Provider adapters for Voice Runtime V2.

These adapters keep transport and provider configuration separate from the
supervisor/specialist logic so the runtime can evolve without rewriting the
business brain.
"""
from __future__ import annotations

from typing import Dict

from config import settings


class LiveKitTransportAdapter:
    def validate(self) -> Dict[str, bool]:
        return {
            "configured": bool(settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret),
            "twilioConfigured": bool(settings.twilio_account_sid and settings.twilio_auth_token),
        }

    def build_dispatch_metadata(self, session_id: str, business_id: str) -> Dict[str, str]:
        return {
            "runtime": "voice-runtime-v2",
            "sessionId": session_id,
            "businessId": business_id,
        }


class DeepgramSttAdapter:
    def validate(self) -> Dict[str, bool]:
        return {"configured": bool(settings.deepgram_api_key)}


class ManagedTtsAdapter:
    def validate(self) -> Dict[str, str | bool]:
        return {
            "configured": bool(settings.managed_tts_provider),
            "provider": settings.managed_tts_provider,
        }


class ReasoningAdapter:
    def validate(self) -> Dict[str, str | bool]:
        return {
            "configured": bool(settings.azure_openai_key or settings.openai_api_key),
            "provider": "azure_openai" if settings.azure_openai_key else "openai" if settings.openai_api_key else "none",
            "model": settings.azure_openai_deployment,
        }
