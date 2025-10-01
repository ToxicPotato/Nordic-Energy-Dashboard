from datetime import date as Date, timezone
from dateutil import parser as dtparse
from typing import Iterable
import requests

def run_ingest(target_date: Date, regions: Iterable[str]) -> None:
    """
    Fetch and store data for the given date and regions.
    This function should be idempotent (upsert), so it can be safely run multiple times.
    """

    print(f"[ingest] starting for {target_date} :: {', '.join(regions)}")
    for region in regions:
        api_data = fetch_prices_from_api(region=region, date=target_date)
        rows = normalize(api_data, region=region)
        print(rows)
    #   upsert_rows(rows)

        print(f"[ingest] fetched {len(rows)} rows for {region} on {target_date}")
    print(f"[ingest] completed for {target_date} :: {', '.join(regions)}")

def fetch_prices_from_api(region: str, date: Date) -> list[dict]:
    """Hent priser fra ekstern API for gitt region og dato."""
    
    r = requests.get(f'https://www.hvakosterstrommen.no/api/v1/prices/{date.strftime("%Y/%m-%d")}_{region}.json')
    if r.status_code == 200:
        return r.json()
    return []


def normalize(api_items: list[dict], region: str) -> list[dict]:
    rows = []
    for item in api_items:
        ts_local = dtparse.isoparse(item["time_start"])
        ts_utc = ts_local.astimezone(timezone.utc) 

        te_local = dtparse.isoparse(item["time_end"])
        te_utc = te_local.astimezone(timezone.utc)

        NOK_per_kWh = float(item["NOK_per_kWh"])
        EUR_per_kWh = float(item["EUR_per_kWh"])
        EXR = float(item["EXR"])

        rows.append({
            "region": region,
            "ts": ts_utc,
            "te": te_utc,
            "price_nok_per_kwh": NOK_per_kWh,
            "price_eur_per_kwh": EUR_per_kWh,
            "exr": EXR,
        })
    return rows