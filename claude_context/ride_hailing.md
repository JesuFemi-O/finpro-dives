# Nigerian Ride-Hailing Spend Context

Context for analysing Nigerian ride-hailing spend data sourced from bank
transaction email alerts. Read this before building any ride-hailing related
analysis in this repo.

---

## Data source

```
finpro.txn_raw.bank_emails
```

Data is ingested via a dlt pipeline that connects to a personal email inbox,
parses bank notification emails, and extracts structured fields from credit
and debit alerts. The pipeline captures the transaction narrative, amount,
timestamp, and type directly from email content.

The data is **not modelled**. There are no pre-built aggregations, no clean
transactions table, and no guaranteed deduplication. An agent working with
this data is expected to carefully profile the raw rows, identify patterns
in the narrative field, and reason about what constitutes a valid transaction
before writing any analysis.

---

## How ride payments work in Nigeria

Uber and Bolt support three payment methods in Nigeria:

1. **In-app wallet** — pre-credited by the rider, payment is automatic
2. **Debit card** — charged directly at end of trip
3. **Cash** — rider makes a manual bank transfer to the driver at the end
   of the trip

Many Nigerian riders prefer cash trips. For the data in this repo, rides are
paid via **manual bank transfer** — the rider initiates a transfer to the
driver after the trip and includes `Uber` or `Bolt` in the transaction
narration. This approach is deliberate: it ties ride spend directly into the
personal finance tracking system alongside all other transactions, making it
possible to analyse ride-hailing as part of a broader spend picture.

The implication for analysis: there is no Uber/Bolt API data here. Everything
known about a trip comes from what the rider chose to write in the transfer
narration — typically the platform name, driver name, and a reference number.

---

## The sibling row problem

A single bank transfer generates multiple rows sharing the same reference
number. When multiple rows share a reference, the pattern is typically one
real transaction accompanied by bank-imposed or government-imposed fees.

For ride payments specifically:

| Row type | Narrative prefix | What it is |
|---|---|---|
| ✅ Real trip | `OUTWARD TRANSFER ... Uber/ref` | Actual fare paid to driver |
| ❌ Bank fee | `COMMISSION ... Uber/ref` | ₦10–₦25 bank processing charge |
| ❌ Govt levy | `STAMP DUTY ... Uber/ref` | ₦50 government stamp duty |

**Filter to isolate real spend:**
```sql
parsed_transaction__txn_type = 'debit'
AND parsed_transaction__narrative NOT ILIKE 'COMMISSION%'
AND parsed_transaction__narrative NOT ILIKE 'STAMP DUTY%'
AND parsed_transaction__narrative NOT ILIKE 'NIP OUTWARD STAMP DUTY%'
AND (
  parsed_transaction__narrative ILIKE '%uber%'
  OR parsed_transaction__narrative ILIKE '%bolt%'
)
```

Without this filter, trip counts are tripled and spend totals include fees.

---

## Bulk reimbursement transfers

Not every row matching the ride filter is a single trip. A large transfer
with `refund` or `refunds` in the narrative is a bulk settlement — multiple
trips paid in one transfer on behalf of someone else. These are identifiable
by an amount far outside the typical per-trip range and explicit refund
language in the narrative.

For per-trip analysis, additionally exclude:
```sql
AND parsed_transaction__narrative NOT ILIKE '%refund%'
```

For total spend analysis, decide explicitly whether to include or exclude
bulk settlements — they are material to totals and the decision should be
surfaced, not hidden.

---

## Timestamp parsing

Timestamps are stored as strings in this format:
```
'Sun, Mar 22, 2026 at 8:46 PM'
```

Always parse with:
```sql
strptime(parsed_transaction__timestamp, '%a, %b %d, %Y at %I:%M %p')
```

---

## Bolt vs Uber

Bolt has approximately 2 trips versus ~119 Uber trips in this dataset.
They should not be treated as comparable. Combine them as "ride-hailing"
for aggregate totals, but be transparent about the split when it's relevant.

---

## Trip size intuition

Nigerian ride fares vary by distance, time of day, and surge pricing.
A rough mental model for Lagos and Abuja:

| Range | Trip type |
|---|---|
| < ₦5K | Short local hop |
| ₦5K–15K | Typical city trip |
| ₦15K–30K | Cross-city or airport area |
| > ₦30K | Long distance or surge |

---

## Currency

All amounts are Nigerian Naira (₦). Format values as:
- `₦2,800` for small amounts
- `₦15K` for thousands
- `₦1.8M` for millions

---

## What this data cannot tell you

Do not attempt to infer what the data does not contain:
- Trip distance or duration
- Pickup or dropoff location
- Whether pricing was surge or base fare
- Driver ratings or trip completion status
- Any data from the Uber or Bolt platforms directly