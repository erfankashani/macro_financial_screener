"""Daily refresh job.

Fetches every metric's series (plus NBER recession spans for shading), scores
them, and writes a single Snapshot to the Store. This is the ONLY component that
talks to the upstream data sources — the API just reads what this writes.

Run it from cron / a scheduled serverless function:

    uv run python -m app.refresh
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

import httpx

from app.config import Settings, get_settings
from app.metrics.registry import REGISTRY, MetricSpec, build_detail
from app.models import MetricDetail, RecessionPeriod, Snapshot
from app.sources.fred import fetch_series, observations_to_recessions
from app.store.base import Store
from app.store.sqlite import SqliteStore

logger = logging.getLogger("refresh")


async def _fetch_recessions(api_key: str, client: httpx.AsyncClient) -> list[RecessionPeriod]:
    try:
        usrec = await fetch_series("USREC", api_key, client=client)
        return observations_to_recessions(usrec)
    except Exception:  # recession shading is non-critical
        logger.exception("Failed to fetch USREC recessions")
        return []


async def _build_one(
    spec: MetricSpec,
    api_key: str,
    client: httpx.AsyncClient,
    recessions: list[RecessionPeriod],
) -> MetricDetail:
    try:
        observations = await spec.fetch(api_key, client)
    except Exception:  # one bad source must not sink the whole snapshot
        logger.exception("Failed to fetch metric %s", spec.id)
        observations = []
    return build_detail(spec, observations, recessions)


async def build_snapshot(
    api_key: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> Snapshot:
    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=60.0)
    try:
        recessions = await _fetch_recessions(api_key, client)
        metrics = await asyncio.gather(
            *(_build_one(spec, api_key, client, recessions) for spec in REGISTRY)
        )
    finally:
        if owns_client:
            await client.aclose()
    return Snapshot(generated_at=date.today(), metrics=list(metrics))


async def refresh(store: Store, settings: Settings | None = None) -> Snapshot:
    settings = settings or get_settings()
    if not settings.fred_api_key_present:
        raise RuntimeError(
            "FRED_API_KEY is not set. Add it to the repo-root .env "
            "(see backend/.env.example)."
        )
    snapshot = await build_snapshot(settings.fred_api_key)
    store.write_snapshot(snapshot)
    logger.info(
        "Wrote snapshot with %d metrics (generated_at=%s)",
        len(snapshot.metrics),
        snapshot.generated_at,
    )
    return snapshot


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    # httpx logs full request URLs at INFO, which include the FRED api_key query
    # param. Silence it so the secret never lands in logs.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    settings = get_settings()
    store = SqliteStore(settings.cache_db_path)
    asyncio.run(refresh(store, settings))


if __name__ == "__main__":
    main()
