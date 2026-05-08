import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

const PURPLE     = "#8b5cf6";
const PURPLE_DIM = "rgba(139,92,246,0.15)";
const BLUE       = "#58a6ff";
const GREEN      = "#3fb950";
const GOLD       = "#c9a84c";
const GRAY       = "#6b7280";
const MUTED      = "#8892a4";
const BORDER     = "rgba(255,255,255,0.07)";
const SURFACE    = "#111827";
const BG         = "#0a0f1e";

// Day-of-week averages calculated from full Simplecast CSV (2019-06-13 → 2026-05-08)
const DOW_DATA = [
  { day: "Mon", avg: 73 },
  { day: "Tue", avg: 68 },
  { day: "Wed", avg: 122 },
  { day: "Thu", avg: 68 },
  { day: "Fri", avg: 55 },
  { day: "Sat", avg: 51 },
  { day: "Sun", avg: 66 },
];

const YOY = [
  { month: "Jan", y2024: 2142, y2025: 1107, y2026: 1519 },
  { month: "Feb", y2024: 1687, y2025: 859,  y2026: 1813 },
  { month: "Mar", y2024: 1482, y2025: 1324, y2026: 1998 },
  { month: "Apr", y2024: 1609, y2025: 1820, y2026: 1615 },
  { month: "May", y2024: 1263, y2025: 1570, y2026: 447  },
];

function parseCSV(text) {
  const lines = text.trim().split("\n").slice(1);
  return lines
    .map((line) => {
      const [pct, total, date] = line.split(",");
      return { date: date?.trim(), total: parseInt(total, 10) || 0 };
    })
    .filter((d) => d.date && !isNaN(d.total));
}

function subDays(n) {
  return new Date(Date.now() - n * 86400000).toISOString().split("T")[0];
}

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}`;
}

function fmtMonth(ym) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m,10)-1]} '${y.slice(2)}`;
}

function KpiCard({ label, source, value, accent, large, sub, delta, deltaSub }) {
  const isPos = delta && delta.startsWith("+");
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent || PURPLE, borderRadius: "12px 12px 0 0" }} />
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginBottom: 8 }}>{source}</div>
      <div style={{ fontSize: 13, color: "#a0aab4", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: large ? 52 : 40, fontWeight: 700, color: "#f0f6fc", lineHeight: 1, marginBottom: 8 }}>{value}</div>
      {delta && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: isPos ? GREEN : "#f85149" }}>{delta}</span>
          {deltaSub && <span style={{ fontSize: 11, color: MUTED }}>{deltaSub}</span>}
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a2235", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: p.color || PURPLE, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const h = t.getHours() % 12 || 12;
  const m = String(t.getMinutes()).padStart(2, "0");
  const ap = t.getHours() >= 12 ? "PM" : "AM";
  return <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#f0f6fc", letterSpacing: 1 }}>{h}:{m} {ap}</span>;
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${BORDER}`, borderTop: `3px solid ${PURPLE}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: MUTED }}>Loading analytics data…</div>
    </div>
  );
}

