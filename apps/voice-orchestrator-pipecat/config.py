"""
Configuration for Pipecat Voice Orchestrator
"""
import os
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=3002)
    debug: bool = Field(default=False)
    
    # Twilio
    twilio_account_sid: str = Field(..., env="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(..., env="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(default="+15139511583", env="TWILIO_PHONE_NUMBER")
    
    # Azure Speech (STT/TTS)
    azure_speech_key: str = Field(..., env="AZURE_SPEECH_KEY")
    azure_speech_region: str = Field(default="eastus2", env="AZURE_SPEECH_REGION")
    
    # Azure OpenAI
    azure_openai_key: str = Field(..., env="AZURE_OPENAI_KEY")
    azure_openai_endpoint: str = Field(..., env="AZURE_OPENAI_ENDPOINT")
    azure_openai_deployment: str = Field(default="o4-mini", env="AZURE_OPENAI_DEPLOYMENT")
    azure_openai_api_version: str = Field(default="2024-12-01-preview", env="AZURE_OPENAI_API_VERSION")
    
    # Core API
    core_api_url: str = Field(default="http://localhost:3001", env="CORE_API_BASE_URL")
    
    # Webhook URL (ngrok for local dev)
    webhook_base_url: str = Field(default="", env="WEBHOOK_BASE_URL")
    
    # Voice settings
    tts_voice: str = Field(default="en-US-JennyNeural", env="TTS_VOICE")
    stt_language: str = Field(default="en-US", env="STT_LANGUAGE")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra env vars


settings = Settings()

