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
    OPENAI_MODEL: str = "gpt-5-mini"
    # langchain-openai always sends temperature (its own default is 0.7), and
    # reasoning models (o-series, gpt-5 family) reject anything but 1.0. Keep the
    # default at 1.0 so both families work; override in .env for older models.
    OPENAI_TEMPERATURE: float = 1.0
    # Reasoning models spend this budget on hidden reasoning tokens before
    # emitting any visible text, so too low a value returns an empty reply with
    # finish_reason="length". gpt-5-mini was measured using 1000-1500 reasoning
    # tokens on chat questions, so leave generous headroom. Only tokens actually
    # produced are billed, so a high ceiling costs nothing.
    OPENAI_MAX_COMPLETION_TOKENS: int = 4000

    # Security (optional - not currently used, but reserved for future JWT/session features)
    SECRET_KEY: str = "placeholder-secret-key-not-currently-used"

    # Application
    DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost:5173, https://fpl-agent.vercel.app"



    @property
    def llm_kwargs(self) -> dict:
        """Shared ChatOpenAI kwargs for every LLM call site."""
        return {"temperature": self.OPENAI_TEMPERATURE}

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS_ORIGINS string to list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
