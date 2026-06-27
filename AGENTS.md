# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A macro financial dashboard — a morning one-pager showing color-coded recession / stress / valuation signals. The data comes from FRED and multpl.com (Shiller CAPE), refreshed once daily into a local cache. The UI reads only that cache; no live upstream calls happen on page load.

---

## Architecture

```
app.refresh  ──fetch──►  FRED API / multpl.com
     │  (runs once a day, writes one Snapshot)
     ▼
 Store (cache.db)  ◄──read──  FastAPI  ◄──HTTP──  Next.js one-pager
```

**The strict contract:** `app/refresh.py` is the only code that calls external data sources. `app/main.py` (the API) only reads whatever the refresh job last wrote. This is intentional — never add upstream HTTP calls to the API layer.

The `Store` is a two-method Protocol (`store/base.py`): `write_snapshot` and `read_snapshot`. The local impl is `SqliteStore`. To deploy to production, implement a new `Store` (e.g. `S3Store`) and wire it in `main.py` and `refresh.py`.

### Adding a new metric

1. Add a `MetricSpec` to `REGISTRY` in `backend/app/metrics/registry.py` — this is the single source of truth for every metric: its ID, fetch function, status thresholds, meaning text, and chart overlay.
2. Add a fetch function in `backend/app/sources/` (or reuse `fetch_series` for a plain FRED series).
3. Add the metric's ID to the appropriate group (`TIMING_IDS`, `SENTIMENT_IDS`, or `VALUATION_IDS`) in `frontend/lib/format.ts`.
4. Add tests in `backend/tests/`.

---

## Backend

**Stack:** Python 3.12, FastAPI, `uv` for dependency management, `httpx` for async HTTP, Pydantic v2 for models, SQLite for local storage.

**Key files:**
- `backend/app/models.py` — Pydantic schemas shared by everything: `Observation`, `MetricDetail`, `MetricSummary`, `Snapshot`, `Status`
- `backend/app/metrics/registry.py` — `REGISTRY` list of `MetricSpec` dataclasses; `build_detail()` assembles a `MetricDetail` from a spec + raw observations
- `backend/app/metrics/status.py` — pure functions for scoring (`band_status`, `claims_trend_status`) and downsampling series for the chart payload
- `backend/app/sources/` — one module per data source: `fred.py` (FRED REST API), `pmi_proxy.py` (regional Fed surveys composite), `sentiment.py` (CNN Fear & Greed unofficial JSON), `shiller.py` (multpl.com scrape)
- `backend/app/store/` — `base.py` (Protocol), `sqlite.py` (reference impl)
- `backend/app/config.py` — `Settings` via pydantic-settings; reads `FRED_API_KEY` from repo-root `.env`

**Dev commands (run from `backend/`):**
```bash
uv sync                                              # install deps
uv run uvicorn app.main:app --reload --port 8000     # start API
uv run python -m app.refresh                         # populate cache (needs FRED_API_KEY)
uv run pytest                                        # full test suite
uv run pytest tests/test_registry.py                # single test file
uv run pytest -k test_name                          # single test by name
```

**API endpoints:**
- `GET /api/health` — liveness check
- `GET /api/snapshot` — full payload (all metrics + series + recessions)
- `GET /api/metrics` — compact summaries for dashboard cards
- `GET /api/metrics/{id}` — full detail for one metric

---

## Frontend

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts v3.

> **Warning:** This Next.js version has breaking changes from earlier releases. Read `node_modules/next/dist/docs/` before writing Next.js-specific code — do not rely on training data about Next.js conventions.

**Key files:**
- `frontend/app/page.tsx` — client component; fetches snapshot on mount, groups metrics by section (timing / sentiment / valuation), renders cards
- `frontend/lib/types.ts` — TypeScript mirror of the backend Pydantic models
- `frontend/lib/api.ts` — `getSnapshot()` fetch wrapper (reads `NEXT_PUBLIC_API_BASE`)
- `frontend/lib/format.ts` — `TIMING_IDS`, `SENTIMENT_IDS`, `VALUATION_IDS` arrays that control card ordering per section
- `frontend/components/MetricCard.tsx` — expandable card with status badge + chart
- `frontend/components/MetricChart.tsx` — Recharts line chart with recession shading and threshold lines

**Dev commands (run from `frontend/`):**
```bash
conda activate NodeEnv    # activate Node environment (has Node + npm)
npm install
npm run dev               # http://localhost:3000
npm run build             # production build (also type-checks)
```

Environment: `frontend/.env.local` sets `NEXT_PUBLIC_API_BASE=http://localhost:8000`.

---

## Testing

The backend is built test-first. **All HTTP is mocked** — tests never make real network calls (uses `respx` to mock `httpx`).

```bash
cd backend
uv run pytest                          # full suite
uv run pytest tests/test_registry.py  # single file
uv run pytest -k "test_sahm"          # match by name
```

**Test anatomy:**
- `tests/conftest.py` — shared `client` fixture: an `httpx.AsyncClient` wired directly to the FastAPI ASGI app (no real network)
- Tests inject a fake `Store` via FastAPI's dependency override on `get_store`
- `asyncio_mode = "auto"` is set in `pyproject.toml` — async test functions work without decoration

There are no frontend tests. `npm run build` is the only frontend static check (TypeScript type errors surface there).

---

## Environment & secrets

- `FRED_API_KEY` — required only for `app.refresh`, not the API server. Set in repo-root `.env` (gitignored). Never read this file into context or log its value.
- `FRONTEND_ORIGIN` — backend CORS allowed origin (default: `http://localhost:3000`)
- `NEXT_PUBLIC_API_BASE` — frontend API base URL (set in `frontend/.env.local`)
- `cache_db_path` — defaults to `backend/data/cache.db`; the API server boots and serves without a FRED key as long as `cache.db` is populated.

---

## Deployment

Build both Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`). For production, implement a `Store` backed by durable storage (S3/R2 or Postgres) and wire it into `get_store()` in `main.py` and `refresh()` in `refresh.py`. Run `python -m app.refresh` as a scheduled job (cron, GitHub Action, cloud scheduler) once daily — FRED allows ~120 requests/min and one refresh makes ~12 calls.
