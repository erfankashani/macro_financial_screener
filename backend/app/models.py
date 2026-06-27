"""Pydantic schemas shared across sources, metrics, storage, and the API."""

from __future__ import annotations

from datetime import date as date_type
from enum import Enum

from pydantic import BaseModel


class Status(str, Enum):
    """Traffic-light status for a metric's latest reading."""

    GREEN = "green"
    AMBER = "amber"
    RED = "red"
    UNKNOWN = "unknown"


class Observation(BaseModel):
    """A single (date, value) point in a time series."""

    date: date_type
    value: float


class RecessionPeriod(BaseModel):
    """An NBER recession span used for chart shading."""

    start: date_type
    end: date_type


class MetricSummary(BaseModel):
    """Compact per-metric payload for the dashboard cards."""

    id: str
    name: str
    unit: str
    latest_value: float | None
    as_of: date_type | None
    status: Status
    meaning: str  # one-line "what this is telling you right now"
    source: str


class MetricDetail(MetricSummary):
    """Full per-metric payload: series + context for charts."""

    series: list[Observation]
    recessions: list[RecessionPeriod]
    thresholds: dict[str, float]  # e.g. {"danger": 0.5}
    history_context: str  # "what it looked like in 2000 / 2008 / 2020"
    overlay: list[Observation] = []  # optional secondary line (e.g. 4-week avg)
    overlay_label: str | None = None


class Snapshot(BaseModel):
    """The full daily-refreshed payload served to the one-pager."""

    generated_at: date_type
    metrics: list[MetricDetail]
