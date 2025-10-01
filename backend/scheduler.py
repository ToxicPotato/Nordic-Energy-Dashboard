from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date, timedelta
from .services.ingest import run_ingest

def _resolve_target_date(mode: str) -> date:
    today = date.today()
    return today if mode.lower() == "today" else (today - timedelta(days=1))

def init_scheduler(*, cron: str, tz: str, regions: list[str], fetch_date_mode: str) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=tz)
    scheduler.configure(job_defaults={"max_instances": 1, "coalesce": True, "misfire_grace_time": 600})
    trigger = CronTrigger.from_crontab(cron)

    def job():
        target = _resolve_target_date(fetch_date_mode)
        run_ingest(target_date=target, regions=regions)

    scheduler.add_job(job, trigger=trigger, id="daily_ingest")
    return scheduler