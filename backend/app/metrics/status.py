"""Pure status/computation helpers shared by metric specs.

Kept separate from the registry so they can be unit-tested in isolation with
table-driven cases (boundary values matter).
"""

from __future__ import annotations

from datetime import date

from app.models import Observation, Status


def latest_value(observations: list[Observation]) -> float | None:
    return observations[-1].value if observations else None


def downsample(observations: list[Observation], max_points: int) -> list[Observation]:
    """Reduce a long series for charting while preserving shape and endpoints.

    Strides through the series so at most `max_points` remain, and always keeps
    the first and last observation (the latest reading must never be dropped).
    Status/latest are computed from the full series elsewhere — this only thins
    the data sent to the chart.
    """
    n = len(observations)
    if n <= max_points or max_points < 2:
        return list(observations)
    step = (n - 1) / (max_points - 1)
    idx = sorted({int(round(i * step)) for i in range(max_points)} | {0, n - 1})
    return [observations[i] for i in idx]


def band_status(
    value: float | None,
    *,
    amber: float,
    red: float,
    worse: str = "high",
) -> Status:
    """Three-band traffic light.

    worse="high": larger value is worse (red >= red threshold).
    worse="low":  smaller value is worse (red <= red threshold).
    """
    if value is None:
        return Status.UNKNOWN
    if worse == "high":
        if value >= red:
            return Status.RED
        if value >= amber:
            return Status.AMBER
        return Status.GREEN
    # worse == "low"
    if value <= red:
        return Status.RED
    if value <= amber:
        return Status.AMBER
    return Status.GREEN


def claims_trend_status(
    observations: list[Observation],
    *,
    window: int = 4,
    lookback: int = 26,
    amber_pct: float = 0.075,
    red_pct: float = 0.15,
) -> Status:
    """Initial jobless claims warn via a *rising* trend, not an absolute level.

    Compare the latest `window`-week average to the lowest `window`-week average
    over the trailing `lookback` weeks. A meaningful rise off the cycle low is
    the warning sign.
    """
    if len(observations) < window + 1:
        return Status.UNKNOWN

    values = [o.value for o in observations]

    def avg(end: int) -> float:
        seg = values[max(0, end - window) : end]
        return sum(seg) / len(seg)

    recent_avg = avg(len(values))
    start = max(window, len(values) - lookback)
    trailing_low = min(avg(end) for end in range(start, len(values) + 1))
    if trailing_low <= 0:
        return Status.UNKNOWN

    rise = (recent_avg - trailing_low) / trailing_low
    if rise >= red_pct:
        return Status.RED
    if rise >= amber_pct:
        return Status.AMBER
    return Status.GREEN


def downsample_recent_dense(
    observations: list[Observation],
    max_points: int,
    recent_keep: int,
) -> list[Observation]:
    """Downsample but keep the most recent `recent_keep` points at full resolution.

    For fast-moving daily series (VIX, Fear & Greed) this preserves day-by-day
    detail for short-window views (1W/1M) while still thinning older history so a
    MAX view stays light.
    """
    n = len(observations)
    if n <= max_points:
        return list(observations)
    recent_keep = min(recent_keep, max_points)
    recent = observations[n - recent_keep :]
    older = observations[: n - recent_keep]
    budget = max_points - len(recent)
    if budget < 2 or not older:
        return recent
    return downsample(older, budget) + recent


def moving_average(observations: list[Observation], window: int) -> list[Observation]:
    """Trailing simple moving average. Dated at the window's last point.

    Returns fewer points than the input (the first window-1 have no full window).
    """
    if window < 1 or len(observations) < window:
        return []
    out: list[Observation] = []
    running = 0.0
    for i, obs in enumerate(observations):
        running += obs.value
        if i >= window:
            running -= observations[i - window].value
        if i >= window - 1:
            out.append(Observation(date=obs.date, value=running / window))
    return out


def buffett_ratio(
    wilshire: list[Observation],
    gdp: list[Observation],
) -> list[Observation]:
    """Approximate Buffett Indicator = 100 * Wilshire 5000 / GDP.

    GDP is quarterly; it is forward-filled onto each (daily) Wilshire date using
    the most recent GDP value on or before that date. The result is an
    approximation of total-market-cap / GDP expressed as a percent.
    """
    if not wilshire or not gdp:
        return []

    gdp_sorted = sorted(gdp, key=lambda o: o.date)
    out: list[Observation] = []
    gi = 0
    current: float | None = None
    for w in sorted(wilshire, key=lambda o: o.date):
        while gi < len(gdp_sorted) and gdp_sorted[gi].date <= w.date:
            current = gdp_sorted[gi].value
            gi += 1
        if current and current > 0:
            out.append(Observation(date=w.date, value=100.0 * w.value / current))
    return out
