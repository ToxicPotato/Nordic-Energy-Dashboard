import type { PriceRow } from "../apiClient";

export default function PriceTable({ rows, loading = false }: { rows: PriceRow[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="table panel">
        <div style={{ padding: 14 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
              <div><div className="badge" style={{ marginBottom: 8 }}>Loading…</div></div>
            </div>
            {[...Array(6)].map((_,i)=><div key={i} style={{height:12, background:"#12161d", borderRadius:6}} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="table panel">
      <table>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Price (NOK/kWh)</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(-24).map((r) => (
            <tr key={r.ts}>
              <td>{r.ts}</td>
              <td>{r.price_nok_per_kwh.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
