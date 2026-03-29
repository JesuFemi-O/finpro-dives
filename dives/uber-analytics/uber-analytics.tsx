import { useState } from "react";
import { useSQLQuery } from "@motherduck/react-sql-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, Cell,
} from "recharts";

const N = (v: unknown): number => (v != null ? Number(v) : 0);

const fmt = (n: number) => {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${Math.round(n)}`;
};

const REQUIRED_DATABASES = "finpro";

const BASE_FILTER = `
  parsed_transaction__txn_type = 'debit'
  AND parsed_transaction__narrative NOT ILIKE 'COMMISSION%'
  AND parsed_transaction__narrative NOT ILIKE 'STAMP DUTY%'
  AND parsed_transaction__narrative NOT ILIKE 'NIP OUTWARD STAMP DUTY%'
  AND parsed_transaction__narrative ILIKE '%uber%'
  AND parsed_transaction__narrative NOT ILIKE '%refund%'
`;

const TABLE = `"finpro"."txn_raw"."bank_emails"`;

const D = {
  bg:        "#0e0e11",
  surface:   "#16161a",
  surfaceHi: "#1e1e24",
  border:    "#2a2a32",
  borderSub: "#1f1f28",
  text:      "#f0f0f4",
  muted:     "#6b6b7a",
  faint:     "#3a3a46",
  accent:    "#7c6aff",
  accentDim: "#7c6aff22",
  green:     "#34d399",
  greenDim:  "#34d39918",
  greenBorder:"#34d39940",
  red:       "#f87171",
  redDim:    "#f8717118",
  redBorder: "#f8717140",
  amber:     "#fbbf24",
  amberDim:  "#fbbf2418",
  amberBorder:"#fbbf2440",
};

export default function UberAnalytics() {
  const [activeTab, setActiveTab] = useState<"analytics" | "calculator">("analytics");

  const [carPrice,           setCarPrice]           = useState(8_000_000);
  const [loanRate,           setLoanRate]           = useState(22);
  const [loanYears,          setLoanYears]          = useState(4);
  const [fuelMonthly,        setFuelMonthly]        = useState(60_000);
  const [maintenanceMonthly, setMaintenanceMonthly] = useState(30_000);
  const [insuranceMonthly,   setInsuranceMonthly]   = useState(15_000);
  const [parkingMonthly,     setParkingMonthly]     = useState(10_000);
  const [downPaymentPct,     setDownPaymentPct]     = useState(20);

  // ── Queries ──────────────────────────────────────────────────────
  const summary = useSQLQuery(`
    SELECT COUNT(*) as trip_count,
           SUM(parsed_transaction__amount)  as total_spend,
           AVG(parsed_transaction__amount)  as avg_fare,
           MAX(parsed_transaction__amount)  as max_fare
    FROM ${TABLE} WHERE ${BASE_FILTER}
  `);

  const monthly = useSQLQuery(`
    SELECT strftime(d, '%b %y')  as month_label,
           strftime(d, '%Y-%m')  as month_key,
           COALESCE(SUM(t.parsed_transaction__amount), 0)         as total_spend,
           COALESCE(COUNT(t.parsed_transaction__narrative), 0)    as trips
    FROM generate_series(DATE '2025-07-01', DATE '2026-03-01', INTERVAL 1 MONTH) AS s(d)
    LEFT JOIN ${TABLE} t
      ON date_trunc('month', strptime(t.parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) = s.d
      AND ${BASE_FILTER}
    GROUP BY 1, 2 ORDER BY 2
  `);

  const byDow = useSQLQuery(`
    SELECT DAYNAME(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p'))  as day,
           DAYOFWEEK(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) as dow,
           COUNT(*) as trips, SUM(parsed_transaction__amount) as total_spend
    FROM ${TABLE} WHERE ${BASE_FILTER}
    GROUP BY 1, 2 ORDER BY 2
  `);

  const byHour = useSQLQuery(`
    SELECT HOUR(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) as hr,
           COUNT(*) as trips
    FROM ${TABLE} WHERE ${BASE_FILTER}
    GROUP BY 1 ORDER BY 1
  `);

  const buckets = useSQLQuery(`
    SELECT CASE WHEN parsed_transaction__amount < 5000  THEN '< ₦5K'
                WHEN parsed_transaction__amount < 15000 THEN '₦5K–15K'
                WHEN parsed_transaction__amount < 30000 THEN '₦15K–30K'
                ELSE '> ₦30K' END as bucket,
           CASE WHEN parsed_transaction__amount < 5000  THEN 1
                WHEN parsed_transaction__amount < 15000 THEN 2
                WHEN parsed_transaction__amount < 30000 THEN 3
                ELSE 4 END as sort_order,
           COUNT(*) as trips, SUM(parsed_transaction__amount) as total_spend
    FROM ${TABLE} WHERE ${BASE_FILTER}
    GROUP BY 1, 2 ORDER BY 2
  `);

  // ── Derived ──────────────────────────────────────────────────────
  const s            = (Array.isArray(summary.data) ? summary.data : [])[0];
  const totalSpend   = N(s?.total_spend);
  const tripCount    = N(s?.trip_count);
  const avgFare      = N(s?.avg_fare);

  const monthlyRows  = (Array.isArray(monthly.data) ? monthly.data : []).map(r => ({
    month: r.month_label as string,
    spend: N(r.total_spend),
    trips: N(r.trips),
  }));
  const activeMonths    = monthlyRows.filter(r => r.spend > 0);
  const avgMonthlySpend = activeMonths.length > 0
    ? activeMonths.reduce((a, b) => a + b.spend, 0) / activeMonths.length : 0;
  const peakMonth       = activeMonths.reduce(
    (a, b) => b.spend > a.spend ? b : a,
    activeMonths[0] ?? { month: "—", spend: 0 }
  );

  const dowRows = (Array.isArray(byDow.data) ? byDow.data : []).map(r => ({
    day: (r.day as string).slice(0, 3), trips: N(r.trips), spend: N(r.total_spend),
  }));
  const maxDow = Math.max(...dowRows.map(r => r.trips), 1);

  const hourRows = (Array.isArray(byHour.data) ? byHour.data : []).map(r => {
    const hr = N(r.hr);
    return { label: hr === 0 ? "12a" : hr < 12 ? `${hr}a` : hr === 12 ? "12p" : `${hr - 12}p`, trips: N(r.trips) };
  });

  const bucketRows = (Array.isArray(buckets.data) ? buckets.data : []).map(r => ({
    bucket: r.bucket as string, trips: N(r.trips), spend: N(r.total_spend),
  }));
  const maxBucketTrips = Math.max(...bucketRows.map(r => r.trips), 1);

  // ── Calculator math ───────────────────────────────────────────────
  const downPayment     = carPrice * (downPaymentPct / 100);
  const loanAmount      = carPrice - downPayment;
  const monthlyRate     = loanRate / 100 / 12;
  const nPayments       = loanYears * 12;
  const monthlyLoan     = loanAmount > 0 && monthlyRate > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, nPayments)) /
      (Math.pow(1 + monthlyRate, nPayments) - 1)
    : loanAmount / nPayments;
  const totalCarMonthly = monthlyLoan + fuelMonthly + maintenanceMonthly + insuranceMonthly + parkingMonthly;
  const diff            = totalCarMonthly - avgMonthlySpend; // positive = car costs more
  const uberWins        = diff > 0;
  const breakEvenMonths = !uberWins && diff < 0 ? Math.abs(downPayment / diff) : null;
  const totalInterest   = monthlyLoan * nPayments - loanAmount;

  // ── Tooltip style ─────────────────────────────────────────────────
  const ttStyle = {
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: 8, fontSize: 12, color: D.text,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  };

  // ── Skeleton ──────────────────────────────────────────────────────
  const Skel = ({ h, w = "100%" }: { h: number; w?: string | number }) => (
    <div style={{
      height: h, width: w, borderRadius: 6,
      background: `linear-gradient(90deg, ${D.surfaceHi} 25%, ${D.faint} 50%, ${D.surfaceHi} 75%)`,
      backgroundSize: "400% 100%", animation: "shimmer 1.6s infinite",
    }} />
  );

  // ── Slider row ────────────────────────────────────────────────────
  const SliderRow = ({
    label, value, onChange, min, max, step, display, hint,
  }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step: number;
    display: string; hint?: string;
  }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: D.muted }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: D.text, letterSpacing: "-0.02em" }}>{display}</span>
          {hint && <span style={{ fontSize: 11, color: D.muted }}>{hint}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: D.accent, cursor: "pointer", height: 4 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 10, color: D.faint }}>{fmt(min)}</span>
        <span style={{ fontSize: 10, color: D.faint }}>{fmt(max)}</span>
      </div>
    </div>
  );

  // ── Scorecard ─────────────────────────────────────────────────────
  const Scorecard = ({
    label, value, sub, color, dim, border: bdr,
  }: {
    label: string; value: string; sub?: string;
    color: string; dim: string; border: string;
  }) => (
    <div style={{
      background: dim, border: `1px solid ${bdr}`,
      borderRadius: 12, padding: "14px 16px", flex: 1,
    }}>
      <p style={{ fontSize: 11, color, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.8 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color, margin: "0 0 2px", letterSpacing: "-0.02em" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color, margin: 0, opacity: 0.65 }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ background: D.bg, minHeight: "100vh", padding: "24px 24px 64px", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: ${D.faint}; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: ${D.accent}; cursor: pointer; border: 2px solid ${D.bg}; box-shadow: 0 0 0 1px ${D.accent}; }
        input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: ${D.accent}; cursor: pointer; border: 2px solid ${D.bg}; box-shadow: 0 0 0 1px ${D.accent}; }
      `}</style>

      {/* ── Brand header ───────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: D.accentDim, border: `1px solid ${D.accent}40`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>🚗</div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: D.text, margin: 0, letterSpacing: "-0.025em" }}>Uber Spend</h1>
          <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>Jul 2025 – Mar 2026 · Nigerian Naira</p>
        </div>
      </div>

      {/* ── Prominent tab bar ──────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        background: D.surface, border: `1px solid ${D.border}`,
        borderRadius: 14, padding: 5, gap: 4, marginBottom: 28,
      }}>
        {(["analytics", "calculator"] as const).map(id => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: "11px 0", fontSize: 13, fontWeight: 600, borderRadius: 10,
              border: "none", cursor: "pointer", transition: "all 0.18s",
              background: active ? D.surfaceHi : "transparent",
              color: active ? D.text : D.muted,
              boxShadow: active ? `0 0 0 1px ${D.border}, 0 2px 8px rgba(0,0,0,0.4)` : "none",
              letterSpacing: active ? "-0.01em" : "0",
            }}>
              {id === "analytics" ? "📊  Spend Analytics" : "🧮  Buy vs Ride"}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
          ANALYTICS TAB
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total spent",  val: summary.isLoading ? null : fmt(totalSpend),       sub: `across ${tripCount} trips` },
              { label: "Avg / month",  val: monthly.isLoading ? null : fmt(avgMonthlySpend),  sub: `${activeMonths.length} active months` },
              { label: "Avg fare",     val: summary.isLoading ? null : fmt(avgFare),          sub: "per trip" },
              { label: "Peak month",   val: monthly.isLoading ? null : peakMonth.month,       sub: monthly.isLoading ? null : fmt(peakMonth.spend) },
            ].map(({ label, val, sub }) => (
              <div key={label} style={{
                background: D.surface, border: `1px solid ${D.border}`,
                borderRadius: 12, padding: "14px 16px",
              }}>
                <p style={{ fontSize: 10, color: D.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
                {val == null ? <Skel h={30} w={80} /> : (
                  <p style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 3px", letterSpacing: "-0.03em" }}>{val}</p>
                )}
                {sub && <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>{sub}</p>}
              </div>
            ))}
          </div>

          {/* Monthly area chart */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 18px 10px", marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Monthly spend</p>
            {monthly.isLoading ? <Skel h={190} /> : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={monthlyRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={D.accent} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={D.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={D.borderSub} vertical={false} />
                  <XAxis dataKey="month" fontSize={11} tick={{ fill: D.muted }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₦${v / 1000}K`} fontSize={11} tick={{ fill: D.muted }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip formatter={(v: number) => [fmt(v), "Spend"]} contentStyle={ttStyle} cursor={{ stroke: D.border }} />
                  <Area type="linear" dataKey="spend" stroke={D.accent} strokeWidth={2}
                    fill="url(#ag)" dot={false}
                    activeDot={{ r: 4, fill: D.accent, stroke: D.bg, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* DoW + Hour */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 18px 10px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>By day of week</p>
              {byDow.isLoading ? <Skel h={140} /> : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dowRows} barSize={20} margin={{ top: 0, right: 0, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={D.borderSub} vertical={false} />
                    <XAxis dataKey="day" fontSize={10} tick={{ fill: D.muted }} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} tick={{ fill: D.muted }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [v, "Trips"]} contentStyle={ttStyle} cursor={{ fill: D.surfaceHi }} />
                    <Bar dataKey="trips" radius={[4, 4, 0, 0]}>
                      {dowRows.map(r => <Cell key={r.day} fill={r.trips === maxDow ? D.accent : D.faint} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 18px 10px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>By hour of day</p>
              {byHour.isLoading ? <Skel h={140} /> : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={hourRows} barSize={12} margin={{ top: 0, right: 0, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={D.borderSub} vertical={false} />
                    <XAxis dataKey="label" fontSize={9} tick={{ fill: D.muted }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis fontSize={10} tick={{ fill: D.muted }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [v, "Trips"]} contentStyle={ttStyle} cursor={{ fill: D.surfaceHi }} />
                    <Bar dataKey="trips" fill={D.faint} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Fare breakdown */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 18px 14px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Fare breakdown</p>
            {buckets.isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3,4].map(i => <Skel key={i} h={32} />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {bucketRows.map(r => (
                  <div key={r.bucket} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 0", borderBottom: `1px solid ${D.borderSub}`,
                  }}>
                    <span style={{ width: 90, fontSize: 13, color: D.text, fontWeight: 500, flexShrink: 0 }}>{r.bucket}</span>
                    <div style={{ flex: 1, height: 5, background: D.surfaceHi, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, background: D.accent,
                        width: `${(r.trips / maxBucketTrips) * 100}%`,
                        opacity: 0.6 + 0.4 * (r.trips / maxBucketTrips),
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: D.muted, minWidth: 52, textAlign: "right" }}>{r.trips} trips</span>
                    <span style={{ fontSize: 12, color: D.muted, minWidth: 28, textAlign: "right" }}>
                      {tripCount > 0 ? `${((r.trips / tripCount) * 100).toFixed(0)}%` : "—"}
                    </span>
                    <span style={{ fontSize: 13, color: D.text, fontWeight: 500, minWidth: 56, textAlign: "right" }}>{fmt(r.spend)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          BUY VS RIDE TAB
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "calculator" && (
        <>
          {/* ── VERDICT HERO — always visible at top ─────────── */}
          <div style={{
            background: uberWins ? D.greenDim : D.redDim,
            border: `1px solid ${uberWins ? D.greenBorder : D.redBorder}`,
            borderRadius: 16, padding: "24px 28px", marginBottom: 20,
          }}>
            <p style={{ fontSize: 11, color: uberWins ? D.green : D.red, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.75 }}>
              {uberWins ? "Verdict: keep riding" : "Verdict: buying makes sense"}
            </p>
            <p style={{ fontSize: 32, fontWeight: 800, color: uberWins ? D.green : D.red, margin: "0 0 8px", letterSpacing: "-0.035em", lineHeight: 1.1 }}>
              {uberWins
                ? <>Uber saves you <span style={{ opacity: 1 }}>{monthly.isLoading ? "…" : fmt(diff)}</span>/mo</>
                : <>Car saves you <span style={{ opacity: 1 }}>{monthly.isLoading ? "…" : fmt(Math.abs(diff))}</span>/mo</>
              }
            </p>
            <p style={{ fontSize: 13, color: uberWins ? D.green : D.red, margin: 0, opacity: 0.7, lineHeight: 1.5 }}>
              {uberWins
                ? `A car would cost ${fmt(diff)} more every month than your current Uber habit. Adjust the sliders below to see when the math flips.`
                : `After a ${fmt(downPayment)} down payment, you'd recover that in ${breakEvenMonths ? `${Math.ceil(breakEvenMonths)} months` : "—"} and pocket ${fmt(Math.abs(diff))} every month after.`
              }
            </p>
          </div>

          {/* ── SCORECARDS row ───────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
            <Scorecard
              label="Your Uber / mo"
              value={monthly.isLoading ? "…" : fmt(avgMonthlySpend)}
              sub={`${activeMonths.length}-month avg`}
              color={D.accent} dim={D.accentDim} border={`${D.accent}40`}
            />
            <Scorecard
              label="Car total / mo"
              value={fmt(totalCarMonthly)}
              sub="loan + running"
              color={D.amber} dim={D.amberDim} border={D.amberBorder}
            />
            <Scorecard
              label="Monthly loan"
              value={fmt(monthlyLoan)}
              sub={`${loanYears}yr at ${loanRate}%`}
              color={D.muted} dim={D.surfaceHi} border={D.border}
            />
            <Scorecard
              label="Total interest"
              value={fmt(totalInterest)}
              sub={`over ${loanYears} years`}
              color={D.muted} dim={D.surfaceHi} border={D.border}
            />
          </div>

          {/* ── SLIDERS + LIVE BREAKDOWN ─────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Left: sliders */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Purchase */}
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px 14px" }}>
                <p style={{ fontSize: 11, color: D.muted, margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Purchase</p>
                <SliderRow label="Car price" value={carPrice} onChange={setCarPrice}
                  min={2_000_000} max={30_000_000} step={500_000}
                  display={fmt(carPrice)} />
                <SliderRow label="Down payment" value={downPaymentPct} onChange={setDownPaymentPct}
                  min={0} max={60} step={5}
                  display={`${downPaymentPct}%`} hint={`= ${fmt(downPayment)}`} />
                <SliderRow label="Loan interest rate" value={loanRate} onChange={setLoanRate}
                  min={5} max={40} step={1}
                  display={`${loanRate}%`} />
                <SliderRow label="Loan term" value={loanYears} onChange={setLoanYears}
                  min={1} max={7} step={1}
                  display={`${loanYears} yr`} hint={`${nPayments} payments`} />
              </div>

              {/* Running costs */}
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px 14px" }}>
                <p style={{ fontSize: 11, color: D.muted, margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Monthly running costs</p>
                <SliderRow label="Fuel" value={fuelMonthly} onChange={setFuelMonthly}
                  min={10_000} max={200_000} step={5_000} display={fmt(fuelMonthly)} />
                <SliderRow label="Maintenance" value={maintenanceMonthly} onChange={setMaintenanceMonthly}
                  min={5_000} max={100_000} step={5_000} display={fmt(maintenanceMonthly)} />
                <SliderRow label="Insurance" value={insuranceMonthly} onChange={setInsuranceMonthly}
                  min={5_000} max={80_000} step={2_500} display={fmt(insuranceMonthly)} />
                <SliderRow label="Parking / tolls" value={parkingMonthly} onChange={setParkingMonthly}
                  min={0} max={50_000} step={2_500} display={fmt(parkingMonthly)} />
              </div>
            </div>

            {/* Right: live cost breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Visual comparison bars */}
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px" }}>
                <p style={{ fontSize: 11, color: D.muted, margin: "0 0 18px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Monthly comparison</p>
                {(() => {
                  const maxCost = Math.max(totalCarMonthly, avgMonthlySpend, 1);
                  const uberPct = (avgMonthlySpend / maxCost) * 100;
                  const carPct  = (totalCarMonthly / maxCost) * 100;
                  return (
                    <>
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                          <span style={{ fontSize: 12, color: D.muted }}>Uber avg / month</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: D.accent }}>{monthly.isLoading ? "…" : fmt(avgMonthlySpend)}</span>
                        </div>
                        <div style={{ height: 10, background: D.surfaceHi, borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 5, background: D.accent, width: `${uberPct}%`, transition: "width 0.25s" }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                          <span style={{ fontSize: 12, color: D.muted }}>Car total / month</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: D.amber }}>{fmt(totalCarMonthly)}</span>
                        </div>
                        <div style={{ height: 10, background: D.surfaceHi, borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 5, background: D.amber, width: `${carPct}%`, transition: "width 0.25s" }} />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Car cost line items */}
              <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px" }}>
                <p style={{ fontSize: 11, color: D.muted, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Car cost breakdown</p>
                {[
                  { label: "Loan repayment",  val: monthlyLoan,          pct: (monthlyLoan / totalCarMonthly) * 100 },
                  { label: "Fuel",            val: fuelMonthly,          pct: (fuelMonthly / totalCarMonthly) * 100 },
                  { label: "Maintenance",     val: maintenanceMonthly,   pct: (maintenanceMonthly / totalCarMonthly) * 100 },
                  { label: "Insurance",       val: insuranceMonthly,     pct: (insuranceMonthly / totalCarMonthly) * 100 },
                  { label: "Parking / tolls", val: parkingMonthly,       pct: (parkingMonthly / totalCarMonthly) * 100 },
                ].map(({ label, val, pct }) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: D.muted }}>{label}</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <span style={{ fontSize: 11, color: D.faint }}>{pct.toFixed(0)}%</span>
                        <span style={{ fontSize: 13, color: D.text, fontWeight: 500, minWidth: 52, textAlign: "right" }}>{fmt(val)}</span>
                      </div>
                    </div>
                    <div style={{ height: 3, background: D.surfaceHi, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: D.amber, width: `${pct}%`, opacity: 0.7, transition: "width 0.25s" }} />
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: `1px solid ${D.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: D.text }}>Total / month</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: D.amber }}>{fmt(totalCarMonthly)}</span>
                </div>
              </div>

              {/* Loan snapshot */}
              <div style={{
                background: D.surface, border: `1px solid ${D.border}`,
                borderRadius: 12, padding: "16px 20px",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
              }}>
                {[
                  ["Down payment",   fmt(downPayment)],
                  ["Loan amount",    fmt(loanAmount)],
                  ["Monthly repay",  fmt(monthlyLoan)],
                  ["Total interest", fmt(totalInterest)],
                ].map(([lbl, val]) => (
                  <div key={lbl as string}>
                    <p style={{ fontSize: 10, color: D.muted, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{lbl}</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: D.text, margin: 0 }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
