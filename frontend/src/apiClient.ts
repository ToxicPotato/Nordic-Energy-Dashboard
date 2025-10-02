export type Region = "NO1"|"NO2"|"NO3"|"NO4"|"NO5";

export interface PriceRow {
  ts: string;                 // ISO (UTC)
  price_nok_per_kwh: number;
  price_eur_per_kwh?: number;
  exr?: number;
}

export async function getRegions(): Promise<Region[]> {
  const res = await fetch("/api/regions");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getPrices(args: { region: Region; hours?: number; from?: string; to?: string; }): Promise<PriceRow[]> {
  const params = new URLSearchParams({ region: args.region });
  if (typeof args.hours === "number") params.set("hours", String(args.hours));
  if (args.from) params.set("from", args.from);
  if (args.to) params.set("to", args.to);

  const res = await fetch(`/api/prices?${params.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);

  const parsed = text ? JSON.parse(text) : null;
  return Array.isArray(parsed) ? parsed : (parsed?.items ?? []);
}
