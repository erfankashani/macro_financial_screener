"""Application settings.

Secrets (e.g. FRED_API_KEY) are read from the process environment / repo-root
.env file by pydantic-settings. The key is never logged or echoed.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root is one level up from the backend/ package dir.
_REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Secret — loaded from env/.env, never hard-coded.
    fred_api_key: str = ""

    # Storage
    cache_db_path: str = str(Path(__file__).resolve().parents[1] / "data" / "cache.db")

    # CORS: the Next.js dev origin by default.
    frontend_origin: str = "http://localhost:3000"

    @property
    def fred_api_key_present(self) -> bool:
        return bool(self.fred_api_key)


def get_settings() -> Settings:
    return Settings()
