# Macro Financial Screener

A one-pager you open each morning to get a few-minutes read on macro risk:
recession onset, credit stress, the labor market, the business cycle, and
long-run valuation — as color-coded numbers and recession-shaded charts.

- **Frontend:** Next.js (App Router, TypeScript, Tailwind) + Recharts
- **Backend:** FastAPI + Python 3.12 (managed with `uv`), built test-first
- **Data:** FRED + Shiller CAPE (multpl.com), refreshed once a day into a cache

> Educational use only — not investment advice.

---

## The indicators

| Card | Signal | Source | Status rule |
|---|---|---|---|
| Initial Jobless Claims | Timely labor read | FRED `ICSA` | Rising off the cycle low |
| Sahm Rule | Real-time recession onset | FRED `SAHMREALTIME` | ≥ 0.50 = recession |
| High-Yield Credit Spread | Market-priced default risk | FRED `BAMLH0A0HYM2` | >550 / >800 bps |
| Yield Curve (10y–2y) | Late-cycle warning | FRED `T10Y2Y` | Inverted (<0) |
| Manufacturing PMI (proxy) | Business cycle | FRED regional Fed surveys | <0 = contraction |
| Fear & Greed Index | Market sentiment | CNN Business (unofficial JSON) | <25 fear / >75 greed |
| Market Volatility (VIX) | Volatility / fear gauge | FRED `VIXCLS` (+ 50-day avg) | >20 / >30 |
| Buffett Indicator | Long-run valuation | FRED `NCBEILQ027S` / `GDP` | >150% / >200% |
| Shiller CAPE | Long-run valuation | multpl.com | >30 / >35 |
| Recession shading | Context bands | FRED `USREC` | — |

Cards are grouped into **timing** signals (drive the top risk banner),
**market sentiment & volatility** (Fear & Greed + VIX), and **valuation** gauges
(long-run return outlook, not market timing). The CNN Fear & Greed Index has no
official API; we read its public dataviz JSON endpoint (with a browser User-Agent).

**Known data limits:** real ISM PMI and the Wilshire 5000 are license-restricted
and no longer free on FRED, so we use a regional-Fed PMI proxy and a corporate-
equities/GDP Buffett approximation. FRED also redistributes only the trailing
~3 years of the ICE-licensed HY OAS series, so that chart shows recent levels
(the 2008/2020 blowouts are described in the card's "Why this matters" text).

---

## Architecture

```
daily refresh job  ──fetch──►  FRED / multpl
       │  (writes once a day)
       ▼
   Store (cache)  ◄──read──  FastAPI  ◄──HTTP──  Next.js one-pager
```

The API **never** calls upstream sources on a user request — it only reads the
last snapshot the refresh job wrote. This keeps page loads fast, dodges rate
limits, and survives source outages. Storage is behind a `Store` interface
(`backend/app/store/base.py`): SQLite locally, swappable for object storage or
Postgres in production.

---

## Quickstart (local)

### 1. API key
Get a free FRED key: https://fredaccount.stlouisfed.org/apikeys
Put it in the repo-root `.env` (gitignored):

```
FRED_API_KEY=your_key_here
```

### 2. Backend (Python 3.12 + uv)

```bash
cd backend
uv sync
uv run pytest                  # run the test suite
uv run python -m app.refresh   # populate the cache (needs FRED_API_KEY)
uv run uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000` — `/api/health`, `/api/snapshot`,
`/api/metrics`, `/api/metrics/{id}`.

### 3. Frontend (Next.js, conda NodeEnv)

```bash
conda activate NodeEnv          # has Node + npm
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

`frontend/.env.local` sets `NEXT_PUBLIC_API_BASE=http://localhost:8000`.

> This repo's `scripts/run-frontend.sh` launches the dev server with the NodeEnv
> toolchain on a fixed port (used by the editor preview).

---

## Daily refresh

The cache only needs updating once a day (most series are daily-or-slower).

**Local cron example** (8:00am):
```
0 8 * * *  cd /path/to/backend && uv run python -m app.refresh
```

**Serverless / container:** run `python -m app.refresh` as a scheduled job
(cron container, GitHub Action, cloud scheduler → function). Point the `Store`
at durable storage (S3/R2 or Postgres) so the API instances read a shared cache.

FRED allows ~120 requests/min; one refresh makes ~12 calls, so rate limits are a
non-issue.

---

## Deployment notes (serverless lite container)

- **Don't** fetch live per request and **don't** stand up a heavy DB. Historical
  data is static; only the latest point changes daily. Refresh once → serve cache.
- Build the two images (`backend/Dockerfile`, `frontend/Dockerfile`).
- Implement a `Store` for your prod backend (e.g. `S3Store` writing/reading a
  single JSON blob) and wire it in `app/main.py` (`get_store`) and `app/refresh.py`.
  The SQLite impl is the reference; the interface is two methods.
- Set `FRONTEND_ORIGIN` (backend CORS) and `NEXT_PUBLIC_API_BASE` (frontend) for
  your deployed URLs.

---

## Tests

Backend is built test-first; all HTTP is mocked (no network in tests):

```bash
cd backend && uv run pytest
```
