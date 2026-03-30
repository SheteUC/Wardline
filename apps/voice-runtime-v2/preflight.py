"""
Real-call preflight checks for Voice Runtime V2.
"""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse

from config import settings
from providers import (
    DeepgramSttAdapter,
    LiveKitTransportAdapter,
    ManagedTtsAdapter,
    build_public_websocket_url,
    public_callback_url_is_secure,
)


def build_real_call_preflight_report() -> dict[str, Any]:
    errors: list[str] = []
    notes: list[str] = []
    callback_url = settings.webhook_base_url.strip()
    media_stream_url = build_public_websocket_url(settings.twilio_media_stream_path)
    voice_runtime_public_url = os.getenv("VOICE_RUNTIME_V2_PUBLIC_URL", "").strip()
    webhook_base_url = os.getenv("WEBHOOK_BASE_URL", "").strip()

    if not callback_url:
        errors.append("VOICE_RUNTIME_V2_PUBLIC_URL or WEBHOOK_BASE_URL must be set.")
    elif not public_callback_url_is_secure(callback_url):
        errors.append("VOICE_RUNTIME_V2_PUBLIC_URL or WEBHOOK_BASE_URL must be an https:// URL.")
    else:
        parsed_callback_url = urlparse(callback_url)
        if parsed_callback_url.hostname in {"localhost", "127.0.0.1", "0.0.0.0"}:
            errors.append("VOICE_RUNTIME_V2_PUBLIC_URL or WEBHOOK_BASE_URL must be publicly reachable, not localhost.")

    if voice_runtime_public_url and webhook_base_url and voice_runtime_public_url != webhook_base_url:
        errors.append("VOICE_RUNTIME_V2_PUBLIC_URL and WEBHOOK_BASE_URL must match for the first real-call proof.")

    if not voice_runtime_public_url or not webhook_base_url:
        notes.append("Set both VOICE_RUNTIME_V2_PUBLIC_URL and WEBHOOK_BASE_URL to the same tunnel URL.")

    parsed_media_stream_url = urlparse(media_stream_url)
    if not media_stream_url:
        errors.append("TWILIO_MEDIA_STREAM_PATH could not be resolved into a media websocket URL.")
    elif parsed_media_stream_url.scheme != "wss" or not parsed_media_stream_url.netloc:
        errors.append("The Twilio media stream URL must resolve to wss://.../telephony/twilio/media.")

    required_env_vars = {
        "TWILIO_ACCOUNT_SID": settings.twilio_account_sid,
        "TWILIO_AUTH_TOKEN": settings.twilio_auth_token,
        "TWILIO_PHONE_NUMBER": settings.twilio_phone_number,
        "LIVEKIT_URL": settings.livekit_url,
        "LIVEKIT_API_KEY": settings.livekit_api_key,
        "LIVEKIT_API_SECRET": settings.livekit_api_secret,
        "DEEPGRAM_API_KEY": settings.deepgram_api_key,
    }

    for label, value in required_env_vars.items():
        if not value.strip():
            errors.append(f"{label} must be set.")

    provider_readiness = {
        "livekit": LiveKitTransportAdapter().validate(),
        "deepgram": DeepgramSttAdapter().validate(),
        "tts": ManagedTtsAdapter().validate(),
    }

    if not provider_readiness["tts"].get("configured"):
        errors.append("Managed TTS is not configured for the first real-call proof.")

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "notes": notes,
        "callbackUrl": callback_url,
        "bootstrapUrl": f"{callback_url.rstrip('/')}/telephony/twilio/bootstrap" if callback_url else "",
        "twilioMediaStreamUrl": media_stream_url,
        "providers": provider_readiness,
    }


def default_bootstrap_error_message() -> str:
    return (
        "We're sorry, but the virtual receptionist is not ready to take live calls right now. "
        "Please try again shortly."
    )


def print_preflight_report(report: dict[str, Any]) -> None:
    if report["ok"]:
        print("Voice Runtime V2 real-call preflight passed.")
        print(f"- Callback URL: {report['callbackUrl']}")
        print(f"- Twilio bootstrap URL: {report['bootstrapUrl']}")
        print(f"- Twilio media stream URL: {report['twilioMediaStreamUrl']}")
        for provider_name, readiness in report["providers"].items():
            print(f"- {provider_name}: {readiness}")
        for note in report.get("notes", []):
            print(f"- note: {note}")
        return

    print("Voice Runtime V2 real-call preflight failed.")
    for error in report["errors"]:
        print(f"- {error}")
    for note in report.get("notes", []):
        print(f"- note: {note}")


def main() -> int:
    report = build_real_call_preflight_report()
    print_preflight_report(report)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
