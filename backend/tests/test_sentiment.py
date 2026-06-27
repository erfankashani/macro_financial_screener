"""Fear & Greed parsing + VIX / Fear-Greed status bands."""

from __future__ import annotations

from datetime import date

import pytest

from app.metrics.registry import _fear_greed_status, _vix_status
from app.models import Observation, Status
from app.sources.sentiment import parse_fear_greed


def test_parse_fear_greed_from_payload():
    payload = {
        "fear_and_greed_historical": {
            "data": [
                {"x": 1781308796000, "y": 34.0, "rating": "fear"},
                {"x": 1750032000000, "y": 61.1, "rating": "greed"},
                {"x": "bad", "y": "oops"},  # skipped
            ]
        }
    }
    obs = parse_fear_greed(payload)
    assert len(obs) == 2
    # sorted ascending by date
    assert obs[0].date < obs[1].date
    assert obs[-1].value == 34.0


def _o(v: float) -> list[Observation]:
    return [Observation(date=date(2026, 6, 10), value=v)]


@pytest.mark.parametrize(
    "v,expected",
    [(12, Status.GREEN), (19.9, Status.GREEN), (20, Status.AMBER), (30, Status.RED)],
)
def test_vix_status(v, expected):
    assert _vix_status(_o(v)) == expected


@pytest.mark.parametrize(
    "v,expected",
    [
        (50, Status.GREEN),   # neutral
        (40, Status.AMBER),   # fear
        (60, Status.AMBER),   # greed
        (20, Status.RED),     # extreme fear
        (80, Status.RED),     # extreme greed
    ],
)
def test_fear_greed_status(v, expected):
    assert _fear_greed_status(_o(v)) == expected
