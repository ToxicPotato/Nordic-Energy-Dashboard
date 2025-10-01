from __future__ import annotations
from pathlib import Path
import os
import yaml
from pydantic import BaseModel, Field, field_validator
from typing import List

class Settings(BaseModel):
    enable_scheduler: bool
    schedule_cron: str
    sched_tz: str
    regions: List[str]
    fetch_date_mode: str

def load_settings() -> Settings:
    root = Path(__file__).resolve().parent
    cfg_path = root / "config.yaml"
    with open(cfg_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    env = os.getenv("APP_ENV", "default")
    base = raw.get("default", {}) or {}
    overlay = raw.get(env, {}) or {}
    merged = {**base, **overlay}

    def _parse_bool_env(name: str) -> bool | None:
        val = os.getenv(name)
        if val is None:
            return None
        v = val.strip().lower()
        if v in ("1","true","yes","on"):
            return True
        if v in ("0","false","no","off"):
            return False
        return None

    env_bool = _parse_bool_env("ENABLE_SCHEDULER")
    if env_bool is not None:
        merged["enable_scheduler"] = env_bool
        
    if "SCHEDULE_CRON" in os.environ:
        merged["schedule_cron"] = os.getenv("SCHEDULE_CRON")
    if "SCHED_TZ" in os.environ:
        merged["sched_tz"] = os.getenv("SCHED_TZ")
    if "REGIONS" in os.environ:
        merged["regions"] = [r.strip() for r in os.getenv("REGIONS","").split(",") if r.strip()]
    if "FETCH_DATE_MODE" in os.environ:
        merged["fetch_date_mode"] = os.getenv("FETCH_DATE_MODE")

    return Settings(**merged)

settings = load_settings()
