"""FastAPI application entrypoint.

Routes read the latest snapshot from the Store. They never call upstream data
sources — that is the daily refresh job's responsibility (app/refresh.py).
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models import MetricDetail, MetricSummary, Snapshot
from app.store.base import Store
from app.store.sqlite import SqliteStore

settings = get_settings()

app = FastAPI(title="Macro Financial Screener API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@lru_cache
def _default_store() -> SqliteStore:
    return SqliteStore(settings.cache_db_path)


def get_store() -> Store:
    """Dependency — overridable in tests."""
    return _default_store()


def _require_snapshot(store: Store) -> Snapshot:
    snapshot = store.read_snapshot()
    if snapshot is None:
        raise HTTPException(
            status_code=503,
            detail="No data yet. Run the refresh job: `uv run python -m app.refresh`.",
        )
    return snapshot


def _to_summary(detail: MetricDetail) -> MetricSummary:
    return MetricSummary(
        id=detail.id,
        name=detail.name,
        unit=detail.unit,
        latest_value=detail.latest_value,
        as_of=detail.as_of,
        status=detail.status,
        meaning=detail.meaning,
        source=detail.source,
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/snapshot", response_model=Snapshot)
def get_snapshot(store: Store = Depends(get_store)) -> Snapshot:
    """Full payload (all metrics + series + recessions) for the one-pager."""
    return _require_snapshot(store)


@app.get("/api/metrics", response_model=list[MetricSummary])
def list_metrics(store: Store = Depends(get_store)) -> list[MetricSummary]:
    """Compact per-metric summaries for the dashboard cards."""
    snapshot = _require_snapshot(store)
    return [_to_summary(m) for m in snapshot.metrics]


@app.get("/api/metrics/{metric_id}", response_model=MetricDetail)
def get_metric(metric_id: str, store: Store = Depends(get_store)) -> MetricDetail:
    """Full detail (series + recessions + context) for one metric."""
    snapshot = _require_snapshot(store)
    for metric in snapshot.metrics:
        if metric.id == metric_id:
            return metric
    raise HTTPException(status_code=404, detail=f"Unknown metric '{metric_id}'.")
