from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://sad_user:sad_pass_2024@localhost:5432/sad_db"
    SECRET_KEY: str = "sad-secret-key-cameroun-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 heures
    ANTHROPIC_API_KEY: Optional[str] = None
    ENVIRONMENT: str = "development"
    # Assistant IA — provider : anthropic (cloud) | ollama (local) | auto
    AI_PROVIDER: str = "auto"
    OLLAMA_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "llama3.1:8b-instruct-q4_K_M"

    class Config:
        env_file = ".env"


settings = Settings()
