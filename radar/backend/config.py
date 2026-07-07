"""
RADAR — Application Configuration
Loads all settings from environment variables via .env file.
No hardcoded credentials anywhere in this file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # API Keys
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    # Geolocation
    geo_provider: Literal["ipapi", "ipinfo"] = "ipapi"
    geo_api_key: str = ""

    # Application
    backend_port: int = 8000
    frontend_origin: str = "http://localhost:5173"
    ai_provider: Literal["gemini", "claude"] = "gemini"
    log_level: str = "INFO"
    secret_key: str = "change_me_in_production"

    # Database
    database_path: str = "./radar.db"

    # Replay engine
    replay_max_events_per_sec: int = 500

    # WebSocket emission rate (events/sec for synthetic feed)
    ws_emission_rate: float = 10.0

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def effective_ai_provider(self) -> str:
        """Return the first available AI provider, fallback gracefully."""
        if self.ai_provider == "gemini" and self.has_gemini:
            return "gemini"
        if self.ai_provider == "claude" and self.has_anthropic:
            return "claude"
        if self.has_gemini:
            return "gemini"
        if self.has_anthropic:
            return "claude"
        return "mock"  # demo mode — returns placeholder playbook


# Singleton instance — import this everywhere
settings = Settings()
