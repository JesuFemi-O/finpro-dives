# Dive Design Guide

Design conventions established across dives in this repo. Read this before
building or editing any dive. These are working decisions — not aspirational
rules — derived from what has actually been built and iterated on.

---

## Theme

All dives use a **dark theme**. There is no light mode.

The palette is a layered near-black system with an electric violet accent:

```tsx
const D = {
  bg:         "#0e0e11",   // page background
  surface:    "#16161a",   // card / panel background
  surfaceHi:  "#1e1e24",   // elevated surface (inputs, skeleton base)
  border:     "#2a2a32",   // card borders
  borderSub:  "#1f1f28",   // subtle internal dividers
  text:       "#f0f0f4",   // primary text
  muted:      "#6b6b7a",   // labels, secondary text
  faint:      "#3a3a46",   // inactive chart bars, skeleton shimmer peak
  accent:     "#7c6aff",   // primary accent (electric violet)
  accentDim:  "#7c6aff22", // accent tinted background
  green:      "#34d399",   // positive / savings
  greenDim:   "#34d39918", // green tinted background
  greenBorder:"#34d39940", // green tinted border
  red:        "#f87171",   // negative / cost / warning
  redDim:     "#f8717118",
  redBorder:  "#f8717140",
  amber:      "#fbbf24",   // secondary metric (car costs, comparisons)
  amberDim:   "#fbbf2418",
  amberBorder:"#fbbf2440",
};
```

**Color roles:**
- `accent` (violet) — primary data series, active states, slider thumbs, progress fills
- `amber` — secondary data series used when two things are being compared (e.g. Uber vs car)
- `green` / `red` — verdict states only. Green = user is better off, Red = user is worse off
- Never use green/red for data series. Reserve them for binary outcome states.

---

## Layout

### Page shell

```tsx
<div style={{ background: D.bg, minHeight: "100vh", padding: "24px 24px 64px",
              fontFamily: "system-ui,-apple-system,sans-serif" }}>
```

- `24px` horizontal padding, `64px` bottom padding so content doesn't crowd the footer
- No max-width constraint — dives render in a constrained container anyway

### Header

Every dive opens with a small icon badge + title + subtitle line:

```tsx
<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
  <div style={{
    width: 34, height: 34, borderRadius: 9,
    background: D.accentDim, border: `1px solid ${D.accent}40`,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
  }}>🚗</div>
  <div>
    <h1 style={{ fontSize: 20, fontWeight: 700, color: D.text, margin: 0, letterSpacing: "-0.025em" }}>
      Title
    </h1>
    <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>Date range · Currency · Data source</p>
  </div>
</div>
```

### Cards / panels

All content lives in surface cards. No naked content floating on the background.

```tsx
<div style={{
  background: D.surface, border: `1px solid ${D.border}`,
  borderRadius: 12, padding: "18px 20px",
}}>
```

- `borderRadius: 12` is the standard card radius
- `borderRadius: 14` for the tab bar (slightly larger pill)
- No box shadows on cards — border + background layering provides enough depth

---

## Navigation: Tabs

When a dive has multiple views, use a **full-width segmented tab bar** immediately
below the header. Small inline tabs at a corner are easy to miss — the tab bar
must be unmistakable.

```tsx
<div style={{
  display: "grid", gridTemplateColumns: "1fr 1fr",  // one column per tab
  background: D.surface, border: `1px solid ${D.border}`,
  borderRadius: 14, padding: 5, gap: 4, marginBottom: 28,
}}>
  {tabs.map(({ id, label }) => (
    <button key={id} onClick={() => setActiveTab(id)} style={{
      padding: "11px 0", fontSize: 13, fontWeight: 600, borderRadius: 10,
      border: "none", cursor: "pointer",
      background: activeTab === id ? D.surfaceHi : "transparent",
      color: activeTab === id ? D.text : D.muted,
      boxShadow: activeTab === id
        ? `0 0 0 1px ${D.border}, 0 2px 8px rgba(0,0,0,0.4)`
        : "none",
    }}>
      {label}
    </button>
  ))}
</div>
```

- Labels include an emoji prefix: `"📊  Spend Analytics"`, `"🧮  Buy vs Ride"`
- Active tab gets `D.surfaceHi` background + inset box-shadow — looks physically raised
- Inactive tab is transparent with `D.muted` text

---

## KPI Scorecards

KPIs are the first thing a user reads. They sit in a horizontal grid, never stacked.

```tsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
  <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "14px 16px" }}>
    <p style={{ fontSize: 10, color: D.muted, margin: "0 0 8px",
                textTransform: "uppercase", letterSpacing: "0.07em" }}>Label</p>
    <p style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: "0 0 3px",
                letterSpacing: "-0.03em" }}>₦157K</p>
    <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>sub-label</p>
  </div>
</div>
```

- Label: `10px`, uppercase, `0.07em` letter-spacing, `D.muted`
- Value: `24px` (standard) or `26px` (hero), `700` weight, tight letter-spacing (`-0.03em`), `D.text`
- Sub-label: `11px`, `D.muted`
- Max 4 KPIs per row

