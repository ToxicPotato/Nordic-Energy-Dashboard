import { Area, AreaChart, ResponsiveContainer } from "recharts";

export default function StatCard({
  title, value, tone, spark,
}: {
  title: string;
  value: string;
  tone?: "ok" | "warn";
  spark?: Array<{ x: number; y: number }>;
}) {
  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap: 12 }}>
        <div>
          <div style={{ fontSize:12, color:"var(--ink-muted)" }}>{title}</div>
          <div className="stat-value" style={{ fontSize:24, fontWeight:700 }}>{value}</div>
          {tone && (
            <span className={`badge ${tone}`} style={{ marginTop:6, display:"inline-block" }}>
              {tone === "ok" ? "OK" : "WARN"}
            </span>
          )}
        </div>
        {spark && spark.length > 1 && (
          <div style={{ width:120, height:50, color: "currentColor" }}>
            <ResponsiveContainer>
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id="stat-g" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopOpacity={.28} stopColor="currentColor"/>
                    <stop offset="100%" stopOpacity={0} stopColor="currentColor"/>
                  </linearGradient>
                </defs>
                <Area dataKey="y" type="monotone" stroke="currentColor" fill="url(#stat-g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
