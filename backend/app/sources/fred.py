"""FRED API client.

Single public FRED API (no v1/v2). We hit the REST endpoints directly with
httpx so they are trivially mockable with respx in tests. The API key is passed
in by the caller (loaded from env) and never logged.
"""

from __future__ import annotations

from datetime import date

import httpx

from app.models import Observation, RecessionPeriod

FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"

# FRED encodes a missing observation as ".".
_MISSING = {".", "", None}


async def fetch_series(
    series_id: str,
    api_key: str,
    *,
    observation_start: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> list[Observation]:
    """Fetch a FRED series, returning ascending (date, value) observations.

    Missing values (".") are skipped. `observation_start` is an ISO date string.
    """
    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
    }
    if observation_start:
        params["observation_start"] = observation_start

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=30.0)
    try:
        resp = await client.get(FRED_OBSERVATIONS_URL, params=params)
        resp.raise_for_status()
        payload = resp.json()
    finally:
        if owns_client:
            await client.aclose()

    out: list[Observation] = []
    for obs in payload.get("observations", []):
        value = obs.get("value")
        if value in _MISSING:
            continue
        try:
            out.append(
                Observation(date=date.fromisoformat(obs["date"]), value=float(value))
            )
        except (ValueError, KeyError):
            continue
    out.sort(key=lambda o: o.date)
    return out


def observations_to_recessions(observations: list[Observation]) -> list[RecessionPeriod]:
    """Convert the FRED USREC 0/1 monthly series into recession spans for shading.

    USREC is 1 during NBER recession months, 0 otherwise. Consecutive 1-runs are
    collapsed into [start, end] periods.
    """
    periods: list[RecessionPeriod] = []
    run_start: date | None = None
    prev: date | None = None
    for obs in observations:
        if obs.value >= 0.5:  # in recession this month
            if run_start is None:
                run_start = obs.date
            prev = obs.date
        else:
            if run_start is not None and prev is not None:
                periods.append(RecessionPeriod(start=run_start, end=prev))
                run_start = None
    if run_start is not None and prev is not None:
        periods.append(RecessionPeriod(start=run_start, end=prev))
    return periods
