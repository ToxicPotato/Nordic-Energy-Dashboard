import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    // fallback: følg OS
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark(v => !v)}
      aria-label="Toggle theme"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text)",
        cursor: "pointer"
      }}
      title="Toggle light/dark"
    >
      <span style={{ fontSize: 14 }}>{dark ? "🌙" : "☀️"}</span>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{dark ? "Dark" : "Light"}</span>
    </button>
  );
}
