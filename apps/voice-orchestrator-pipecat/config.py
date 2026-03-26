"""
Configuration for Pipecat Voice Orchestrator
"""
import os
import warnings
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, Field
from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent
REPO_ROOT = APP_DIR.parents[1]
ROOT_ENV_PATHS = [REPO_ROOT / ".env.local", REPO_ROOT / ".env"]
LEGACY_ENV_PATHS = [APP_DIR / ".env"]
ALLOW_LEGACY_ENV_FALLBACK = os.getenv("WARDLINE_ALLOW_LEGACY_VOICE_ENV") == "1"

for env_path in ROOT_ENV_PATHS:
    if env_path.exists():
        load_dotenv(env_path, override=False)

existing_legacy_env_paths = [str(env_path) for env_path in LEGACY_ENV_PATHS if env_path.exists()]
if existing_legacy_env_paths:
    compatibility_message = (
        "Set WARDLINE_ALLOW_LEGACY_VOICE_ENV=1 only if you need a temporary compatibility fallback."
        if not ALLOW_LEGACY_ENV_FALLBACK
        else "Temporary compatibility fallback enabled via WARDLINE_ALLOW_LEGACY_VOICE_ENV=1."
    )
    warnings.warn(
        "Deprecated voice-orchestrator env file(s) detected: "
        f"{', '.join(existing_legacy_env_paths)}. "
        + compatibility_message,
        stacklevel=2,
    )
    if ALLOW_LEGACY_ENV_FALLBACK:
        for env_path in LEGACY_ENV_PATHS:
            if env_path.exists():
                load_dotenv(env_path, override=False)


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore"
    )
    
    # Server — do not use generic PORT here; repo-root .env sets PORT=3001 for Nest core-api.
    host: str = Field(default="0.0.0.0")
    port: int = Field(
        default=3002,
        validation_alias=AliasChoices("VOICE_ORCHESTRATOR_PORT", "VOICE_PORT"),
    )
    debug: bool = Field(default=False)
    
    # Twilio
    twilio_account_sid: str = Field(..., alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(..., alias="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(default="+15139511583", alias="TWILIO_PHONE_NUMBER")
    
    # Azure Speech (STT/TTS)
    azure_speech_key: str = Field(..., alias="AZURE_SPEECH_KEY")
    azure_speech_region: str = Field(default="eastus2", alias="AZURE_SPEECH_REGION")
    
    # Azure AI Foundry (Recommended - Managed Agents)
    azure_ai_project_endpoint: str = Field(default="", alias="AZURE_EXISTING_AIPROJECT_ENDPOINT")
    azure_ai_agent_name: str = Field(default="wardline-agent", alias="AZURE_EXISTING_AGENT_ID")
    
    # Azure OpenAI (For conversational/langchain agents)
    # Required if agent_type is "conversational" or "langchain_tools"
    # Optional if agent_type is "azure_ai_foundry"
    # GPT-4.1-mini: Best for multi-turn dialog, context handling, robust voice apps
    # GPT-4o-mini: Faster/cheaper but weaker on complex conversational logic
    # o4-mini/o1-mini: Reasoning models - NOT suitable for conversational voice AI
    azure_openai_key: str = Field(default="", alias="AZURE_OPENAI_KEY")
    azure_openai_endpoint: str = Field(default="", alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_deployment: str = Field(default="o4-mini", alias="AZURE_OPENAI_DEPLOYMENT")
    azure_openai_api_version: str = Field(default="2024-12-01-preview", alias="AZURE_OPENAI_API_VERSION")
    
    # Agent type: "azure_ai_foundry" (recommended), "conversational", or "langchain_tools"
    agent_type: str = Field(default="azure_ai_foundry", alias="VOICE_AGENT_TYPE")
    
    # Core API
    core_api_url: str = Field(default="http://localhost:3001", alias="CORE_API_BASE_URL")
    
    # Webhook URL (ngrok for local dev)
    webhook_base_url: str = Field(default="", alias="WEBHOOK_BASE_URL")
    
    # Voice settings
    tts_voice: str = Field(default="en-US-JennyNeural", alias="TTS_VOICE")
    stt_language: str = Field(default="en-US", alias="STT_LANGUAGE")

    # Set USE_STREAMING=true to enable real-time Pipecat pipeline via Twilio Media Streams.
    # Requires WEBHOOK_BASE_URL to be a publicly accessible wss:// URL (e.g. via ngrok).
    # When false (default), uses the Twilio Gather request/response fallback mode.
    use_streaming: bool = Field(default=False, alias="USE_STREAMING")


settings = Settings()
