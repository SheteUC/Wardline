"""
Configuration for Wardline Voice Runtime V2.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent
REPO_ROOT = APP_DIR.parents[1]

for env_path in (REPO_ROOT / ".env.local", REPO_ROOT / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    host: str = Field(default="0.0.0.0")
    port: int = Field(
        default=3003,
        validation_alias=AliasChoices("VOICE_RUNTIME_V2_PORT", "VOICE_V2_PORT"),
    )
    debug: bool = Field(default=False)

    core_api_url: str = Field(default="http://localhost:3001", alias="CORE_API_BASE_URL")
    webhook_base_url: str = Field(
        default="",
        validation_alias=AliasChoices("VOICE_RUNTIME_V2_PUBLIC_URL", "WEBHOOK_BASE_URL"),
    )

    livekit_url: str = Field(default="", alias="LIVEKIT_URL")
    livekit_api_key: str = Field(default="", alias="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(default="", alias="LIVEKIT_API_SECRET")
    livekit_token_ttl_minutes: int = Field(default=60, alias="LIVEKIT_TOKEN_TTL_MINUTES")
    deepgram_api_key: str = Field(default="", alias="DEEPGRAM_API_KEY")
    deepgram_stt_model: str = Field(default="nova-2-phonecall", alias="DEEPGRAM_STT_MODEL")
    deepgram_tts_model: str = Field(default="aura-2-thalia-en", alias="DEEPGRAM_TTS_MODEL")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    azure_openai_key: str = Field(default="", alias="AZURE_OPENAI_KEY")
    azure_openai_endpoint: str = Field(default="", alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_deployment: str = Field(default="gpt-4o-mini", alias="AZURE_OPENAI_DEPLOYMENT")

    twilio_account_sid: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(default="", alias="TWILIO_PHONE_NUMBER")
    twilio_media_stream_path: str = Field(default="/telephony/twilio/media", alias="TWILIO_MEDIA_STREAM_PATH")
    voice_runtime_legacy_call_sync: bool = Field(default=True, alias="VOICE_RUNTIME_LEGACY_CALL_SYNC")

    managed_tts_provider: str = Field(default="deepgram", alias="MANAGED_TTS_PROVIDER")


settings = Settings()
