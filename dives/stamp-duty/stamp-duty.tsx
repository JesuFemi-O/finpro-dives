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

const TABLE = `"finpro"."txn_raw"."bank_emails"`;

const STAMP_FILTER = `
  parsed_transaction__txn_type = 'debit'
  AND (
    parsed_transaction__narrative ILIKE 'STAMP DUTY%'
    OR parsed_transaction__narrative ILIKE 'NIP OUTWARD STAMP DUTY%'
  )
`;

const D = {
  bg:         "#0e0e11",
  surface:    "#16161a",
  surfaceHi:  "#1e1e24",
  border:     "#2a2a32",
  borderSub:  "#1f1f28",
  text:       "#f0f0f4",
  muted:      "#6b6b7a",
  faint:      "#3a3a46",
  accent:     "#7c6aff",
  accentDim:  "#7c6aff22",
  amber:      "#fbbf24",
  amberDim:   "#fbbf2418",
  amberBorder:"#fbbf2440",
  red:        "#f87171",
  redDim:     "#f8717118",
  redBorder:  "#f8717140",
};

export default function StampDuty() {
  // ── Queries ──────────────────────────────────────────────────────
  const summary = useSQLQuery(`
    SELECT
      COUNT(*)                    as total_duties,
      SUM(parsed_transaction__amount) as total_spend,
      MIN(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) as earliest,
      MAX(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) as latest
    FROM ${TABLE}
    WHERE ${STAMP_FILTER}
  `);

  const totalTransfers = useSQLQuery(`
    SELECT COUNT(*) as total_transfers
    FROM ${TABLE}
    WHERE parsed_transaction__txn_type = 'debit'
      AND parsed_transaction__narrative NOT ILIKE 'COMMISSION%'
      AND parsed_transaction__narrative NOT ILIKE 'STAMP DUTY%'
      AND parsed_transaction__narrative NOT ILIKE 'NIP OUTWARD STAMP DUTY%'
  `);

  const weekly = useSQLQuery(`
    SELECT
      strftime(d, '%b %d') as week_label,
      strftime(d, '%Y-%m-%d') as week_key,
      COALESCE(COUNT(t.parsed_transaction__narrative), 0) as duties,
      COALESCE(SUM(t.parsed_transaction__amount), 0)     as total_spend
    FROM generate_series(DATE '2025-12-29', DATE '2026-03-23', INTERVAL 1 WEEK) AS s(d)
    LEFT JOIN ${TABLE} t
      ON date_trunc('week', strptime(t.parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) = s.d
      AND ${STAMP_FILTER}
    GROUP BY 1, 2
    ORDER BY 2
  `);

  const monthly = useSQLQuery(`
    SELECT
      strftime(d, '%b %Y') as month_label,
      strftime(d, '%Y-%m') as month_key,
      COALESCE(COUNT(t.parsed_transaction__narrative), 0) as duties,
      COALESCE(SUM(t.parsed_transaction__amount), 0)     as total_spend
    FROM generate_series(DATE '2026-01-01', DATE '2026-03-01', INTERVAL 1 MONTH) AS s(d)
    LEFT JOIN ${TABLE} t
      ON date_trunc('month', strptime(t.parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) = s.d
      AND ${STAMP_FILTER}
    GROUP BY 1, 2
    ORDER BY 2
  `);

  const byBank = useSQLQuery(`
    SELECT
      regexp_extract(parsed_transaction__narrative, 'To ([^|]+)\\|', 1) as bank,
      COUNT(*) as duties,
      SUM(parsed_transaction__amount) as total_spend
    FROM ${TABLE}
    WHERE ${STAMP_FILTER}
      AND regexp_extract(parsed_transaction__narrative, 'To ([^|]+)\\|', 1) != ''
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  `);

  const byDow = useSQLQuery(`
    SELECT
      DAYNAME(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p'))  as day,
      DAYOFWEEK(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')) as dow,
      COUNT(*) as duties
    FROM ${TABLE}
    WHERE ${STAMP_FILTER}
    GROUP BY 1, 2
    ORDER BY 2
  `);

  const recent = useSQLQuery(`
    SELECT
      strftime(strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p'), '%b %d, %Y') as date,
      parsed_transaction__amount as amount,
      regexp_extract(parsed_transaction__narrative, 'To ([^|]+)\\|', 1) as bank,
      regexp_extract(parsed_transaction__narrative, '\\|(.+?)/', 1) as recipient_purpose
    FROM ${TABLE}
    WHERE ${STAMP_FILTER}
    ORDER BY strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p') DESC
    LIMIT 8
  `);

  // ── Derived ──────────────────────────────────────────────────────
  const s            = (Array.isArray(summary.data) ? summary.data : [])[0];
  const totalDuties  = N(s?.total_duties);
  const totalSpend   = N(s?.total_spend);

  const tt           = (Array.isArray(totalTransfers.data) ? totalTransfers.data : [])[0];
  const transferCount = N(tt?.total_transfers);
  const dutyRate     = transferCount > 0 ? (totalDuties / transferCount) * 100 : 0;

  const weeklyRows = (Array.isArray(weekly.data) ? weekly.data : []).map(r => ({
    week: r.week_label as string,
    duties: N(r.duties),
    spend: N(r.total_spend),
  }));

  const monthlyRows = (Array.isArray(monthly.data) ? monthly.data : []).map(r => ({
    month: r.month_label as string,
    duties: N(r.duties),
    spend: N(r.total_spend),
  }));

  const bankRows = (Array.isArray(byBank.data) ? byBank.data : []).map(r => ({
    bank: r.bank as string,
    duties: N(r.duties),
    spend: N(r.total_spend),
  }));
  const maxBankDuties = Math.max(...bankRows.map(r => r.duties), 1);

  const dowRows = (Array.isArray(byDow.data) ? byDow.data : []).map(r => ({
    day: (r.day as string).slice(0, 3),
    duties: N(r.duties),
  }));
  const maxDow = Math.max(...dowRows.map(r => r.duties), 1);

  const recentRows = (Array.isArray(recent.data) ? recent.data : []).map(r => ({
    date:    r.date as string,
    amount:  N(r.amount),
    bank:    r.bank as string,
    purpose: r.recipient_purpose as string,
  }));

  // ── Helpers ───────────────────────────────────────────────────────
  const ttStyle = {
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: 8, fontSize: 12, color: D.text,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  };

  const Skel = ({ h, w = "100%" }: { h: number; w?: string | number }) => (
    <div style={{
      height: h, width: w, borderRadius: 6,
      background: `linear-gradient(90deg, ${D.surfaceHi} 25%, ${D.faint} 50%, ${D.surfaceHi} 75%)`,
      backgroundSize: "400% 100%", animation: "shimmer 1.6s infinite",
    }} />
  );

  return (
    <div style={{ background: D.bg, minHeight: "100vh", padding: "24px 24px 64px", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: D.redDim, border: `1px solid ${D.redBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>🏛️</div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: D.text, margin: 0, letterSpacing: "-0.025em" }}>Stamp Duty</h1>
          <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>
            Government levy on outbound transfers · ₦50 flat per transaction
          </p>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          {
            label: "Total paid",
            val:   summary.isLoading ? null : fmt(totalSpend),
            sub:   summary.isLoading ? null : `${totalDuties} charges`,
          },
          {
            label: "Avg / month",
            val:   monthly.isLoading ? null : fmt(
              monthlyRows.filter(r => r.spend > 0).reduce((a, b) => a + b.spend, 0) /
              Math.max(monthlyRows.filter(r => r.spend > 0).length, 1)
            ),
            sub:   "Jan – Mar 2026",
          },
          {
            label: "Duty rate",
            val:   (summary.isLoading || totalTransfers.isLoading) ? null : `${dutyRate.toFixed(0)}%`,
            sub:   totalTransfers.isLoading ? null : `of ${transferCount} transfers`,
          },
          {
            label: "Per charge",
            val:   "₦50",
            sub:   "government flat rate",
          },
        ].map(({ label, val, sub }) => (
          <div key={label} style={{
            background: D.surface, border: `1px solid ${D.border}`,
            borderRadius: 12, padding: "14px 16px",
          }}>
            <p style={{ fontSize: 10, color: D.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
            {val == null
              ? <Skel h={30} w={80} />
              : <p style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 3px", letterSpacing: "-0.03em" }}>{val}</p>
            }
            {sub && <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Weekly trend area chart ─────────────────────────────── */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 18px 10px", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Weekly charges
        </p>
        {weekly.isLoading ? <Skel h={180} /> : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weeklyRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dutyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={D.red} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={D.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={D.borderSub} vertical={false} />
              <XAxis dataKey="week" fontSize={10} tick={{ fill: D.muted }} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} tick={{ fill: D.muted }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={(v: number) => [v, "Charges"]}
                contentStyle={ttStyle}
                cursor={{ stroke: D.border }}
              />
              <Area
                type="linear" dataKey="duties"
                stroke={D.red} strokeWidth={2}
                fill="url(#dutyGrad)" dot={false}
                activeDot={{ r: 4, fill: D.red, stroke: D.bg, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── By bank + By day ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Top receiving banks */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px 16px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Top receiving banks
          </p>
          {byBank.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4,5].map(i => <Skel key={i} h={28} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {bankRows.map(r => (
                <div key={r.bank} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 0", borderBottom: `1px solid ${D.borderSub}`,
                }}>
                  <span style={{
                    fontSize: 12, color: D.text, fontWeight: 500,
                    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{r.bank}</span>
                  <div style={{ width: 80, height: 4, background: D.surfaceHi, borderRadius: 2, flexShrink: 0 }}>
                    <div style={{
                      height: "100%", borderRadius: 2, background: D.red,
                      width: `${(r.duties / maxBankDuties) * 100}%`,
                      opacity: 0.5 + 0.5 * (r.duties / maxBankDuties),
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: D.muted, minWidth: 24, textAlign: "right" }}>{r.duties}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By day of week */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 18px 10px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Charges by day of week
          </p>
          {byDow.isLoading ? <Skel h={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dowRows} barSize={22} margin={{ top: 0, right: 0, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={D.borderSub} vertical={false} />
                <XAxis dataKey="day" fontSize={10} tick={{ fill: D.muted }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: D.muted }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [v, "Charges"]} contentStyle={ttStyle} cursor={{ fill: D.surfaceHi }} />
                <Bar dataKey="duties" radius={[4, 4, 0, 0]}>
                  {dowRows.map(r => (
                    <Cell key={r.day} fill={r.duties === maxDow ? D.red : D.faint} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Monthly summary + Recent charges ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Monthly table */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px 16px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Monthly summary
          </p>
          {monthly.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3].map(i => <Skel key={i} h={36} />)}
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                  {["Month", "Charges", "Total"].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i === 0 ? "left" : "right",
                      padding: "0 0 8px", color: D.muted, fontWeight: 500, fontSize: 11,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map(r => (
                  <tr key={r.month} style={{ borderBottom: `1px solid ${D.borderSub}` }}>
                    <td style={{ padding: "10px 0", color: D.text }}>{r.month}</td>
                    <td style={{ padding: "10px 0", color: D.muted, textAlign: "right" }}>{r.duties}</td>
                    <td style={{ padding: "10px 0", color: D.text, fontWeight: 500, textAlign: "right" }}>{fmt(r.spend)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "10px 0", color: D.muted, fontSize: 12 }}>Total</td>
                  <td style={{ padding: "10px 0", color: D.text, fontWeight: 600, textAlign: "right" }}>
                    {monthlyRows.reduce((a, b) => a + b.duties, 0)}
                  </td>
                  <td style={{ padding: "10px 0", color: D.red, fontWeight: 700, textAlign: "right" }}>
                    {fmt(monthlyRows.reduce((a, b) => a + b.spend, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Recent charges */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "18px 20px 16px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Recent charges
          </p>
          {recent.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4,5,6].map(i => <Skel key={i} h={32} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recentRows.map((r, i) => (
                <div key={i} style={{
                  padding: "9px 0", borderBottom: `1px solid ${D.borderSub}`,
                  display: "flex", flexDirection: "column", gap: 2,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{
                      fontSize: 12, color: D.text, fontWeight: 500,
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      paddingRight: 8,
                    }}>
                      {r.purpose || r.bank}
                    </span>
                    <span style={{ fontSize: 12, color: D.red, fontWeight: 600, flexShrink: 0 }}>
                      {fmt(r.amount)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: D.muted }}>{r.bank}</span>
                    <span style={{ fontSize: 11, color: D.muted }}>{r.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
