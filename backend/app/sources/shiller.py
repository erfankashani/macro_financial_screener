"""Shiller CAPE (cyclically-adjusted P/E).

Primary source: multpl.com's by-month table (simple HTML, easy to parse and
cache). CAPE is a monthly series, so we cache aggressively. The parsing logic is
isolated from the HTTP fetch so it can be unit-tested with a fixed HTML sample.
"""

from __future__ import annotations

import io
from datetime import date

import httpx
import pandas as pd

MULTPL_CAPE_URL = "https://www.multpl.com/shiller-pe/table/by-month"


def parse_multpl_table(html: str) -> list:
    """Parse a multpl.com by-month HTML table into ascending Observations."""
    from app.models import Observation

    tables = pd.read_html(io.StringIO(html))
    df = tables[0]
    # First two columns are Date and Value regardless of exact header text.
    df = df.iloc[:, :2]
    df.columns = ["date", "value"]

    out: list[Observation] = []
    for _, row in df.iterrows():
        parsed_date = pd.to_datetime(row["date"], errors="coerce")
        value = pd.to_numeric(
            str(row["value"]).replace(",", "").strip(), errors="coerce"
        )
        if pd.isna(parsed_date) or pd.isna(value):
            continue
        out.append(Observation(date=parsed_date.date(), value=float(value)))
    out.sort(key=lambda o: o.date)
    return out


async def fetch_cape(*, client: httpx.AsyncClient | None = None) -> list:
    """Fetch the Shiller CAPE monthly series from multpl.com."""
    owns_client = client is None
    client = client or httpx.AsyncClient(
        timeout=30.0, headers={"User-Agent": "macro-screener/0.1"}
    )
    try:
        resp = await client.get(MULTPL_CAPE_URL)
        resp.raise_for_status()
        html = resp.text
    finally:
        if owns_client:
            await client.aclose()
    return parse_multpl_table(html)
