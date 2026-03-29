# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What This Is

A version-controlled MotherDuck Dives repo with GitHub Actions CI/CD.
Each dive is a React TSX component that queries live MotherDuck data.
Dives in this repo analyse Nigerian ride-hailing spend derived from
personal bank transaction email alerts.

---

## Repo Structure

```
.
├── claude_context/          # Domain context — read before building
│   └── ride_hailing.md      # Data shape, filters, edge cases
├── dives/                   # One folder per dive
│   └── <dive-name>/
│       ├── <dive-name>.tsx  # The dive component — source of truth
│       └── dive_metadata.json
├── .dive-preview/           # Local Vite preview scaffold
├── .github/workflows/       # CI/CD — deploy on merge, cleanup on branch delete
├── scripts/
│   └── deploy-dive.sh       # Called by CI to create/update dives
└── Makefile                 # make new-dive, make preview, make setup
```

---

## Context Files

Before doing any work in this repo, read the relevant context files in
`claude_context/`. They describe the data, not the code — read them to
understand what you are querying before writing a single line of SQL.

| File | Read when |
|---|---|
| `claude_context/ride_hailing.md` | Building any ride-hailing dive |

---

## Working With a Dive

### Step 1 — Check dive_metadata.json

Always start by reading `dives/<name>/dive_metadata.json`:

```json
{ "id": "", "title": "...", "description": "..." }
```

- **`id` is populated** → dive exists in MotherDuck. Use `read_dive`
  with that ID to fetch the current source before touching anything.
- **`id` is empty** → new dive. No read needed, write from scratch.

### Step 2 — Write to the correct file

The only file that gets deployed is `dives/<name>/<name>.tsx`.
Always write dive code here. Never create additional `.tsx` files or
write to a temp file.

### Creating a new dive

1. `make new-dive <name>` — scaffolds the folder with `.tsx` and
   `dive_metadata.json`
2. Register in CI — add a filter line to
   `.github/workflows/deploy_dives.yaml`:
   ```yaml
   filters: |
     <name>: dives/<name>/**
   ```
3. `make preview <name>` — start local dev server
4. Build and iterate, then open a PR

The `id` in `dive_metadata.json` starts empty. The deploy script mints
the UUID on first merge to main — no manual step needed.

### Updating an existing dive

1. Read `dive_metadata.json` → get the `id`
2. Call `read_dive` with that `id` to get the current source
3. Edit `dives/<name>/<name>.tsx`
4. `make preview <name>` to verify, then open a PR

---

## Token Handling

Never invent or guess tokens. If a token is needed and not present:
- **Local dev**: ask the user, write to `.dive-preview/.env`
- **CI**: needs `MOTHERDUCK_TOKEN` set as a GitHub Actions secret

For shared or team repos, always recommend a service account token over
a personal token. Dives are owned by the account whose token deploys them.

---

## Local Preview

```bash
make setup              # first time: installs deps, creates .env
make preview <name>     # starts Vite dev server for a specific dive
```

Manual equivalent:
```bash
cd .dive-preview
cp .env.example .env    # paste MotherDuck token
npm install
echo 'export { default } from "../../dives/<name>/<name>";' > src/dive.tsx
npm run dev             # http://localhost:5173
```

---

## Deployment

- **PR opened/updated** → preview dive deployed as
  `"<Title>:<branch> (Preview)"`, link posted as PR comment
- **Merged to main** → live dive created or updated
- **Branch deleted** → preview dive cleaned up automatically

To update which dives CI watches, edit the `filters:` block in
`.github/workflows/deploy_dives.yaml`.

---

## Dive Code Rules

- `REQUIRED_DATABASES` must be a **single line** — CI uses a regex to
  strip it before deploying. Multi-line breaks deployment.
- Always use fully qualified table names: `"database"."schema"."table"`
- Use `const N = (v) => (v != null ? Number(v) : 0);` for safe numeric
  conversion
- Use per-section loading skeletons, not a single full-page loader
- Available libraries: `react`, `recharts`, `lucide-react`,
  `@motherduck/react-sql-query`