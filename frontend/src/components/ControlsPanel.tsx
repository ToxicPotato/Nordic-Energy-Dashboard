import React from "react";

export type PresetId = "24h" | "48h" | "72h" | "7d" | "14d" | "30d" | "ytd" | "custom";

// Enkle etiketter for presets
const PRESET_LABEL: Record<Exclude<PresetId, "custom">, string> = {
  "24h": "24h",
  "48h": "48h",
  "72h": "72h",
  "7d":  "7d",
  "14d": "14d",
  "30d": "30d",
  "ytd": "YTD",
};

export interface ControlsPanelProps<Region extends string> {
  /** Alle tilgjengelige regioner (rekkefølgen bestemmer “first = primary”) */
  regions: Region[];
  /** Valgte regioner (subset av regions) */
  selectedRegions: Region[];
  /** Klikk på region */
  onToggleRegion: (r: Region) => void;

  /** Aktiv preset */
  preset: PresetId | null;
  /** Velg preset */
  onSelectPreset: (p: PresetId) => void;

  /** Vises når preset = "custom" */
  showCustom: boolean;
  fromDate: string;           // YYYY-MM-DD
  toDate: string;             // YYYY-MM-DD
  onChangeFrom: (s: string) => void;
  onChangeTo: (s: string) => void;
  onApplyCustom: () => void;

  /** “Live” / “Loading…” tekst oppe til høyre */
  liveText?: string;

  /** Farger per region (prikk i knappen) */
  colors: Record<string, string>;

  /** Ekstra className om du vil */
  className?: string;
}

/**
 * Isolert "card" for kontrollene.
 * - Live-badge oppe til høyre.
 * - Regionknapper (toggle) til venstre.
 * - Presets på én linje med horisontal scroll.
 * - Custom-range på full bredde under.
 */
export default function ControlsPanel<Region extends string>({
  regions,
  selectedRegions,
  onToggleRegion,
  preset,
  onSelectPreset,
  showCustom,
  fromDate,
  toDate,
  onChangeFrom,
  onChangeTo,
  onApplyCustom,
  liveText = "Live",
  colors,
  className = "",
}: ControlsPanelProps<Region>) {

  return (
    <div className={`panel cp-panel ${className}`}>
      {/* Live oppe til høyre */}
      <div className="cp-live">
        <span className="badge ok">{liveText}</span>
      </div>

      {/* Rad 1: Regions + Presets */}
      <div className="cp-row">
        <div>
          <label>Regions (first = primary)</label>
          <div className="cp-region-bar">
            {regions.map(r => {
              const active = selectedRegions.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  className={`cp-region-btn ${active ? "is-on" : ""}`}
                  onClick={() => onToggleRegion(r)}
                  aria-pressed={active}
                  title={r}
                >
                  <span className="dot" style={{ background: colors[r] ?? "#7aa2f7" }} />
                  <span>{r}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label>Timeframe</label>
          <div className="cp-preset-strip" aria-label="Timeframe">
            {(["24h","48h","72h","7d","14d","30d","ytd","custom"] as PresetId[]).map(id => {
              const isOn = preset === id;
              const label = id === "custom" ? "Custom" : PRESET_LABEL[id as Exclude<PresetId,"custom">];
              return (
                <button
                  key={id}
                  type="button"
                  className={`chip cp-preset ${isOn ? "is-on" : ""}`}
                  aria-pressed={isOn}
                  onClick={() => onSelectPreset(id)}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rad 2: Custom range (full bredde) */}
      {showCustom && (
        <div className="cp-custom">
          <div className="cp-custom-row">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onChangeFrom(e.target.value)}
              aria-label="From (UTC day)"
            />
            <span className="arrow">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onChangeTo(e.target.value)}
              aria-label="To (UTC day)"
            />
            <button className="primary" onClick={onApplyCustom} disabled={!fromDate || !toDate}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
