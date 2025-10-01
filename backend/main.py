from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import settings
from .scheduler import init_scheduler

from backend.api.prices import router as prices_router
from backend.api.regions import router as regions_router

_scheduler = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    if settings.enable_scheduler:
        _scheduler = init_scheduler(
            cron=settings.schedule_cron,
            tz=settings.sched_tz,
            regions=settings.regions,
            fetch_date_mode=settings.fetch_date_mode,
        )
        _scheduler.start()
        print("[scheduler] started")
    else:
        print("[scheduler] disabled (config.enable_scheduler = false)")
    try:
        yield
    finally:
        if _scheduler:
            _scheduler.shutdown(wait=False)
            print("[scheduler] stopped")

app = FastAPI(title="Nordic Energy Dashboard", version="0.1.0", lifespan=lifespan)

# CORS for lokal frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(regions_router)
app.include_router(prices_router)