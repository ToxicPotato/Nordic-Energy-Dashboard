from datetime import date as Date, timezone, timedelta
from dateutil import parser as dtparse
from typing import Iterable
import requests

from backend.crud import upsert_rows

def run_ingest(target_date: Date, regions: Iterable[str]) -> None:
    print(f"[ingest] starting for {target_date} :: {', '.join(regions)}")
    total = 0
    for region in regions:
        api_data = fetch_prices_from_api(region=region, date=target_date)
        rows = normalize(api_data, region=region)
        _validate(rows)
        n = upsert_rows(rows)
        total += n
        print(f"[ingest] upserted {n} rows for {region} on {target_date}")
    print(f"[ingest] completed: {total} rows")

def fetch_prices_from_api(region: str, date: Date) -> list[dict]:
    url = f'https://www.hvakosterstrommen.no/api/v1/prices/{date.strftime("%Y/%m-%d")}_{region}.json'
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise ValueError("Uventet responsformat (forventer liste).")
    return data

def normalize(api_items: list[dict], region: str) -> list[dict]:
    rows = []
    for item in api_items:
        ts_local = dtparse.isoparse(item["time_start"])
        te_local = dtparse.isoparse(item["time_end"])
        ts_utc = ts_local.astimezone(timezone.utc)
        te_utc = te_local.astimezone(timezone.utc)

        rows.append({
            "region": region,
            "ts": ts_utc,
            "te": te_utc,
            "price_nok_per_kwh": float(item["NOK_per_kWh"]),
            "price_eur_per_kwh": float(item["EUR_per_kWh"]),
            "exr": float(item["EXR"]),
        })
    rows.sort(key=lambda r: r["ts"])
    return rows

def _validate(rows: list[dict]) -> None:
    if not rows:
        print("[ingest][warn] tom liste med rader")
        return

    issues = 0

    # a) rekkefølge
    for a, b in zip(rows, rows[1:]):
        if b["ts"] < a["ts"]:
            print(f"[ingest][warn] tidsrekkefølge brutt: {a['ts']} -> {b['ts']} (går bakover)")
            issues += 1

    # b) per-rad varighet
    for r in rows:
        dt = r["te"] - r["ts"]
        if dt != timedelta(hours=1):
            print(f"[ingest][warn] te - ts != 1h for {r['ts']} (delta={dt})")
            issues += 1

    # c) steg mellom rader (DST kan gi 0h/2h osv.)
    for a, b in zip(rows, rows[1:]):
        step = b["ts"] - a["ts"]
        if step != timedelta(hours=1):
            print(f"[ingest][info] non-1h step {a['ts']} -> {b['ts']} (delta={step}) [DST/gap/overlap?]")

    if issues:
        print(f"[ingest][warn] validation completed with {issues} issue(s); continuing anyway")

