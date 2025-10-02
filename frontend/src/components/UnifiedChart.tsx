import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, Brush, ReferenceLine
} from "recharts";
import { parseISO } from "date-fns";
import type { Region, PriceRow } from "../apiClient";

export type Mode = "hours" | "range";

const COLORS: Record<Region, string> = {
  NO1: "#7aa2f7",
  NO2: "#3fb950",
  NO3: "#f59e0b",
  NO4: "#ef4444",
  NO5: "#a78bfa",
};

interface Props {
  regions: Region[];
  mode: Mode;
  hours?: number;
  fromISO?: string;        // inkl. Z
  toISOExclusive?: string; // inkl. Z
  muted?: Record<Region, boolean>;
  /** Ekstern nøkkel som tvinger refetch (fra App) */
  refreshKey?: number;
}

type SeriesMap = Record<Region, PriceRow[]>;

export default function UnifiedChart({
  regions, mode, hours = 24, fromISO, toISOExclusive, muted = {}, refreshKey = 0,
}: Props) {
  const [series, setSeries] = useState<SeriesMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Behold siste gode ikke-tomme datasett som fallback
  const lastGood = useRef<SeriesMap>({});

  useEffect(() => {
    let cancelled = false;
    if (!regions.length) { setSeries({}); return; }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const fetchOne = async (region: Region): Promise<PriceRow[]> => {
          const params = new URLSearchParams({ region });
          if (mode === "hours") params.set("hours", String(hours));
          else {
            if (!fromISO || !toISOExclusive) return [];
            params.set("from", fromISO);
            params.set("to", toISOExclusive);
          }
          const res = await fetch(`/api/prices?${params.toString()}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const parsed = await res.json().catch(() => null);
          const items: PriceRow[] = Array.isArray(parsed) ? parsed : (parsed?.items ?? []);
          return items ?? [];
        };

        // Hent alle regioner – men fall tilbake til lastGood ved tomt/feil
        const results = await Promise.allSettled(regions.map(r => fetchOne(r)));
        if (cancelled) return;

        const next: SeriesMap = {};
        regions.forEach((r, i) => {
          const out = results[i].status === "fulfilled" ? results[i].value : [];
          next[r] = out;
        });

        const hasAny = Object.values(next).some(arr => arr?.length);
        if (hasAny) {
          lastGood.current = next; // oppdater buffer
          setSeries(next);
          setLoading(false);
          setError(null);
          return;
        }

        // Ingen data fra kallet – vis siste gode dersom vi har
        const prevHasAny = Object.values(lastGood.current).some(arr => arr?.length);
        if (prevHasAny) {
          setSeries({ ...lastGood.current });
          setLoading(false);
          setError(null);
          return;
        }

        // Ingen lastGood – vis tomt + info
        setSeries({});
        setLoading(false);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          if (Object.values(lastGood.current).some(arr => arr?.length)) {
            // behold grafen, vis ev. feilmelding (valgfritt)
            setLoading(false);
            setError(String(e?.message ?? e));
          } else {
            setSeries({});
            setLoading(false);
            setError(String(e?.message ?? e));
          }
        }
      }
    })();

    return () => { cancelled = true; };
    // NB: refreshKey med i deps for å “poke” grafen jevnlig
  }, [regions.join(","), mode, hours, fromISO, toISOExclusive, refreshKey]);

  // Flett alle serier til én felles tidslinje (UTC ms)
  const mergedData = useMemo(() => {
    if (!regions.length) return [];
    const toMs = (iso: string) => parseISO(iso).getTime();

    // samle alle ts
    const tsSet = new Set<number>();
    for (const r of regions) for (const row of (series[r] ?? [])) tsSet.add(toMs(row.ts));
    const allTs = Array.from(tsSet).sort((a, b) => a - b);

    // oppslag tabell per region
    const maps: Record<Region, Map<number, number>> = {} as any;
    for (const r of regions) {
      const m = new Map<number, number>();
      for (const row of (series[r] ?? [])) {
        const ms = toMs(row.ts);
        if (Number.isFinite(ms)) m.set(ms, row.price_nok_per_kwh);
      }
      maps[r] = m;
    }

    // bygg rader
    return allTs.map(ts => {
      const obj: any = { ts };
      for (const r of regions) obj[r] = maps[r].has(ts) ? maps[r].get(ts)! : null;
      return obj;
    });
  }, [series, regions]);

  // globalt snitt (for ReferenceLine)
  const globalAvg = useMemo(() => {
    let sum = 0, count = 0;
    for (const row of mergedData) {
      for (const r of regions) {
        const v = row[r] as number | null;
        if (v != null && Number.isFinite(v)) { sum += v; count++; }
      }
    }
    return count ? sum / count : 0;
  }, [mergedData, regions]);

  if (loading) return <div className="chart panel"><p style={{ padding: 12 }}>Loading…</p></div>;
  if (!regions.length) return <div className="chart panel"><p style={{ padding: 12 }}>Select regions to compare.</p></div>;
  if (!mergedData.length) return <div className="chart panel"><p style={{ padding: 12 }}>No data.</p></div>;

  return (
    <div className="chart panel">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={mergedData} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
          <defs>
            {regions.map(r => (
              <linearGradient id={`grad-${r}`} key={r} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={COLORS[r]} stopOpacity={0.20}/>
                <stop offset="100%" stopColor={COLORS[r]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="2 6" opacity={0.35} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ms: number) => {
              const d = new Date(ms);
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
            }}
            minTickGap={24}
          />
          <YAxis domain={[0, "auto"]} tickFormatter={(v) => Number(v).toFixed(2)} width={56} />
          <Tooltip
            wrapperStyle={{ borderRadius: 8, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
            contentStyle={{ background: "var(--panel-bg)" }}
            labelFormatter={(ms: number) => new Date(ms).toISOString().replace(".000Z","Z")}
            formatter={(v: number | null, name: string) => v == null ? ["—", name] : [`${v.toFixed(4)} NOK/kWh`, name]}
          />
          <Legend />

          {/* globalt snitt som referanse */}
          {globalAvg > 0 && (
            <ReferenceLine y={globalAvg} stroke="var(--ink-muted)" strokeDasharray="4 4" ifOverflow="clip" />
          )}

          {regions.map((r) => (
            <Line
              key={r}
              name={r}
              dataKey={r}
              type="monotone"
              stroke={COLORS[r]}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
              connectNulls
              fill={`url(#grad-${r})`}
              fillOpacity={muted?.[r] ? 0 : 0.35}
              strokeOpacity={muted?.[r] ? 0.35 : 1}
            />
          ))}

          <Brush dataKey="ts" height={22} travellerWidth={10} stroke="var(--border)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
