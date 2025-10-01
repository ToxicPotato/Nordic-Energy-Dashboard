from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, ConfigDict
from backend.crud import get_prices_last_hours, get_prices_between, get_stats

router = APIRouter(prefix="/api", tags=["prices"])

class PriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    region: str
    ts: datetime
    te: datetime
    price_nok_per_kwh: float
    price_eur_per_kwh: float
    exr: float

class StatsOut(BaseModel):
    region: str
    from_: datetime
    to: datetime
    count: int
    avg_nok_per_kwh: float
    min_nok_per_kwh: float
    max_nok_per_kwh: float

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda dt: dt.astimezone(timezone.utc).isoformat()}

@router.get("/prices", response_model=list[PriceOut])
def list_prices(
    region: str = Query(..., pattern=r"^NO[1-5]$"),
    hours: Optional[int] = Query(None, ge=1, le=24*14, description="Siste N timer"),
    from_: Optional[datetime] = Query(None, alias="from", description="Start (ISO8601, valgfri TZ)"),
    to: Optional[datetime] = Query(None, description="Slutt [eksklusiv] (ISO8601, valgfri TZ)"),
):
    if hours is not None and (from_ is not None or to is not None):
        raise HTTPException(status_code=400, detail="Bruk enten 'hours' ELLER 'from'+'to', ikke begge.")
    if (from_ is None) ^ (to is None):
        raise HTTPException(status_code=400, detail="Både 'from' og 'to' må settes sammen.")

    if hours is None and from_ is None:
        hours = 24

    if hours is not None:
        return get_prices_last_hours(region=region, hours=hours)

    from_utc = from_.astimezone(timezone.utc)
    to_utc = to.astimezone(timezone.utc)
    if to_utc <= from_utc:
        raise HTTPException(status_code=400, detail="'to' må være etter 'from'.")
    return get_prices_between(region=region, start_utc=from_utc, end_utc=to_utc)

@router.get("/stats", response_model=StatsOut)
def price_stats(
    region: str = Query(..., pattern=r"^NO[1-5]$"),
    from_: datetime = Query(..., alias="from"),
    to: datetime = Query(...),
):
    from_utc = from_.astimezone(timezone.utc)
    to_utc = to.astimezone(timezone.utc)
    if to_utc <= from_utc:
        raise HTTPException(status_code=400, detail="'to' må være etter 'from'.")
    res = get_stats(region=region, start_utc=from_utc, end_utc=to_utc)
    return {
        "region": res["region"],
        "from_": res["from"],
        "to": res["to"],
        "count": res["count"],
        "avg_nok_per_kwh": res["avg_nok_per_kwh"],
        "min_nok_per_kwh": res["min_nok_per_kwh"],
        "max_nok_per_kwh": res["max_nok_per_kwh"],
    }