export default function App() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(90);

  useEffect(() => {
    fetch("/data/downloads.csv")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((text) => setRows(parseCSV(text)))
      .catch((e) => setError(e.message));
  }, []);

  const stats = useMemo(() => {
    if (!rows) return null;
    const d30 = subDays(30);
    const d7  = subDays(7);
    const allTotal = rows.reduce((s, r) => s + r.total, 0);
    const total30  = rows.filter((r) => r.date >= d30).reduce((s, r) => s + r.total, 0);
    const total7   = rows.filter((r) => r.date >= d7).reduce((s, r) => s + r.total, 0);
    const peak     = rows.reduce((best, r) => r.total > best.total ? r : best, { total: 0, date: "" });
    const lastDate = rows[rows.length - 1]?.date || "";
    const firstDate = rows[0]?.date || "";
    return { allTotal, total30, total7, peak, lastDate, firstDate };
  }, [rows]);

  const chartData = useMemo(() => {
    if (!rows) return [];
    const cutoff = subDays(range);
    return rows
      .filter((r) => r.date >= cutoff)
      .map((r) => ({ date: fmtDate(r.date), downloads: r.total, rawDate: r.date }));
  }, [rows, range]);

  const monthlyData = useMemo(() => {
    if (!rows) return [];
    const map = {};
    rows.forEach(({ date, total }) => {
      const ym = date.slice(0, 7);
      map[ym] = (map[ym] || 0) + total;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, total]) => ({ month: fmtMonth(ym), total, ym }));
  }, [rows]);

  // Last 24 months with 3-month rolling average
  const recentMonths = useMemo(() => {
    const slice = monthlyData.slice(-24);
    return slice.map((entry, i) => {
      if (i < 2) return { ...entry, rolling3: null };
      const avg = Math.round((slice[i].total + slice[i - 1].total + slice[i - 2].total) / 3);
      return { ...entry, rolling3: avg };
    });
  }, [monthlyData]);

  if (error) return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "32px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "#f85149", marginBottom: 8 }}>Failed to load analytics data</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: MUTED }}>{error}</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#f0f6fc" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${BG}; }
        ::-webkit-scrollbar-thumb { background: #2a3445; border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .range-btn { background: rgba(255,255,255,0.04); border: 1px solid ${BORDER}; color: ${MUTED}; border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; font-family: 'DM Mono', monospace; transition: all .15s; }
        .range-btn:hover { border-color: ${PURPLE}; color: #f0f6fc; }
        .range-btn.active { background: ${PURPLE_DIM}; border-color: rgba(139,92,246,0.4); color: ${PURPLE}; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 36, height: 36, background: PURPLE, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎙</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Elite Partners Group — Podcast Analytics</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>Advisor Talk with Frank LaRosa · Simplecast Downloads</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {stats && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: MUTED }}>
              Data through <span style={{ color: "#f0f6fc" }}>{stats.lastDate}</span>
            </div>
          )}
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", background: PURPLE_DIM, color: PURPLE, padding: "5px 12px", borderRadius: 6, border: `1px solid rgba(139,92,246,0.2)` }}>Simplecast</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, animation: "pulse 2s infinite" }} />
            Live Export
          </div>
          <Clock />
        </div>
      </div>

      {!stats ? <Spinner /> : (
        <div style={{ padding: "24px 28px", maxWidth: 1600, margin: "0 auto" }}>

          {/* KPI ROW — 5 cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
            <KpiCard
              source="Simplecast · All Time"
              label="Total Downloads"
              value={stats.allTotal.toLocaleString()}
              accent={PURPLE}
              large
              sub={`Since ${stats.firstDate}`}
            />
            <KpiCard
              source="Simplecast · Last 30 Days"
              label="Downloads (30d)"
              value={stats.total30.toLocaleString()}
              accent={PURPLE}
            />
            <KpiCard
              source="Simplecast · Last 7 Days"
              label="Downloads (7d)"
              value={stats.total7.toLocaleString()}
              accent={BLUE}
            />
            <KpiCard
              source={`Simplecast · Peak Day ${stats.peak.date}`}
              label="Single-Day Record"
              value={stats.peak.total.toLocaleString()}
              accent={GOLD}
              sub={stats.peak.date}
            />
            <KpiCard
              source="Simplecast · Year-over-Year"
              label="2026 YTD (Jan–May)"
              value="7,392"
              accent={GREEN}
              delta="+10.7%"
              deltaSub="vs same period"
              sub="vs Jan–May 2025 (6,680)"
            />
          </div>

          {/* DAILY CHART */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Daily Downloads — Advisor Talk</div>
                <div style={{ fontSize: 11, color: MUTED }}>Simplecast Analytics · {range === 9999 ? "All time" : `Last ${range} days`}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[30, 90, 365, 9999].map((r) => (
                  <button key={r} className={`range-btn${range === r ? " active" : ""}`} onClick={() => setRange(r)}>
                    {r === 9999 ? "All" : `${r}d`}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PURPLE} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: MUTED, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 10) - 1)}
                />
                <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="downloads"
                  name="Downloads"
                  stroke={PURPLE}
                  strokeWidth={2.5}
                  fill="url(#dlGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: PURPLE }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* MONTHLY BAR + 3-MONTH ROLLING AVG */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Monthly Downloads</div>
                <div style={{ fontSize: 11, color: MUTED }}>Last 24 months · Simplecast Analytics</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: MUTED }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 12, height: 3, background: PURPLE, borderRadius: 2 }} />
                  Monthly
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 12, height: 2, borderTop: `2px dashed ${GOLD}` }} />
                  3-mo avg
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={recentMonths} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="total" name="Downloads" radius={[3, 3, 0, 0]}>
                  {recentMonths.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={i === recentMonths.length - 1 ? PURPLE : i === recentMonths.length - 2 ? BLUE : "rgba(139,92,246,0.4)"}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="rolling3"
                  name="3-mo avg"
                  stroke={GOLD}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4, fill: GOLD }}
                  connectNulls={false}
                />
                <ReferenceLine
                  x="May '26"
                  stroke="rgba(201,168,76,0.25)"
                  strokeDasharray="4 3"
                  label={{ value: "* partial", position: "top", fill: GOLD, fontSize: 9, fontFamily: "'DM Mono', monospace" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 8, fontFamily: "'DM Mono', monospace", fontSize: 10, color: MUTED }}>
              * May '26: partial month (8 days). On pace for ~1,732
            </div>
          </div>

          {/* YOY GROUPED BAR CHART */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Year-over-Year — Jan through May</div>
                <div style={{ fontSize: 11, color: MUTED }}>2024 · 2025 · 2026 · Simplecast Analytics</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: MUTED }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, background: GRAY, borderRadius: 2 }} />
                  2024
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, background: BLUE, borderRadius: 2 }} />
                  2025
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, background: GOLD, borderRadius: 2 }} />
                  2026
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={YOY} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barCategoryGap="25%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="y2024" name="2024" fill={GRAY} radius={[3, 3, 0, 0]} />
                <Bar dataKey="y2025" name="2025" fill={BLUE} radius={[3, 3, 0, 0]} />
                <Bar dataKey="y2026" name="2026" fill={GOLD} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 8, fontFamily: "'DM Mono', monospace", fontSize: 10, color: MUTED }}>
              * May 2026 partial (8 days)
            </div>
          </div>

          {/* DAY-OF-WEEK CHART */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Average Downloads by Day of Week</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 16 }}>All-time average · Calculated from full Simplecast daily export</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={DOW_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 140]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="avg" name="Avg Downloads" radius={[4, 4, 0, 0]}>
                  {DOW_DATA.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.day === "Wed" ? GOLD : "rgba(139,92,246,0.5)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 8, fontFamily: "'DM Mono', monospace", fontSize: 10, color: MUTED }}>
              Wed spike likely reflects episode release day · Mon=73 · Tue=68 · Wed=122 · Thu=68 · Fri=55 · Sat=51 · Sun=66
            </div>
          </div>

        </div>
      )}

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 32px", display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 10, color: MUTED, marginTop: 24 }}>
        <span>Elite Partners Group · Podcast Analytics · Advisor Talk with Frank LaRosa</span>
        <span>Source: Simplecast · Daily Download Export</span>
        {stats && <span>Data through {stats.lastDate}</span>}
      </div>
    </div>
  );
}
