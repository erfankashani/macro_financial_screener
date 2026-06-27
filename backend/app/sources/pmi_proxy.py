"""ISM PMI proxy.

The real ISM Manufacturing PMI is license-restricted and was pulled from FRED.
As a free, FRED-native substitute we build a composite diffusion index from the
regional Federal Reserve manufacturing surveys. Each is a diffusion index roughly
centered on 0 (positive = expansion). We average the available regional readings
per month into a single proxy.

Exact series IDs are verified at refresh time; a series that fails to fetch is
simply skipped so the composite degrades gracefully.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import date

import httpx

from app.models import Observation
from app.sources.fred import fetch_series

# Regional Fed manufacturing "general activity / business conditions" indices.
REGIONAL_FED_SERIES: list[str] = [
    "GACDFSA066MSFRBPHI",  # Philadelphia Fed (current general activity)
    "GACDISA066MSFRBNY",   # New York (Empire State)
    "BACTSAMFRBDAL",       # Dallas Fed (general business activity)
]


def composite_index(series_list: list[list[Observation]]) -> list[Observation]:
    """Average multiple diffusion series by month into one composite.

    For each month present in any input series, average the values available for
    that month. Months with no data are omitted. Result is ascending by date.
    """
    bucket: dict[date, list[float]] = defaultdict(list)
    for series in series_list:
        for obs in series:
            bucket[obs.date].append(obs.value)

    out = [
        Observation(date=d, value=sum(values) / len(values))
        for d, values in bucket.items()
        if values
    ]
    out.sort(key=lambda o: o.date)
    return out


async def fetch_pmi_proxy(
    api_key: str,
    *,
    observation_start: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> list[Observation]:
    """Fetch each regional Fed series and combine into the PMI-proxy composite.

    Individual series failures are tolerated (skipped) so the composite still
    returns from whatever regional data is available.
    """
    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=30.0)
    try:
        async def _safe(series_id: str) -> list[Observation]:
            try:
                return await fetch_series(
                    series_id,
                    api_key,
                    observation_start=observation_start,
                    client=client,
                )
            except Exception:
                return []

        results = await asyncio.gather(
            *(_safe(sid) for sid in REGIONAL_FED_SERIES)
        )
    finally:
        if owns_client:
            await client.aclose()

    return composite_index(list(results))
