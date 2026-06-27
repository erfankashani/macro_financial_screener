"""Downsampling keeps endpoints and respects the cap."""

from __future__ import annotations

from datetime import date, timedelta

from app.metrics.status import downsample, downsample_recent_dense
from app.models import Observation


def _series(n: int) -> list[Observation]:
    base = date(2000, 1, 1)
    return [Observation(date=base + timedelta(days=i), value=float(i)) for i in range(n)]


def test_short_series_unchanged():
    s = _series(10)
    assert downsample(s, 800) == s


def test_long_series_capped_and_keeps_endpoints():
    s = _series(12505)
    out = downsample(s, 800)
    assert len(out) <= 800
    assert out[0] == s[0]
    assert out[-1] == s[-1]  # latest reading preserved


def test_recent_dense_keeps_recent_at_full_resolution():
    s = _series(9000)
    out = downsample_recent_dense(s, max_points=1000, recent_keep=520)
    assert len(out) <= 1000
    assert out[0] == s[0]  # oldest kept
    assert out[-1] == s[-1]  # latest kept
    # The most recent 520 points are present consecutively (day-by-day detail).
    assert out[-520:] == s[-520:]


def test_recent_dense_noop_when_short():
    s = _series(300)
    assert downsample_recent_dense(s, 1000, 520) == s
