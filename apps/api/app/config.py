import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import SecretStr

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings:
    PROJECT_NAME: str = "Global Generation"
    API_V1_STR: str = "/api"
    BACKEND_CORS_ORIGINS: list[str] = ["*"]

    # OpenAI API settings
    OPENAI_API_KEY: SecretStr | None = (
        SecretStr(os.getenv("OPENAI_API_KEY", "")) if os.getenv("OPENAI_API_KEY", None) else None
    )
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
