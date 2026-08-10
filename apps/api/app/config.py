import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings:
    PROJECT_NAME: str = "Global Generation"
    API_V1_STR: str = "/api"
    BACKEND_CORS_ORIGINS: list[str] = ["*"]

    # OpenAI API settings
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY", None)
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
