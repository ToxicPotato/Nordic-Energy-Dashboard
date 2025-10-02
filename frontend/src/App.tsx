import { useEffect, useMemo, useState } from "react";
import UnifiedChart from "./components/UnifiedChart";
import StatCard from "./components/StatCard";
import PriceTable from "./components/PriceTable";
import ThemeToggle from "./components/ThemeToggle";
import ControlsPanel, { type PresetId } from "./components/ControlsPanel";
import { getRegions, getPrices, type Region, type PriceRow } from "./apiClient";
import { addDays } from "date-fns";

/** Farger for region-knapper */
const COLORS: Record<string, string> = {
  NO1: "#7aa2f7", NO2: "#3fb950", NO3: "#f59e0b", NO4: "#ef4444", NO5: "#a78bfa",
};

const LS_KEY = "ned:prefs:simple-presets:v3";

type SavedPrefs = {
  regions?: Region[];
  muted?: Record<Region, boolean>;
  preset?: PresetId | null;
  from?: string; // ISO "YYYY-MM-DDT00:00:00Z"
  to?: string;   // ISO "YYYY-MM-DDT00:00:00Z"
};

/* ---------- UTC helpers ---------- */
const MS_DAY = 24 * 60 * 60 * 1000;
const isoDayUTC = (d: Date) => d.toISOString().slice(0, 10);
const startOfTodayUTC = () => new Date(`${isoDayUTC(new Date())}T00:00:00Z`);
const startOfYearUTC = () => new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00Z`);

/* ---------- URL helpers ---------- */
function readUrl(): Partial<SavedPrefs> {
  const sp = new URLSearchParams(window.location.search);
  const p: Partial<SavedPrefs> = {};
  const regions = sp.get("regions");
  if (regions) p.regions = regions.split(",").filter(Boolean) as Region[];
  const muted = sp.get("muted");
  if (muted) {
    const m: any = {};
    muted.split(",").forEach((k) => k && (m[k] = true));
    p.muted = m;
  }
  const preset = sp.get("preset") as PresetId | null;
  if (preset) p.preset = preset;
  const from = sp.get("from");
  const to = sp.get("to");
  if (from && to) {
    p.from = from;
    p.to = to;
  }
  return p;
}
function writeUrl(p: SavedPrefs) {
  const sp = new URLSearchParams(window.location.search);
  p.regions?.length ? sp.set("regions", p.regions.join(",")) : sp.delete("regions");
  if (p.muted) {
    const list = Object.entries(p.muted)
      .filter(([, v]) => v)
      .map(([k]) => k);
    list.length ? sp.set("muted", list.join(",")) : sp.delete("muted");
  } else sp.delete("muted");
  p.preset ? sp.set("preset", p.preset) : sp.delete("preset");
  if (p.preset === "custom" && p.from && p.to) {
    sp.set("from", p.from);
    sp.set("to", p.to);
  } else {
    sp.delete("from");
    sp.delete("to");
  }
  const next = `?${sp.toString()}`;
  if (next !== window.location.search) history.replaceState(null, "", next);
}

/** Avled fetch-parametre (hours eller {from,toExclusive}) fra valgt tidsrom */
function deriveFetchWindow(
  preset: PresetId | null,
  from?: string,
  to?: string
): { hours?: number; from?: string; toExclusive?: string } {
  if (!preset || preset === "custom") {
    if (from && to) {
      const toExclusive = new Date(Date.parse(to) + MS_DAY).toISOString();
      return { from, toExclusive };
    }
    return {};
  }
  if (preset === "24h") return { hours: 24 };
  if (preset === "48h") return { hours: 48 };
  if (preset === "72h") return { hours: 72 };
  if (preset === "7d") return { hours: 168 };

  const today0 = startOfTodayUTC();
  if (preset === "14d") {
    const f = new Date(today0.getTime() - 13 * MS_DAY);
    return { from: `${isoDayUTC(f)}T00:00:00Z`, toExclusive: new Date(today0.getTime() + MS_DAY).toISOString() };
  }
  if (preset === "30d") {
    const f = new Date(today0.getTime() - 29 * MS_DAY);
    return { from: `${isoDayUTC(f)}T00:00:00Z`, toExclusive: new Date(today0.getTime() + MS_DAY).toISOString() };
  }
  if (preset === "ytd") {
    const f = startOfYearUTC();
    return { from: `${isoDayUTC(f)}T00:00:00Z`, toExclusive: new Date(today0.getTime() + MS_DAY).toISOString() };
  }
  return {};
}

/* ---------- Live/våken logikk ---------- */
function isTodayUTC(isoDay: string | undefined) {
  if (!isoDay) return false;
  const today = new Date().toISOString().slice(0, 10);
  return isoDay.slice(0, 10) === today;
}
function presetIsLive(preset: PresetId | null, customFrom?: string, customTo?: string) {
  if (!preset) return false;
  if (preset === "24h" || preset === "48h" || preset === "72h" || preset === "7d") return true;
  if (preset === "14d" || preset === "30d" || preset === "ytd") return true; // dekker i dag
  if (preset === "custom") return isTodayUTC(customTo);
  return false;
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);

  const [allRegions, setAllRegions] = useState<Region[]>(["NO1", "NO2", "NO3", "NO4", "NO5"]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(["NO1", "NO2", "NO5", "NO4", "NO3"]);
  const [muted, setMuted] = useState<Record<Region, boolean>>({});

  // Tidsrom
  const [preset, setPreset] = useState<PresetId | null>("72h");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [appliedRange, setAppliedRange] = useState<{ from?: string; to?: string }>({});

  // “Live” re-fetch tick
  const [refreshTick, setRefreshTick] = useState(0);

  // Primærregion for KPI/Tabell
  const primary = (selectedRegions[0] ?? "NO1") as Region;
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Regions (safety)
  useEffect(() => {
    (async () => {
      try {
        const available = await getRegions();
        if (available?.length) setAllRegions(available);
      } catch {}
    })();
  }, []);

  // HYDRERING
  useEffect(() => {
    const u = readUrl();
    let s: SavedPrefs | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) s = JSON.parse(raw);
    } catch {}
    const src = { ...(s ?? {}), ...(u ?? {}) } as SavedPrefs;

    if (src.regions?.length) setSelectedRegions(src.regions);
    if (src.muted) setMuted(src.muted);
    if (src.preset) setPreset(src.preset);

    if (src.preset === "custom" && src.from && src.to) {
      setAppliedRange({ from: src.from, to: src.to });
      setFromDate(src.from.slice(0, 10));
      setToDate(src.to.slice(0, 10));
    } else {
      const today = new Date();
      const start = addDays(today, -7);
      const toStr = today.toISOString().slice(0, 10);
      const fromStr = start.toISOString().slice(0, 10);
      setFromDate(fromStr);
      setToDate(toStr);
      setAppliedRange({ from: `${fromStr}T00:00:00Z`, to: `${toStr}T00:00:00Z` });
    }
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    const payload: SavedPrefs = {
      regions: selectedRegions,
      muted,
      preset,
      from: appliedRange.from,
      to: appliedRange.to,
    };
    writeUrl(payload);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {}
  }, [hydrated, selectedRegions, muted, preset, appliedRange.from, appliedRange.to]);

  // Avled fetch parametre
  const { hours, from, toExclusive } = deriveFetchWindow(preset, appliedRange.from, appliedRange.to);

  // KPI/Tabell – hent (også når refreshTick endres)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        let data: PriceRow[] = [];
        if (hours) data = await getPrices({ region: primary, hours });
        else if (from && toExclusive) data = await getPrices({ region: primary, from, to: toExclusive });
        if (!cancelled) setRows(data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primary, hours, from, toExclusive, refreshTick]);

  // KPI beregning
  const stats = useMemo(() => {
    if (!rows.length) return { avg: 0, min: 0, max: 0 };
    let min = Infinity,
      max = -Infinity,
      sum = 0;
    for (const r of rows) {
      const v = r.price_nok_per_kwh;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    return { avg: sum / rows.length, min, max };
  }, [rows]);

  const spark = useMemo(() => rows.slice(-24).map((r) => ({ x: Date.parse(r.ts), y: r.price_nok_per_kwh })), [rows]);

  // Velg preset
  function onSelectPreset(id: PresetId) {
    setPreset(id);
    if (id === "custom") return;

    const today0 = startOfTodayUTC();
    if (id === "24h" || id === "48h" || id === "72h" || id === "7d") {
      setAppliedRange({});
      return;
    }
    if (id === "14d") {
      const f = new Date(today0.getTime() - 13 * MS_DAY);
      setAppliedRange({ from: `${isoDayUTC(f)}T00:00:00Z`, to: `${isoDayUTC(today0)}T00:00:00Z` });
      setFromDate(isoDayUTC(f));
      setToDate(isoDayUTC(today0));
    }
    if (id === "30d") {
      const f = new Date(today0.getTime() - 29 * MS_DAY);
      setAppliedRange({ from: `${isoDayUTC(f)}T00:00:00Z`, to: `${isoDayUTC(today0)}T00:00:00Z` });
      setFromDate(isoDayUTC(f));
      setToDate(isoDayUTC(today0));
    }
    if (id === "ytd") {
      const f = startOfYearUTC();
      setAppliedRange({ from: `${isoDayUTC(f)}T00:00:00Z`, to: `${isoDayUTC(today0)}T00:00:00Z` });
      setFromDate(isoDayUTC(f));
      setToDate(isoDayUTC(today0));
    }
  }

  function applyCustom() {
    if (!fromDate || !toDate) return;
    setAppliedRange({ from: `${fromDate}T00:00:00Z`, to: `${toDate}T00:00:00Z` });
    setPreset("custom");
  }

  function toggleRegion(r: Region) {
    setSelectedRegions((prev) => {
      const on = prev.includes(r);
      if (on) {
        const next = prev.filter((x) => x !== r);
        return next.length ? next : prev; // minst én region igjen
      }
      return [...prev, r];
    });
  }

  /* --- LIVE REFRESH: poll når preset er "live" og fanen er synlig --- */
  useEffect(() => {
    let timer: number | null = null;
    let backoff = 0;

    const visible = () => document.visibilityState === "visible";
    const live = presetIsLive(preset, appliedRange.from, appliedRange.to);

    const kick = () => setRefreshTick((t) => t + 1);

    const schedule = () => {
      if (!live || !visible()) return;
      const fast = preset === "24h" || preset === "48h" || preset === "72h";
      const baseMs = fast ? 60_000 : 300_000; // 1 min vs 5 min
      const ms = Math.min(baseMs * Math.max(1, backoff || 1), 15 * 60_000); // maks 15 min
      timer = window.setTimeout(() => {
        kick();
        schedule();
      }, ms) as unknown as number;
    };

    const onVisibility = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (visible() && live) {
        kick(); // hent straks når fanen blir synlig
        schedule();
      }
    };

    if (live && visible()) schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [preset, appliedRange.from, appliedRange.to]);

  // Avled props til grafen
  return (
    <div className="app">
      {/* TOP – sticky */}
      <div className="topbar sticky">
        <div className="brand">
          <div className="logo">⚡</div>
          <div>
            <h1>Nordic Energy Dashboard</h1>
            <small>FastAPI · React</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className={`dot ${loading ? "off" : ""}`} />
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{loading ? "Loading…" : "Connected"}</span>
          <ThemeToggle />
        </div>
      </div>

      {/* KONTROLLPANELET – eget card */}
      <ControlsPanel
        regions={allRegions}
        selectedRegions={selectedRegions}
        onToggleRegion={toggleRegion}
        preset={preset}
        onSelectPreset={onSelectPreset}
        showCustom={preset === "custom"}
        fromDate={fromDate}
        toDate={toDate}
        onChangeFrom={setFromDate}
        onChangeTo={setToDate}
        onApplyCustom={applyCustom}
        liveText={loading ? "Loading…" : "Live"}
        colors={COLORS}
      />

      {/* KPI */}
      <div className="kpis">
        <StatCard title={`Average (${primary})`} value={`${stats.avg.toFixed(4)} NOK/kWh`} spark={spark} />
        <StatCard title={`Min (${primary})`} value={`${stats.min.toFixed(4)} NOK/kWh`} tone="ok" />
        <StatCard title={`Max (${primary})`} value={`${stats.max.toFixed(4)} NOK/kWh`} tone="warn" />
      </div>

      {/* GRAF */}
      <div className="section">
        <h3>Main chart</h3>
        <UnifiedChart
          regions={selectedRegions as Region[]}
          mode={hours ? "hours" : "range"}
          hours={hours ?? 24}
          fromISO={from}
          toISOExclusive={toExclusive}
          muted={muted}
          onToggleRegion={(r) => setMuted((m) => ({ ...m, [r]: !m[r] }))}
          refreshKey={refreshTick} // ← viktig
        />
      </div>

      {/* TABELL */}
      <div className="section">
        <h3>Last rows ({primary})</h3>
        <PriceTable rows={rows} loading={loading} />
      </div>

      <div className="footer">Timestamps are UTC · Data via /api/prices · © {new Date().getFullYear()}</div>
    </div>
  );
}
