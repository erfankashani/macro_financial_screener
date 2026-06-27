"""Phase A: health endpoint (first TDD test)."""

from __future__ import annotations


async def test_health_returns_ok(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
