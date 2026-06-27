"""Phase B: FRED client (mocked HTTP — no network)."""

from __future__ import annotations

from datetime import date

import respx
from httpx import Response

from app.models import Observation
from app.sources.fred import (
    FRED_OBSERVATIONS_URL,
    fetch_series,
    observations_to_recessions,
)


@respx.mock
async def test_fetch_series_parses_and_skips_missing():
    respx.get(FRED_OBSERVATIONS_URL).mock(
        return_value=Response(
            200,
            json={
                "observations": [
                    {"date": "2020-01-01", "value": "1.5"},
                    {"date": "2020-02-01", "value": "."},  # missing -> skipped
                    {"date": "2020-03-01", "value": "2.0"},
                ]
            },
        )
    )

    obs = await fetch_series("ICSA", "fake-key")

    assert obs == [
        Observation(date=date(2020, 1, 1), value=1.5),
        Observation(date=date(2020, 3, 1), value=2.0),
    ]


@respx.mock
async def test_fetch_series_sorts_ascending():
    respx.get(FRED_OBSERVATIONS_URL).mock(
        return_value=Response(
            200,
            json={
                "observations": [
                    {"date": "2021-05-01", "value": "3"},
                    {"date": "2021-01-01", "value": "1"},
                ]
            },
        )
    )

    obs = await fetch_series("X", "k")
    assert [o.date for o in obs] == [date(2021, 1, 1), date(2021, 5, 1)]


@respx.mock
async def test_fetch_series_passes_observation_start():
    route = respx.get(FRED_OBSERVATIONS_URL).mock(
        return_value=Response(200, json={"observations": []})
    )
    await fetch_series("X", "k", observation_start="1990-01-01")
    assert route.calls.last.request.url.params["observation_start"] == "1990-01-01"


def test_observations_to_recessions_collapses_runs():
    series = [
        Observation(date=date(2000, 1, 1), value=0),
        Observation(date=date(2000, 2, 1), value=1),
        Observation(date=date(2000, 3, 1), value=1),
        Observation(date=date(2000, 4, 1), value=0),
        Observation(date=date(2008, 1, 1), value=1),
    ]
    periods = observations_to_recessions(series)
    assert len(periods) == 2
    assert periods[0].start == date(2000, 2, 1)
    assert periods[0].end == date(2000, 3, 1)
    assert periods[1].start == date(2008, 1, 1)
    assert periods[1].end == date(2008, 1, 1)
