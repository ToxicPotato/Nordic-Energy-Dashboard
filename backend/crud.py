from sqlalchemy.dialects.postgresql import insert as pg_insert
from datetime import datetime, timezone
from sqlalchemy import select, func

from backend.db import SessionLocal
from backend.models import HourlyPowerPrice

def upsert_rows(rows: list[dict]) -> int:
    """
    Expects rows in the format from normalize():
      { region, ts, te, price_nok_per_kwh, price_eur_per_kwh, exr }
    """
    count = 0
    with SessionLocal() as s, s.begin():
        for r in rows:
            payload = {
                "region": r["region"],
                "start_ts_utc": r["ts"],
                "end_ts_utc": r["te"],
                "price_nok_per_kwh": r["price_nok_per_kwh"],
                "price_eur_per_kwh": r.get("price_eur_per_kwh"),
                "exr": r.get("exr"),
            }
            stmt = pg_insert(HourlyPowerPrice).values(**payload)
            stmt = stmt.on_conflict_do_update(
                index_elements=["region", "start_ts_utc"],
                set_={
                    "end_ts_utc": stmt.excluded.end_ts_utc,
                    "price_nok_per_kwh": stmt.excluded.price_nok_per_kwh,
                    "price_eur_per_kwh": stmt.excluded.price_eur_per_kwh,
                    "exr": stmt.excluded.exr,
                },
            )
            s.execute(stmt)
            count += 1
    return count

def get_regions() -> list[str]:
    return ["NO1", "NO2", "NO3", "NO4", "NO5"]

def get_prices_last_hours(region: str, hours: int) -> list[dict]:
    """
    Fetches the last `hours` rows for the given region, returned in ascending order by time.
    """
    with SessionLocal() as s:
        q = (
            select(HourlyPowerPrice)
            .where(HourlyPowerPrice.region == region)
            .order_by(HourlyPowerPrice.start_ts_utc.desc())
            .limit(hours)
        )
        rows = s.execute(q).scalars().all()
        rows.reverse()  # stigende tid
        return [_row_to_dict(r) for r in rows]

def get_prices_between(region: str, start_utc: datetime, end_utc: datetime) -> list[dict]:
    """
    Retrieves all rows in [start_utc, end_utc) for the given region, in ascending order by time.
    Assumes tz-aware (UTC) datetimes.
    """
    assert start_utc.tzinfo is not None and end_utc.tzinfo is not None
    start_utc = start_utc.astimezone(timezone.utc)
    end_utc = end_utc.astimezone(timezone.utc)

    with SessionLocal() as s:
        q = (
            select(HourlyPowerPrice)
            .where(HourlyPowerPrice.region == region)
            .where(HourlyPowerPrice.start_ts_utc >= start_utc)
            .where(HourlyPowerPrice.start_ts_utc < end_utc)
            .order_by(HourlyPowerPrice.start_ts_utc.asc())
        )
        rows = s.execute(q).scalars().all()
        return [_row_to_dict(r) for r in rows]

def get_stats(region: str, start_utc: datetime, end_utc: datetime) -> dict:
    """
    Aggregater for NOK/kWh i intervall [start_utc, end_utc).
    """
    assert start_utc.tzinfo is not None and end_utc.tzinfo is not None
    start_utc = start_utc.astimezone(timezone.utc)
    end_utc = end_utc.astimezone(timezone.utc)

    with SessionLocal() as s:
        q = (
            select(
                func.avg(HourlyPowerPrice.price_nok_per_kwh),
                func.min(HourlyPowerPrice.price_nok_per_kwh),
                func.max(HourlyPowerPrice.price_nok_per_kwh),
                func.count(HourlyPowerPrice.id),
            )
            .where(HourlyPowerPrice.region == region)
            .where(HourlyPowerPrice.start_ts_utc >= start_utc)
            .where(HourlyPowerPrice.start_ts_utc < end_utc)
        )
        avg_, min_, max_, n = s.execute(q).one()
        return {
            "region": region,
            "from": start_utc,
            "to": end_utc,
            "count": int(n or 0),
            "avg_nok_per_kwh": float(avg_) if avg_ is not None else None,
            "min_nok_per_kwh": float(min_) if min_ is not None else None,
            "max_nok_per_kwh": float(max_) if max_ is not None else None,
        }

def _row_to_dict(r: HourlyPowerPrice) -> dict:
    return {
        "region": r.region,
        "ts": r.start_ts_utc,
        "te": r.end_ts_utc,
        "price_nok_per_kwh": float(r.price_nok_per_kwh),
        "price_eur_per_kwh": float(r.price_eur_per_kwh) if r.price_eur_per_kwh is not None else None,
        "exr": float(r.exr) if r.exr is not None else None,
    }
