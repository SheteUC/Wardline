"""
Provider adapters for Voice Runtime V2.

These adapters keep transport and provider configuration separate from the
supervisor/specialist logic so the runtime can evolve without rewriting the
business brain.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urljoin, urlparse, urlunparse
from xml.sax.saxutils import escape

import httpx

from config import settings


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def build_public_websocket_url(path: str) -> str:
    base_url = settings.webhook_base_url.rstrip("/") or f"http://127.0.0.1:{settings.port}"
    if not base_url:
        return ""

    joined = urljoin(f"{base_url}/", path.lstrip("/"))
    parsed = urlparse(joined)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return urlunparse(parsed._replace(scheme=scheme))


def build_public_callback_url(path: str) -> str:
    base_url = settings.webhook_base_url.rstrip("/") or f"http://127.0.0.1:{settings.port}"
    if not base_url:
        return ""
    return urljoin(f"{base_url}/", path.lstrip("/"))


def public_callback_url_is_secure(base_url: str) -> bool:
    parsed = urlparse(base_url.strip())
    return parsed.scheme == "https" and bool(parsed.netloc)


@dataclass(slots=True)
class TranscriptResult:
    text: str
    final: bool
    confidence: Optional[float] = None
    provider_session_id: Optional[str] = None


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

    def build_room_token(
        self,
        *,
        participant_identity: str,
        room_name: str,
        metadata: Dict[str, Any],
    ) -> str:
        if not settings.livekit_api_key or not settings.livekit_api_secret:
            return ""

        now = int(time.time())
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "iss": settings.livekit_api_key,
            "sub": participant_identity,
            "nbf": now - 5,
            "exp": now + max(settings.livekit_token_ttl_minutes, 1) * 60,
            "video": {
                "roomJoin": True,
                "room": room_name,
            },
            "metadata": json.dumps(metadata),
            "name": "Wardline Voice Runtime V2",
        }

        header_segment = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        payload_segment = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
        signature = hmac.new(
            settings.livekit_api_secret.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        return f"{header_segment}.{payload_segment}.{_base64url_encode(signature)}"

    def build_dispatch_metadata(self, session_id: str, business_id: str, call_sid: str) -> Dict[str, str]:
        room_name = self.build_room_name(business_id, call_sid)
        participant_identity = self.build_participant_identity(session_id)
        metadata = {
            "runtime": "voice-runtime-v2",
            "transport": "livekit",
            "sessionId": session_id,
            "businessId": business_id,
            "callSid": call_sid,
        }
        return {
            "runtime": "voice-runtime-v2",
            "transport": "livekit",
            "sessionId": session_id,
            "businessId": business_id,
            "roomName": room_name,
            "participantIdentity": participant_identity,
            "livekitUrl": settings.livekit_url,
            "twilioCallSid": call_sid,
            "livekitAccessToken": self.build_room_token(
                participant_identity=participant_identity,
                room_name=room_name,
                metadata=metadata,
            ),
            "twilioMediaStreamUrl": build_public_websocket_url(settings.twilio_media_stream_path),
        }


class TwilioTelephonyAdapter:
    def build_stream_twiml(self, *, stream_url: str, parameters: Dict[str, str]) -> str:
        parameter_markup = "".join(
            f'<Parameter name="{escape(name)}" value="{escape(value)}" />'
            for name, value in parameters.items()
            if value
        )
        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            "<Connect>"
            f'<Stream url="{escape(stream_url)}">{parameter_markup}</Stream>'
            "</Connect>"
            "</Response>"
        )

    def build_error_twiml(self, message: str) -> str:
        safe_message = escape(message)
        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            f"<Say>{safe_message}</Say>"
            "<Hangup />"
            "</Response>"
        )

    def build_transfer_twiml(
        self,
        *,
        transfer_phone: str,
        action_url: str,
        timeout_seconds: int,
        caller_id: str = "",
        preamble_message: str = "",
    ) -> str:
        caller_id_markup = f' callerId="{escape(caller_id)}"' if caller_id else ""
        say_markup = f"<Say>{escape(preamble_message)}</Say>" if preamble_message else ""
        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            f"{say_markup}"
            f'<Dial timeout="{max(10, min(45, int(timeout_seconds or 20)))}" action="{escape(action_url)}" method="POST"{caller_id_markup}>'
            f"<Number>{escape(transfer_phone)}</Number>"
            "</Dial>"
            "</Response>"
        )

    async def redirect_live_call(
        self,
        *,
        call_sid: str,
        transfer_twiml: str,
    ) -> Dict[str, Any]:
        if not settings.twilio_account_sid or not settings.twilio_auth_token:
            raise ValueError("Twilio credentials are not configured for live transfer.")
        if not call_sid:
            raise ValueError("Call SID is required for live transfer.")

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Calls/{call_sid}.json"
        async with httpx.AsyncClient(timeout=20.0, auth=(settings.twilio_account_sid, settings.twilio_auth_token)) as client:
            response = await client.post(url, data={"Twiml": transfer_twiml})
            response.raise_for_status()
            return response.json()


class DeepgramSttAdapter:
    def validate(self) -> Dict[str, Any]:
        return {
            "configured": bool(settings.deepgram_api_key),
            "model": settings.deepgram_stt_model,
        }

    def stream_config(self) -> Dict[str, Any]:
        return {
            "provider": "deepgram",
            "interimResults": True,
            "endpointing": "auto",
            "encoding": "mulaw",
            "sampleRate": 8000,
            "channels": 1,
            "model": settings.deepgram_stt_model,
            "smartFormat": True,
        }

    def websocket_url(self) -> str:
        query = urlencode(
            {
                "encoding": "mulaw",
                "sample_rate": 8000,
                "channels": 1,
                "interim_results": "true",
                "endpointing": "300",
                "smart_format": "true",
                "model": settings.deepgram_stt_model,
            }
        )
        return f"wss://api.deepgram.com/v1/listen?{query}"

    def normalize_message(self, payload: Dict[str, Any]) -> Optional[TranscriptResult]:
        if not isinstance(payload, dict):
            return None

        channel = payload.get("channel")
        alternatives = channel.get("alternatives") if isinstance(channel, dict) else None
        alternative = alternatives[0] if isinstance(alternatives, list) and alternatives else {}
        transcript = alternative.get("transcript") if isinstance(alternative, dict) else ""
        if not isinstance(transcript, str) or not transcript.strip():
            return None

        confidence = alternative.get("confidence") if isinstance(alternative, dict) else None
        request_id = payload.get("metadata", {}).get("request_id") if isinstance(payload.get("metadata"), dict) else None
        return TranscriptResult(
            text=transcript.strip(),
            final=bool(payload.get("is_final")),
            confidence=float(confidence) if isinstance(confidence, (float, int)) else None,
            provider_session_id=request_id if isinstance(request_id, str) else None,
        )


class ManagedTtsAdapter:
    def validate(self) -> Dict[str, Any]:
        configured = False
        if settings.managed_tts_provider == "deepgram":
            configured = bool(settings.deepgram_api_key)
        elif settings.managed_tts_provider:
            configured = True

        return {
            "configured": configured,
            "provider": settings.managed_tts_provider,
            "model": settings.deepgram_tts_model if settings.managed_tts_provider == "deepgram" else None,
        }

    def output_config(self) -> Dict[str, Any]:
        return {
            "provider": settings.managed_tts_provider,
            "format": "audio/x-mulaw",
            "encoding": "mulaw",
            "sampleRate": 8000,
            "model": settings.deepgram_tts_model,
        }

    async def synthesize(self, text: str) -> bytes:
        if settings.managed_tts_provider != "deepgram" or not settings.deepgram_api_key or not text.strip():
            return b""

        url = (
            "https://api.deepgram.com/v1/speak?"
            + urlencode(
                {
                    "model": settings.deepgram_tts_model,
                    "encoding": "mulaw",
                    "sample_rate": 8000,
                    "container": "none",
                }
            )
        )

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Token {settings.deepgram_api_key}",
                    "Content-Type": "application/json",
                },
                json={"text": text},
            )
            if response.status_code != 200:
                return b""
            return response.content


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
