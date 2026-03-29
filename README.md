# finpro-dives 🤿

Version-controlled [MotherDuck Dives](https://motherduck.com/docs/key-tasks/ai-and-motherduck/dives/) for analysing Nigerian ride-hailing spend. Built on top of personal bank transaction email data ingested via a [dlt](https://dlthub.com) pipeline.

Dives are interactive React + SQL visualisations that query live MotherDuck data. This repo adds version control, local development with hot reload, PR-based preview deployments, and automated production updates on merge.

---

## What's in here

| Dive | Description |
|---|---|
| `uber-analytics` | Ride-hailing spend analysis — monthly trends, day-of-week patterns, trip size distribution, and an interactive calculator to determine when buying a car makes more financial sense than continuing to use Uber |

---

## How it works

Each dive is a React TSX component that queries MotherDuck directly via the `useSQLQuery` hook. The data is sourced from parsed Nigerian bank transaction emails — cash Uber/Bolt trips are paid via manual bank transfer, which ties ride spend into the broader personal finance tracking system.

The CI/CD pipeline is built on GitHub Actions:

- **PR opened** → preview dive deployed to MotherDuck with a branch-tagged title, link posted as a PR comment
- **Merged to main** → live dive created or updated
- **Branch deleted** → preview dive cleaned up automatically

---

## Prerequisites

- [MotherDuck account](https://app.motherduck.com) — free tier works
- [Node.js 18+](https://nodejs.org)
- MotherDuck API token — get one from Settings → Access Tokens

---

## Getting started

**1. Clone the repo**
```bash
git clone https://github.com/<you>/finpro-dives.git
cd finpro-dives
```

**2. Install dependencies and set up your token**
```bash
make setup
# follow the prompt to paste your MotherDuck token
```

**3. Preview a dive locally**
```bash
make preview uber-analytics
# opens at http://localhost:5173
```

---

## Adding a new dive

```bash
# scaffold the folder
make new-dive <name>

# register it in CI
# add a line to .github/workflows/deploy_dives.yaml:
# <name>: dives/<name>/**

# preview locally
make preview <name>

# build, commit, open a PR
```

New dives start with an empty `id` in `dive_metadata.json`. The deploy
script mints the UUID on first merge to main — no manual step required.

---

## Data context

Before building or modifying any dive, read
[`claude_context/ride_hailing.md`](./claude_context/ride_hailing.md).
It explains the data shape, the sibling row problem, timestamp parsing,
and what can and cannot be inferred from the data.

---

## CI/CD setup

Add a `MOTHERDUCK_TOKEN` secret to your GitHub repo (Settings → Secrets
and variables → Actions). A service account token is recommended for shared
repos so dives aren't tied to a personal account.

---

## Stack

- [MotherDuck](https://motherduck.com) — cloud DuckDB, dive runtime
- [dlt](https://dlthub.com) — email ingestion pipeline
- [Vite](https://vitejs.dev) + [React](https://react.dev) — local preview
- [Recharts](https://recharts.org) — charting
- [GitHub Actions](https://github.com/features/actions) — CI/CD

---

## Related

- [Managing Dives as Code](https://motherduck.com/docs/key-tasks/ai-and-motherduck/managing-dives-as-code/) — MotherDuck docs
- [blessed-dives-example](https://github.com/motherduckdb/blessed-dives-example) — the upstream repo this workflow is based on