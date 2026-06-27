"""Phase C: registry wiring + detail assembly."""

from __future__ import annotations

from datetime import date

from app.metrics.registry import (
    REGISTRY,
    REGISTRY_BY_ID,
    build_detail,
)
from app.models import Observation, RecessionPeriod, Status


def test_registry_ids_unique_and_complete():
    ids = [m.id for m in REGISTRY]
    assert len(ids) == len(set(ids))
    expected = {
        "jobless_claims",
        "sahm_rule",
        "hy_credit_spread",
        "yield_curve",
        "pmi_proxy",
        "buffett_indicator",
        "cape",
        "vix",
        "fear_greed",
    }
    assert set(ids) == expected


def test_build_detail_populates_latest_and_status():
    spec = REGISTRY_BY_ID["sahm_rule"]
    obs = [
        Observation(date=date(2024, 1, 1), value=0.1),
        Observation(date=date(2024, 2, 1), value=0.55),
    ]
    recessions = [RecessionPeriod(start=date(2020, 2, 1), end=date(2020, 4, 1))]
    detail = build_detail(spec, obs, recessions)

    assert detail.id == "sahm_rule"
    assert detail.latest_value == 0.55
    assert detail.as_of == date(2024, 2, 1)
    assert detail.status == Status.RED
    assert detail.recessions == recessions
    assert "0.50" in detail.meaning or "0.55" in detail.meaning
    assert detail.history_context  # non-empty blurb


def test_build_detail_empty_series_is_unknown():
    spec = REGISTRY_BY_ID["cape"]
    detail = build_detail(spec, [], [])
    assert detail.latest_value is None
    assert detail.as_of is None
    assert detail.status == Status.UNKNOWN
