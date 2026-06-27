"""4-week average overlay for jobless claims."""

from __future__ import annotations

from datetime import date, timedelta

from app.metrics.registry import REGISTRY_BY_ID, build_detail
from app.metrics.status import moving_average
from app.models import Observation


def _weekly(values: list[float]) -> list[Observation]:
    base = date(2024, 1, 1)
    return [Observation(date=base + timedelta(weeks=i), value=v) for i, v in enumerate(values)]


def test_moving_average_trailing_window():
    obs = _weekly([10, 20, 30, 40, 50])
    ma = moving_average(obs, 4)
    # First full window ends at index 3: mean(10,20,30,40)=25; next mean(20,30,40,50)=35
    assert [o.value for o in ma] == [25.0, 35.0]
    assert ma[0].date == obs[3].date


def test_moving_average_too_short():
    assert moving_average(_weekly([1, 2]), 4) == []


def test_jobless_claims_detail_has_overlay():
    spec = REGISTRY_BY_ID["jobless_claims"]
    assert spec.overlay_fn is not None
    detail = build_detail(spec, _weekly([200_000] * 10), [])
    assert detail.overlay_label == "4-week average"
    assert len(detail.overlay) > 0


def test_other_metric_has_no_overlay():
    detail = build_detail(REGISTRY_BY_ID["sahm_rule"], _weekly([0.1, 0.2]), [])
    assert detail.overlay == []
    assert detail.overlay_label is None
