"""
Configuration management for FPL Agent backend.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # FPL API
    FPL_BASE_URL: str = "https://fantasy.premierleague.com/api/"

    # OpenAI API
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o"

    # Security (optional - not currently used, but reserved for future JWT/session features)
    SECRET_KEY: str = "placeholder-secret-key-not-currently-used"

    # Application
    DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost:5173"



    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS_ORIGINS string to list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
