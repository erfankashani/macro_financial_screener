"""Phase E: API routes (read from a seeded store, dependency-overridden)."""

from __future__ import annotations

from datetime import date

import httpx
import pytest

from app.main import app, get_store
from app.models import MetricDetail, Observation, Snapshot, Status


def _detail(metric_id: str, status: Status = Status.GREEN) -> MetricDetail:
    return MetricDetail(
        id=metric_id,
        name=metric_id.title(),
        unit="x",
        latest_value=1.0,
        as_of=date(2026, 6, 1),
        status=status,
        meaning="m",
        source="FRED",
        series=[Observation(date=date(2026, 6, 1), value=1.0)],
        recessions=[],
        thresholds={"danger": 0.5},
        history_context="ctx",
    )


class FakeStore:
    def __init__(self, snapshot: Snapshot | None):
        self._snapshot = snapshot

    def write_snapshot(self, snapshot: Snapshot) -> None:
        self._snapshot = snapshot

    def read_snapshot(self) -> Snapshot | None:
        return self._snapshot


def _seed(snapshot: Snapshot | None) -> None:
    app.dependency_overrides[get_store] = lambda: FakeStore(snapshot)


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


async def _client():
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_snapshot_503_when_empty():
    _seed(None)
    async with await _client() as c:
        resp = await c.get("/api/snapshot")
    assert resp.status_code == 503


async def test_metrics_summary_drops_series():
    snap = Snapshot(generated_at=date(2026, 6, 13), metrics=[_detail("sahm_rule")])
    _seed(snap)
    async with await _client() as c:
        resp = await c.get("/api/metrics")
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["id"] == "sahm_rule"
    assert "series" not in body[0]  # summary is compact


async def test_metric_detail_includes_series_and_context():
    snap = Snapshot(generated_at=date(2026, 6, 13), metrics=[_detail("cape")])
    _seed(snap)
    async with await _client() as c:
        resp = await c.get("/api/metrics/cape")
    assert resp.status_code == 200
    body = resp.json()
    assert body["history_context"] == "ctx"
    assert len(body["series"]) == 1


async def test_metric_detail_404_for_unknown():
    snap = Snapshot(generated_at=date(2026, 6, 13), metrics=[_detail("cape")])
    _seed(snap)
    async with await _client() as c:
        resp = await c.get("/api/metrics/nope")
    assert resp.status_code == 404
