"""Phase D: SQLite store round-trip."""

from __future__ import annotations

from datetime import date

from app.models import MetricDetail, Snapshot, Status
from app.store.sqlite import SqliteStore


def _snapshot() -> Snapshot:
    return Snapshot(
        generated_at=date(2026, 6, 13),
        metrics=[
            MetricDetail(
                id="sahm_rule",
                name="Sahm Rule",
                unit="ppt",
                latest_value=0.2,
                as_of=date(2026, 5, 1),
                status=Status.GREEN,
                meaning="ok",
                source="FRED",
                series=[],
                recessions=[],
                thresholds={"danger": 0.5},
                history_context="ctx",
            )
        ],
    )


def test_read_before_write_returns_none(tmp_path):
    store = SqliteStore(str(tmp_path / "c.db"))
    assert store.read_snapshot() is None


def test_write_then_read_roundtrip(tmp_path):
    store = SqliteStore(str(tmp_path / "c.db"))
    snap = _snapshot()
    store.write_snapshot(snap)
    got = store.read_snapshot()
    assert got is not None
    assert got.generated_at == snap.generated_at
    assert got.metrics[0].id == "sahm_rule"
    assert got.metrics[0].thresholds == {"danger": 0.5}


def test_write_is_idempotent_keeps_latest(tmp_path):
    store = SqliteStore(str(tmp_path / "c.db"))
    store.write_snapshot(_snapshot())
    newer = _snapshot()
    newer.generated_at = date(2026, 6, 14)
    store.write_snapshot(newer)
    got = store.read_snapshot()
    assert got.generated_at == date(2026, 6, 14)