**Coloured scorecards** (used for verdict/comparison states):

```tsx
<div style={{ background: D.accentDim, border: `1px solid ${D.accent}40`, borderRadius: 12, padding: "14px 16px" }}>
  <p style={{ fontSize: 11, color: D.accent, ... }}>Label</p>
  <p style={{ fontSize: 22, fontWeight: 700, color: D.accent, ... }}>Value</p>
  <p style={{ fontSize: 11, color: D.accent, opacity: 0.65, ... }}>Sub</p>
</div>
```

Use the `Dim` background + `40` opacity border + full colour for text — not white.

---

## Verdict / Decision Hero

When a dive answers a binary question (better off / worse off, save / spend),
put the verdict at the **very top of that section**, in a large coloured banner.
Never bury it.

```tsx
<div style={{
  background: uberWins ? D.greenDim : D.redDim,
  border: `1px solid ${uberWins ? D.greenBorder : D.redBorder}`,
  borderRadius: 16, padding: "24px 28px", marginBottom: 20,
}}>
  <p style={{ fontSize: 11, color: verdict, margin: "0 0 6px",
              textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.75 }}>
    Verdict: keep riding
  </p>
  <p style={{ fontSize: 32, fontWeight: 800, color: verdict, margin: "0 0 8px",
              letterSpacing: "-0.035em", lineHeight: 1.1 }}>
    Uber saves you ₦42K/mo
  </p>
  <p style={{ fontSize: 13, color: verdict, margin: 0, opacity: 0.7, lineHeight: 1.5 }}>
    Supporting explanation sentence.
  </p>
</div>
```

- `32px`, `800` weight for the headline number — largest text on the page
- Verdict updates live as the user interacts with inputs/sliders
- `borderRadius: 16` — slightly rounder than regular cards to stand out

---

## Charts

### General rules

- **Always Recharts** — no raw SVG, no d3 for charts
- Remove all chart chrome: `axisLine={false}`, `tickLine={false}`, no visible borders
- Grid lines: `<CartesianGrid strokeDasharray="3 3" stroke={D.borderSub} vertical={false} />`
- Axis ticks: `fontSize={11}`, `tick={{ fill: D.muted }}`
- Tooltip: dark themed (see tooltip style below)
- `width={50}` on YAxis to prevent label clipping

### Chart types by use case

| Use case | Chart type |
|---|---|
| Trend over time | `AreaChart` with gradient fill |
| Category comparison | `BarChart` |
| Distribution / breakdown | Inline progress bars in a list (not a chart) |

### Area chart (time series)

```tsx
<AreaChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%"  stopColor={D.accent} stopOpacity={0.22} />
      <stop offset="95%" stopColor={D.accent} stopOpacity={0} />
    </linearGradient>
  </defs>
  ...
  <Area type="linear" dataKey="value"
    stroke={D.accent} strokeWidth={2}
    fill="url(#grad)" dot={false}
    activeDot={{ r: 4, fill: D.accent, stroke: D.bg, strokeWidth: 2 }} />
</AreaChart>
```

- `type="linear"` — no curves, straight segments between points
- No dots on the line, only `activeDot` on hover
- Gradient fades to opacity 0 at the bottom

### Bar chart

```tsx
<Bar dataKey="trips" fill={D.faint} radius={[4, 4, 0, 0]} />
```

- `radius={[4, 4, 0, 0]}` — rounded top corners only
- Default fill: `D.faint`
- Highlight the peak bar with `D.accent` using `<Cell>`:

```tsx
<Bar dataKey="trips" radius={[4, 4, 0, 0]}>
  {rows.map(r => <Cell key={r.day} fill={r.trips === maxValue ? D.accent : D.faint} />)}
</Bar>
```

### Tooltip

```tsx
const ttStyle = {
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  fontSize: 12,
  color: D.text,
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
};

<Tooltip contentStyle={ttStyle} cursor={{ fill: D.surfaceHi }} />
// For line/area charts: cursor={{ stroke: D.border }}
```

---

## Progress / Comparison Bars

Use inline progress bars instead of a pie chart for breakdowns and comparisons.
They read faster and align well in a list.

```tsx
// Breakdown bar (proportion of a total)
<div style={{ height: 5, background: D.surfaceHi, borderRadius: 3, overflow: "hidden" }}>
  <div style={{
    height: "100%", borderRadius: 3, background: D.accent,
    width: `${(value / maxValue) * 100}%`,
    opacity: 0.6 + 0.4 * (value / maxValue), // darker = larger
  }} />
</div>

// Comparison bar (two things side by side, different colours)
// Uber: D.accent, Car: D.amber
<div style={{ height: 10, background: D.surfaceHi, borderRadius: 5, overflow: "hidden" }}>
  <div style={{ height: "100%", borderRadius: 5, background: D.accent,
                width: `${pct}%`, transition: "width 0.25s" }} />
</div>
```

