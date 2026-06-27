"""Market sentiment sources.

CNN's Fear & Greed Index has no official API, but its dataviz backend serves a
public JSON document (with a browser User-Agent). We read the historical series
from it. VIX comes from FRED (VIXCLS) via the generic fetcher, so it lives in the
registry rather than here.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.models import Observation

CNN_FEAR_GREED_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def parse_fear_greed(payload: dict) -> list[Observation]:
    """Extract the historical Fear & Greed series from CNN's JSON payload."""
    data = payload.get("fear_and_greed_historical", {}).get("data", [])
    out: list[Observation] = []
    for point in data:
        try:
            ts = float(point["x"]) / 1000.0  # epoch ms -> s
            day = datetime.fromtimestamp(ts, tz=timezone.utc).date()
            out.append(Observation(date=day, value=float(point["y"])))
        except (KeyError, ValueError, TypeError):
            continue
    out.sort(key=lambda o: o.date)
    return out


async def fetch_fear_greed(
    *, client: httpx.AsyncClient | None = None
) -> list[Observation]:
    """Fetch the CNN Fear & Greed Index historical series."""
    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=30.0)
    try:
        resp = await client.get(
            CNN_FEAR_GREED_URL, headers={"User-Agent": _USER_AGENT}
        )
        resp.raise_for_status()
        payload = resp.json()
    finally:
        if owns_client:
            await client.aclose()
    return parse_fear_greed(payload)
