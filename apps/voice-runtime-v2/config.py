"""
Configuration for Wardline Voice Runtime V2.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent


def _resolve_repo_root(app_dir: Path) -> Path:
    for candidate in (app_dir, *app_dir.parents):
        if (candidate / "pnpm-workspace.yaml").exists() or (candidate / ".git").exists():
            return candidate
    # In container images the app is copied directly to /app, so treat that as
    # the effective root for optional env-file loading.
    return app_dir


REPO_ROOT = _resolve_repo_root(APP_DIR)

# Load base .env first, then .env.local with override so local wins (matches typical monorepo convention).
# Previously .env.local was loaded first with override=False on .env, so an empty OPENAI_API_KEY in
# .env.local blocked the real key defined only in .env.
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    load_dotenv(_env_file, override=False)
_env_local = REPO_ROOT / ".env.local"
if _env_local.exists():
    load_dotenv(_env_local, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    host: str = Field(default="0.0.0.0")
    port: int = Field(
        default=3003,
        validation_alias=AliasChoices("VOICE_RUNTIME_V2_PORT", "VOICE_V2_PORT"),
    )
    debug: bool = Field(default=False)

    core_api_url: str = Field(default="", alias="CORE_API_BASE_URL")
    core_api_hostport: str = Field(default="", alias="CORE_API_HOSTPORT")
    core_api_path_prefix: str = Field(default="/v1", alias="CORE_API_PATH_PREFIX")
    webhook_base_url: str = Field(
        default="",
        validation_alias=AliasChoices("VOICE_RUNTIME_V2_PUBLIC_URL", "WEBHOOK_BASE_URL"),
    )
    render_external_url: str = Field(default="", alias="RENDER_EXTERNAL_URL")

    livekit_url: str = Field(default="", alias="LIVEKIT_URL")
    livekit_api_key: str = Field(default="", alias="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(default="", alias="LIVEKIT_API_SECRET")
    livekit_token_ttl_minutes: int = Field(default=60, alias="LIVEKIT_TOKEN_TTL_MINUTES")
    deepgram_api_key: str = Field(default="", alias="DEEPGRAM_API_KEY")
    deepgram_stt_model: str = Field(default="nova-2-phonecall", alias="DEEPGRAM_STT_MODEL")
    deepgram_tts_model: str = Field(default="aura-2-thalia-en", alias="DEEPGRAM_TTS_MODEL")
    deepgram_endpointing_ms: int = Field(default=1800, alias="DEEPGRAM_ENDPOINTING_MS")
    deepgram_utterance_end_ms: int = Field(default=2500, alias="DEEPGRAM_UTTERANCE_END_MS")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    llm_provider: str = Field(default="auto", alias="LLM_PROVIDER")
    azure_openai_key: str = Field(default="", alias="AZURE_OPENAI_KEY")
    azure_openai_endpoint: str = Field(default="", alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_deployment: str = Field(default="gpt-4o-mini", alias="AZURE_OPENAI_DEPLOYMENT")
    azure_openai_api_version: str = Field(default="2024-08-01-preview", alias="AZURE_OPENAI_API_VERSION")

    voice_llm_supervisor: bool = Field(default=True, alias="VOICE_LLM_SUPERVISOR")
    voice_llm_safety: bool = Field(default=True, alias="VOICE_LLM_SAFETY")
    voice_llm_slots: bool = Field(default=True, alias="VOICE_LLM_SLOTS")
    voice_llm_agents: bool = Field(default=True, alias="VOICE_LLM_AGENTS")
    voice_llm_timeout_seconds: float = Field(default=12.0, alias="VOICE_LLM_TIMEOUT_SECONDS")

    twilio_account_sid: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(default="", alias="TWILIO_PHONE_NUMBER")
    # Public origin Twilio used to POST webhooks (e.g. https://voice.example.com). Required for signature validation in production.
    twilio_webhook_public_url: str = Field(default="", alias="TWILIO_WEBHOOK_PUBLIC_URL")
    twilio_skip_signature_validation: bool = Field(default=False, alias="TWILIO_SKIP_SIGNATURE_VALIDATION")
    twilio_media_stream_path: str = Field(default="/telephony/twilio/media", alias="TWILIO_MEDIA_STREAM_PATH")
    wardline_internal_api_secret: str = Field(default="", alias="WARDLINE_INTERNAL_API_SECRET")
    voice_runtime_legacy_call_sync: bool = Field(default=True, alias="VOICE_RUNTIME_LEGACY_CALL_SYNC")

    managed_tts_provider: str = Field(default="deepgram", alias="MANAGED_TTS_PROVIDER")

    redis_url: str = Field(default="", alias="REDIS_URL")
    voice_session_ttl_seconds: int = Field(default=4 * 3600, alias="VOICE_SESSION_TTL_SECONDS")
    voice_session_max_cached: int = Field(default=5000, alias="VOICE_SESSION_MAX_CACHED")
    voice_session_lock_timeout_seconds: float = Field(default=120.0, alias="VOICE_SESSION_LOCK_TIMEOUT_SECONDS")
    voice_session_lock_blocking_seconds: float = Field(default=0.25, alias="VOICE_SESSION_LOCK_BLOCKING_SECONDS")
    voice_shutdown_drain_seconds: float = Field(default=30.0, alias="VOICE_SHUTDOWN_DRAIN_SECONDS")
    voice_deepgram_reconnect_attempts: int = Field(default=8, alias="VOICE_DEEPGRAM_RECONNECT_ATTEMPTS")
    voice_http_max_retries: int = Field(default=3, alias="VOICE_HTTP_MAX_RETRIES")
    voice_core_api_timeout_seconds: float = Field(default=10.0, alias="VOICE_CORE_API_TIMEOUT_SECONDS")
    voice_provider_http_timeout_seconds: float = Field(default=20.0, alias="VOICE_PROVIDER_HTTP_TIMEOUT_SECONDS")
    voice_readiness_timeout_seconds: float = Field(default=3.0, alias="VOICE_READINESS_TIMEOUT_SECONDS")
    voice_utterance_settle_seconds: float = Field(default=1.2, alias="VOICE_UTTERANCE_SETTLE_SECONDS")
    voice_circuit_failure_threshold: int = Field(default=5, alias="VOICE_CIRCUIT_FAILURE_THRESHOLD")
    voice_circuit_recovery_seconds: float = Field(default=30.0, alias="VOICE_CIRCUIT_RECOVERY_SECONDS")
    voice_circuit_half_open_successes: int = Field(default=2, alias="VOICE_CIRCUIT_HALF_OPEN_SUCCESSES")
    voice_rate_limit_sessions_per_minute: int = Field(default=30, alias="VOICE_RATE_LIMIT_SESSIONS_PER_MINUTE")
    voice_rate_limit_session_mutations_per_minute: int = Field(default=300, alias="VOICE_RATE_LIMIT_SESSION_MUTATIONS_PER_MINUTE")
    voice_rate_limit_twilio_bootstrap_per_minute: int = Field(default=120, alias="VOICE_RATE_LIMIT_TWILIO_BOOTSTRAP_PER_MINUTE")

    def resolved_core_api_url(self) -> str:
        explicit_url = self.core_api_url.strip()
        if explicit_url:
            return explicit_url

        internal_hostport = self.core_api_hostport.strip()
        if internal_hostport:
            return f"http://{internal_hostport}"

        return "http://localhost:3001"

    def public_base_url(self) -> str:
        explicit_url = self.webhook_base_url.strip()
        if explicit_url:
            return explicit_url

        return self.render_external_url.strip()

    def twilio_webhook_base_url(self) -> str:
        explicit_url = self.twilio_webhook_public_url.strip()
        if explicit_url:
            return explicit_url

        return self.public_base_url().strip()

    def active_llm_provider(self) -> str:
        """Returns openai, azure, or none depending on keys and LLM_PROVIDER."""
        mode = (self.llm_provider or "auto").strip().lower()
        has_openai = bool(self.openai_api_key.strip())
        has_azure = bool(self.azure_openai_key.strip())
        if mode == "openai":
            return "openai" if has_openai else "none"
        if mode == "azure":
            return "azure" if has_azure else "none"
        if has_openai:
            return "openai"
        if has_azure:
            return "azure"
        return "none"

    def active_llm_model(self) -> str:
        if self.active_llm_provider() == "openai":
            return (self.openai_model or "gpt-4o").strip() or "gpt-4o"
        if self.active_llm_provider() == "azure":
            return (self.azure_openai_deployment or "gpt-4o-mini").strip() or "gpt-4o-mini"
        return ""


settings = Settings()
