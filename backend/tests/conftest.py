"""Shared pytest fixtures."""

from __future__ import annotations

import httpx
import pytest

from app.main import app


@pytest.fixture
async def client():
    """An httpx AsyncClient wired to the FastAPI app (no network)."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