- Breakdown bars: `height: 5`, `D.accent` fill
- Comparison bars: `height: 10`, colour-coded per series, animated with `transition: "width 0.25s"`

---

## Interactive Inputs: Sliders

For calculator-style inputs where the user is exploring a range of values,
use `<input type="range">` sliders — not number inputs. The value updates
live and the result responds immediately.

Style the native range input via injected CSS (Tailwind can't target pseudo-elements):

```tsx
<style>{`
  input[type=range] {
    -webkit-appearance: none; appearance: none;
    height: 4px; border-radius: 2px;
    background: ${D.faint}; outline: none;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px; height: 16px; border-radius: 50%;
    background: ${D.accent}; cursor: pointer;
    border: 2px solid ${D.bg};
    box-shadow: 0 0 0 1px ${D.accent};
  }
  input[type=range]::-moz-range-thumb {
    width: 16px; height: 16px; border-radius: 50%;
    background: ${D.accent}; cursor: pointer;
    border: 2px solid ${D.bg};
    box-shadow: 0 0 0 1px ${D.accent};
  }
`}</style>
```

Slider row layout — label left, live value right, range endpoints below:

```tsx
<div style={{ marginBottom: 18 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
    <span style={{ fontSize: 12, color: D.muted }}>{label}</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: D.text, letterSpacing: "-0.02em" }}>{display}</span>
      {hint && <span style={{ fontSize: 11, color: D.muted }}>{hint}</span>}
    </div>
  </div>
  <input type="range" min={min} max={max} step={step} value={value}
    onChange={e => onChange(Number(e.target.value))}
    style={{ width: "100%", accentColor: D.accent, cursor: "pointer" }} />
  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
    <span style={{ fontSize: 10, color: D.faint }}>{fmt(min)}</span>
    <span style={{ fontSize: 10, color: D.faint }}>{fmt(max)}</span>
  </div>
</div>
```

---

## Loading Skeletons

Every section has its own skeleton. Never block the whole page on a single loader.

Use an animated shimmer gradient — not a flat grey pulse:

```tsx
<style>{`
  @keyframes shimmer {
    0%   { background-position: 200% 0 }
    100% { background-position: -200% 0 }
  }
`}</style>

const Skel = ({ h, w = "100%" }: { h: number; w?: string | number }) => (
  <div style={{
    height: h, width: w, borderRadius: 6,
    background: `linear-gradient(90deg, ${D.surfaceHi} 25%, ${D.faint} 50%, ${D.surfaceHi} 75%)`,
    backgroundSize: "400% 100%",
    animation: "shimmer 1.6s infinite",
  }} />
);
```

Usage:
```tsx
{query.isLoading ? <Skel h={200} /> : <ResponsiveContainer ...> ... </ResponsiveContainer>}
{query.isLoading ? <Skel h={32} w={80} /> : <p style={{ fontSize: 24, ... }}>{value}</p>}
```

---

## Section labels

All panel/section labels follow the same style — small, uppercase, spaced:

```tsx
<p style={{
  fontSize: 11, fontWeight: 600, color: D.muted, margin: "0 0 14px",
  textTransform: "uppercase", letterSpacing: "0.07em",
}}>
  Section title
</p>
```

Never use a large heading inside a card. The card structure provides hierarchy.

---

## Typography scale

| Role | Size | Weight | Color | Notes |
|---|---|---|---|---|
| Page title | 20px | 700 | `D.text` | `letterSpacing: "-0.025em"` |
| Verdict headline | 32px | 800 | verdict color | `letterSpacing: "-0.035em"` |
| KPI value | 24–26px | 700 | `D.text` | `letterSpacing: "-0.03em"` |
| Slider value | 16px | 700 | `D.text` | `letterSpacing: "-0.02em"` |
| Section label | 11px | 600 | `D.muted` | uppercase, `0.07em` spacing |
| Body / table | 13px | 400 | `D.text` | — |
| Sub-labels | 11–12px | 400 | `D.muted` | — |
| Range endpoints | 10px | 400 | `D.faint` | — |

---

## Tailwind usage

Standard Tailwind utilities work (`grid`, `gap-8`, `font-bold`, etc.).
**Bracket syntax does not work in dives** — the runtime cannot resolve arbitrary values.

| Do | Don't |
|---|---|
| `style={{ color: D.text }}` | `className="text-[#f0f0f4]"` |
| `style={{ background: D.surface }}` | `className="bg-[#16161a]"` |
| `className="grid grid-cols-4 gap-8"` | `className="grid-cols-[1fr_2fr]"` |

Use `style={{}}` for all custom colors, sizes, and spacing values.

---

## Section ordering within a tab

**Analytics tab** — data first, context second:
1. KPI row (immediate numbers)
2. Primary trend chart (time series)
3. Breakdown charts (2-col grid)
4. Detail table / breakdown list

**Decision/calculator tab** — answer first, inputs second:
1. Verdict hero (the answer, always visible)
2. Scorecard row (the key numbers at a glance)
3. Inputs (sliders to explore)
4. Live results (updates as inputs change)

The user should know where they stand before they touch anything.
