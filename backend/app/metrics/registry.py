"""Central registry of macro metrics.

Each MetricSpec binds together: how to fetch the series, how to score it
(traffic-light status), a one-line "what it's telling you now" meaning, the
danger thresholds (for chart lines), and a static historical-context blurb
(how it behaved in past recessions/bubbles). The rest of the app stays dumb and
just iterates this registry.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx

from app.metrics.status import (
    band_status,
    buffett_ratio,
    claims_trend_status,
    downsample,
    downsample_recent_dense,
    latest_value,
    moving_average,
)

# Max points per metric sent to the chart (status/latest use full resolution).
CHART_MAX_POINTS = 800
# Fast daily metrics keep recent days at full resolution for 1W/1M views.
FAST_CHART_MAX_POINTS = 1000
FAST_RECENT_KEEP = 520  # ~2 years of trading days kept day-by-day
from app.models import MetricDetail, Observation, RecessionPeriod, Status
from app.sources.fred import fetch_series
from app.sources.pmi_proxy import fetch_pmi_proxy
from app.sources.sentiment import fetch_fear_greed
from app.sources.shiller import fetch_cape

FetchFn = Callable[[str, httpx.AsyncClient], Awaitable[list[Observation]]]
StatusFn = Callable[[list[Observation]], Status]
MeaningFn = Callable[[list[Observation], Status], str]


OverlayFn = Callable[[list[Observation]], list[Observation]]


@dataclass(frozen=True)
class MetricSpec:
    id: str
    name: str
    unit: str
    source: str
    thresholds: dict[str, float]
    history_context: str
    fetch: FetchFn
    status_fn: StatusFn
    meaning_fn: MeaningFn
    # Optional secondary line derived from the fetched series (e.g. a moving avg).
    overlay_fn: OverlayFn | None = None
    overlay_label: str | None = None
    # Fast daily metric → keep recent points dense for short-window (1W/1M) views.
    fast: bool = False


# --------------------------------------------------------------------------- #
# Fetch bindings
# --------------------------------------------------------------------------- #
async def _fetch_buffett(api_key: str, client: httpx.AsyncClient) -> list[Observation]:
    # NCBEILQ027S = nonfinancial corporate equities market value, in $millions
    # (Wilshire 5000 is no longer free on FRED). Convert to $billions to match GDP.
    equities = await fetch_series("NCBEILQ027S", api_key, client=client)
    gdp = await fetch_series("GDP", api_key, client=client)
    equities_billions = [Observation(date=o.date, value=o.value / 1000.0) for o in equities]
    return buffett_ratio(equities_billions, gdp)


# --------------------------------------------------------------------------- #
# Status functions (closures over band_status with calibrated thresholds)
# --------------------------------------------------------------------------- #
def _sahm_status(obs: list[Observation]) -> Status:
    return band_status(latest_value(obs), amber=0.35, red=0.50, worse="high")


def _hy_status(obs: list[Observation]) -> Status:
    # FRED reports HY OAS in percent (e.g. 3.5 == 350 bps).
    return band_status(latest_value(obs), amber=5.5, red=8.0, worse="high")


def _curve_status(obs: list[Observation]) -> Status:
    # Percent spread; inverted (<0) is the warning, flat (<0.25) is amber.
    return band_status(latest_value(obs), amber=0.25, red=0.0, worse="low")


def _pmi_status(obs: list[Observation]) -> Status:
    # Diffusion composite centered near 0; below 0 == contraction proxy.
    return band_status(latest_value(obs), amber=0.0, red=-5.0, worse="low")


def _buffett_status(obs: list[Observation]) -> Status:
    return band_status(latest_value(obs), amber=150.0, red=200.0, worse="high")


def _cape_status(obs: list[Observation]) -> Status:
    return band_status(latest_value(obs), amber=30.0, red=35.0, worse="high")


def _vix_status(obs: list[Observation]) -> Status:
    return band_status(latest_value(obs), amber=20.0, red=30.0, worse="high")


def _fear_greed_status(obs: list[Observation]) -> Status:
    # Extreme readings in EITHER direction flag attention (reversals cluster there).
    v = latest_value(obs)
    if v is None:
        return Status.UNKNOWN
    if v <= 25 or v >= 75:
        return Status.RED
    if v < 45 or v > 55:
        return Status.AMBER
    return Status.GREEN


def _fear_greed_rating(v: float) -> str:
    if v < 25:
        return "Extreme Fear"
    if v < 45:
        return "Fear"
    if v <= 55:
        return "Neutral"
    if v < 75:
        return "Greed"
    return "Extreme Greed"


# --------------------------------------------------------------------------- #
# Meaning (one-liners)
# --------------------------------------------------------------------------- #
def _fmt(v: float | None, suffix: str = "") -> str:
    return "n/a" if v is None else f"{v:.2f}{suffix}"


def _claims_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    base = f"Latest weekly initial claims: {int(v):,}." if v is not None else "No data."
    tail = {
        Status.GREEN: " Claims are near their cycle low — labor market steady.",
        Status.AMBER: " Claims are drifting up off the cycle low — watch the trend.",
        Status.RED: " Claims are rising sharply off the low — a classic early stress sign.",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


def _sahm_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    base = f"Sahm Rule indicator: {_fmt(v)}."
    tail = {
        Status.GREEN: " Well below the 0.50 recession trigger.",
        Status.AMBER: " Creeping toward the 0.50 trigger — early caution.",
        Status.RED: " At/above 0.50 — historically signals a recession has begun.",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


def _hy_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    bps = f"{v * 100:.0f} bps" if v is not None else "n/a"
    base = f"High-yield OAS: {bps}."
    tail = {
        Status.GREEN: " Credit markets calm — little default fear priced in.",
        Status.AMBER: " Spreads widening — credit stress building.",
        Status.RED: " Spreads blown out — markets pricing serious default risk.",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


def _curve_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    base = f"10y–2y spread: {_fmt(v, '%')}."
    tail = {
        Status.GREEN: " Positively sloped — normal expansion shape.",
        Status.AMBER: " Flat — late-cycle warning (use with other signals).",
        Status.RED: " Inverted — historically precedes recessions (but gave a false signal in 2023–24).",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


def _pmi_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    base = f"Regional-Fed manufacturing composite (ISM proxy): {_fmt(v)}."
    tail = {
        Status.GREEN: " Above zero — factory activity expanding.",
        Status.AMBER: " Around/below zero — manufacturing softening.",
        Status.RED: " Deeply negative — manufacturing contracting.",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


def _buffett_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    base = f"Buffett Indicator (approx market-cap/GDP): {_fmt(v, '%')}."
    tail = {
        Status.GREEN: " Valuations reasonable vs the economy.",
        Status.AMBER: " Richly valued — below-average long-run returns likely.",
        Status.RED: " Extremely rich — historically poor 10y-forward returns.",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


def _vix_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    base = f"VIX: {_fmt(v)}."
    tail = {
        Status.GREEN: " Below ~20 — calm, low expected volatility (a risk-on, bullish backdrop).",
        Status.AMBER: " 20–30 — volatility rising, the market is on edge.",
        Status.RED: " Above 30 — fear/panic; major selloffs spike past 40 (2008 ~80, 2020 ~82).",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


def _fear_greed_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    if v is None:
        return "No data."
    return (
        f"CNN Fear & Greed Index: {v:.0f} ({_fear_greed_rating(v)}). It's a "
        "contrarian sentiment gauge — extreme fear has often marked market bottoms, "
        "extreme greed has often preceded pullbacks."
    )


def _cape_meaning(obs: list[Observation], status: Status) -> str:
    v = latest_value(obs)
    base = f"Shiller CAPE: {_fmt(v)}."
    tail = {
        Status.GREEN: " Near historical norms.",
        Status.AMBER: " Elevated — muted long-run returns implied.",
        Status.RED: " Very high — only matched near major peaks (1929, 2000, 2021).",
        Status.UNKNOWN: "",
    }[status]
    return base + tail


# --------------------------------------------------------------------------- #
# The registry
# --------------------------------------------------------------------------- #
REGISTRY: list[MetricSpec] = [
    MetricSpec(
        id="jobless_claims",
        name="Initial Jobless Claims",
        unit="claims/week",
        source="FRED: ICSA",
        thresholds={"amber_rise_pct": 7.5, "red_rise_pct": 15.0},
        history_context=(
            "Among the most timely, least-revised labor reads. Claims bottom and "
            "then turn up before recessions: they began rising months ahead of "
            "2001, 2008, and spiked to ~6 million in weeks during the 2020 shock. "
            "A steady, broad rise off the cycle low is the warning — not any single week."
        ),
        fetch=lambda k, c: fetch_series("ICSA", k, client=c),
        status_fn=claims_trend_status,
        meaning_fn=_claims_meaning,
        overlay_fn=lambda obs: moving_average(obs, 4),
        overlay_label="4-week average",
    ),
    MetricSpec(
        id="sahm_rule",
        name="Sahm Rule",
        unit="ppt",
        source="FRED: SAHMREALTIME",
        thresholds={"danger": 0.50},
        history_context=(
            "The best simple, real-time recession-onset signal: triggers when the "
            "3-month unemployment average rises 0.5pt above its 12-month low. It has "
            "fired in all 11 recessions since 1950 (on average ~3 months in) with only "
            "one false positive (1959). It briefly approached the trigger in 2024, a "
            "reminder to read it alongside the other signals."
        ),
        fetch=lambda k, c: fetch_series("SAHMREALTIME", k, client=c),
        status_fn=_sahm_status,
        meaning_fn=_sahm_meaning,
    ),
    MetricSpec(
        id="hy_credit_spread",
        name="High-Yield Credit Spread (OAS)",
        unit="bps",
        source="FRED: BAMLH0A0HYM2",
        thresholds={"amber": 5.5, "red": 8.0},
        history_context=(
            "Market-priced default risk that tends to widen before equity trouble. "
            "HY OAS blew past 1,500 bps in 2008 and ~1,100 bps in March 2020, and rose "
            "ahead of the 2000–01 downturn. Calm spreads (~300–400 bps) signal little "
            "credit fear; rapid widening is one of the cleaner market-based stress gauges. "
            "Note: FRED only redistributes the trailing ~3 years of this ICE-licensed "
            "series, so the chart shows recent levels rather than the historical crises above."
        ),
        fetch=lambda k, c: fetch_series("BAMLH0A0HYM2", k, client=c),
        status_fn=_hy_status,
        meaning_fn=_hy_meaning,
    ),
    MetricSpec(
        id="yield_curve",
        name="Yield Curve (10y–2y)",
        unit="%",
        source="FRED: T10Y2Y",
        thresholds={"inverted": 0.0, "flat": 0.25},
        history_context=(
            "Long respected: the 10y–2y inverted before the 2001, 2008, and 2020 "
            "recessions. But it was demoted after a deep 2022–24 inversion that did "
            "NOT promptly produce a recession — its worst false positive. Use it as one "
            "input among several, not alone. The re-steepening from inversion has often "
            "coincided with the actual downturn."
        ),
        fetch=lambda k, c: fetch_series("T10Y2Y", k, client=c),
        status_fn=_curve_status,
        meaning_fn=_curve_meaning,
    ),
    MetricSpec(
        id="pmi_proxy",
        name="Manufacturing PMI (proxy)",
        unit="diffusion",
        source="FRED regional Fed surveys (ISM proxy)",
        thresholds={"contraction": 0.0, "deep": -5.0},
        history_context=(
            "ISM's PMI is among the best timely cycle reads, but it is license-restricted "
            "and unavailable free. This composite of regional Fed manufacturing surveys "
            "(Philadelphia, New York, Dallas) is a free stand-in centered near zero: "
            "sustained sub-zero readings line up with manufacturing recessions (2008, 2015–16, "
            "2020, 2022–23). Treat it as directional, not a precise ISM substitute."
        ),
        fetch=lambda k, c: fetch_pmi_proxy(k, client=c),
        status_fn=_pmi_status,
        meaning_fn=_pmi_meaning,
    ),
    MetricSpec(
        id="buffett_indicator",
        name="Buffett Indicator",
        unit="%",
        source="FRED: NCBEILQ027S / GDP (approx)",
        thresholds={"rich": 150.0, "extreme": 200.0},
        history_context=(
            "Total market cap vs GDP — a long-horizon (10y+) valuation gauge Buffett "
            "called 'the best single measure.' It sat near ~140% at the 2000 peak and "
            "pushed to record highs (~200%+) in 2021. High readings don't time crashes "
            "but historically predict weak 10-year-forward returns. Shown here as an "
            "approximation (corporate equities market value / GDP, both from FRED)."
        ),
        fetch=_fetch_buffett,
        status_fn=_buffett_status,
        meaning_fn=_buffett_meaning,
    ),
    MetricSpec(
        id="cape",
        name="Shiller CAPE",
        unit="ratio",
        source="multpl.com (Shiller)",
        thresholds={"elevated": 30.0, "high": 35.0},
        history_context=(
            "Price divided by 10-year inflation-adjusted earnings — statistically strong "
            "over 10+ year horizons. It reached ~32 before the 1929 crash, ~44 at the 2000 "
            "dot-com top, and ~38 in 2021. Above ~30 has "
            "historically implied muted long-run returns. Like the Buffett Indicator, it's "
            "a valuation gauge, not a market-timing trigger."
        ),
        fetch=lambda k, c: fetch_cape(client=c),
        status_fn=_cape_status,
        meaning_fn=_cape_meaning,
    ),
    MetricSpec(
        id="vix",
        name="Market Volatility (VIX)",
        unit="index",
        source="FRED: VIXCLS",
        thresholds={"calm": 20.0, "fear": 30.0},
        history_context=(
            "The VIX is the market's 'fear gauge' — the S&P 500's expected 30-day "
            "volatility implied by option prices. Rule of thumb: below ~15–20 signals "
            "calm, complacent, risk-on (bullish) markets; 20–30 is elevated; above 30 "
            "is fear; and above 40 is outright panic. It closed near ~80 in the 2008 "
            "crisis and ~82 in March 2020, versus single-digit lows in placid bull runs. "
            "The 50-day average helps separate a one-day spike from a sustained stress regime."
        ),
        fetch=lambda k, c: fetch_series("VIXCLS", k, client=c),
        status_fn=_vix_status,
        meaning_fn=_vix_meaning,
        overlay_fn=lambda obs: moving_average(obs, 50),
        overlay_label="50-day average",
        fast=True,
    ),
    MetricSpec(
        id="fear_greed",
        name="Fear & Greed Index",
        unit="0–100",
        source="CNN Business",
        thresholds={"extreme_fear": 25.0, "extreme_greed": 75.0},
        history_context=(
            "CNN's Fear & Greed Index distills seven market indicators (momentum, "
            "breadth, put/call ratios, junk-bond demand, volatility, safe-haven demand "
            "and market strength) into a single 0–100 score. It is best read as a "
            "contrarian gauge: readings under 25 ('extreme fear') have clustered near "
            "major bottoms, while readings over 75 ('extreme greed') often appear when "
            "markets are complacent and due for a pullback."
        ),
        fetch=lambda k, c: fetch_fear_greed(client=c),
        status_fn=_fear_greed_status,
        meaning_fn=_fear_greed_meaning,
        fast=True,
    ),
]

REGISTRY_BY_ID: dict[str, MetricSpec] = {m.id: m for m in REGISTRY}


def build_detail(
    spec: MetricSpec,
    observations: list[Observation],
    recessions: list[RecessionPeriod],
) -> MetricDetail:
    """Assemble a MetricDetail from a spec + its fetched series."""
    # Status and latest are computed from the FULL-resolution series; only the
    # charted series is thinned to keep the payload light.
    status = spec.status_fn(observations)
    latest = observations[-1] if observations else None

    def _thin(series: list[Observation]) -> list[Observation]:
        if spec.fast:
            return downsample_recent_dense(
                series, FAST_CHART_MAX_POINTS, FAST_RECENT_KEEP
            )
        return downsample(series, CHART_MAX_POINTS)

    # Overlay (e.g. moving average) is computed on full resolution, then thinned.
    overlay = _thin(spec.overlay_fn(observations)) if spec.overlay_fn else []
    return MetricDetail(
        id=spec.id,
        name=spec.name,
        unit=spec.unit,
        latest_value=latest.value if latest else None,
        as_of=latest.date if latest else None,
        status=status,
        meaning=spec.meaning_fn(observations, status),
        source=spec.source,
        series=_thin(observations),
        recessions=recessions,
        thresholds=spec.thresholds,
        history_context=spec.history_context,
        overlay=overlay,
        overlay_label=spec.overlay_label,
    )
