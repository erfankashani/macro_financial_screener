"""Phase C: pure status/computation helpers (boundary-focused)."""

from __future__ import annotations

from datetime import date

import pytest

from app.metrics.status import (
    band_status,
    buffett_ratio,
    claims_trend_status,
)
from app.models import Observation, Status


@pytest.mark.parametrize(
    "value,expected",
    [
        (0.20, Status.GREEN),   # below amber
        (0.34, Status.GREEN),   # just under amber boundary
        (0.35, Status.AMBER),   # amber boundary
        (0.49, Status.AMBER),   # in amber band
        (0.50, Status.RED),     # red boundary
        (0.80, Status.RED),
        (None, Status.UNKNOWN),
    ],
)
def test_band_status_high_is_worse(value, expected):
    assert band_status(value, amber=0.35, red=0.50, worse="high") == expected


@pytest.mark.parametrize(
    "value,expected",
    [
        (0.50, Status.GREEN),   # above amber -> fine
        (0.25, Status.AMBER),   # amber boundary
        (0.00, Status.RED),     # inverted boundary
        (-0.40, Status.RED),
    ],
)
def test_band_status_low_is_worse(value, expected):
    assert band_status(value, amber=0.25, red=0.0, worse="low") == expected


def _weekly(values: list[float]) -> list[Observation]:
    return [Observation(date=date(2024, 1, 1 + i), value=v) for i, v in enumerate(values)]


def test_claims_trend_flat_is_green():
    obs = _weekly([220_000] * 10)
    assert claims_trend_status(obs) == Status.GREEN


def test_claims_trend_sharp_rise_is_red():
    # low ~200k then ramp to ~260k (>15% off the low)
    obs = _weekly([200_000] * 6 + [240_000, 255_000, 260_000, 265_000])
    assert claims_trend_status(obs) == Status.RED


def test_claims_trend_insufficient_data_unknown():
    assert claims_trend_status(_weekly([200_000, 201_000])) == Status.UNKNOWN


def test_buffett_ratio_forward_fills_gdp():
    wilshire = [
        Observation(date=date(2024, 2, 15), value=200.0),
        Observation(date=date(2024, 5, 15), value=240.0),
    ]
    gdp = [
        Observation(date=date(2024, 1, 1), value=100.0),
        Observation(date=date(2024, 4, 1), value=120.0),
    ]
    out = buffett_ratio(wilshire, gdp)
    assert out[0] == Observation(date=date(2024, 2, 15), value=200.0)  # 200/100*100
    assert out[1] == Observation(date=date(2024, 5, 15), value=200.0)  # 240/120*100


def test_buffett_ratio_empty_inputs():
    assert buffett_ratio([], []) == []
