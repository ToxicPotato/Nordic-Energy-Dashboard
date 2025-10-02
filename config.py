from __future__ import annotations
from pathlib import Path
import os
import yaml
from pydantic import BaseModel
from typing import List, Optional

CFG_PATH = Path(__file__).resolve().parent / "config.yaml"

class Settings(BaseModel):
    # --- Scheduler ---
    enable_scheduler: bool
    schedule_cron: str
    sched_tz: str
    regions: List[str]
    fetch_date_mode: str

    # --- DB ---
    DATABASE_URL: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASS: Optional[str] = None
    DB_HOST: Optional[str] = None
    DB_PORT: Optional[int] = None
    DB_NAME: Optional[str] = None
    DB_DRIVER: Optional[str] = None

    # Creates the full database URL from parts if needed
    def db_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        missing = [k for k in ("DB_USER","DB_PASS","DB_HOST","DB_PORT","DB_NAME","DB_DRIVER")
                   if getattr(self, k) in (None, "")]
        if missing:
            raise ValueError(f"Mangler DB-felter i config.yaml: {', '.join(missing)}")
        driver = "psycopg2" if self.DB_DRIVER == "psycopg2" else "psycopg"
        return f"postgresql+{driver}://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


def _load_yaml(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Mangler config-fil: {path}")
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_settings() -> Settings:
    raw = _load_yaml(CFG_PATH)

    # Determine environment and merge settings
    env = os.getenv("APP_ENV", "default")
    base = raw.get("default", {}) or {}
    overlay = raw.get(env, {}) or {}
    merged = {**base, **overlay}

    return Settings(**merged)

settings = load_settings()
