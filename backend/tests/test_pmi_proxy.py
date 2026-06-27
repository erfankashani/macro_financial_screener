"""Phase B: PMI proxy composite + graceful fetch degradation."""

from __future__ import annotations

from datetime import date

import respx
from httpx import Response

from app.models import Observation
from app.sources.fred import FRED_OBSERVATIONS_URL
from app.sources.pmi_proxy import composite_index, fetch_pmi_proxy


def test_composite_averages_available_months():
    a = [
        Observation(date=date(2024, 1, 1), value=10.0),
        Observation(date=date(2024, 2, 1), value=20.0),
    ]
    b = [
        Observation(date=date(2024, 1, 1), value=30.0),
        # no Feb reading from series b
    ]
    out = composite_index([a, b])
    assert out[0] == Observation(date=date(2024, 1, 1), value=20.0)  # (10+30)/2
    assert out[1] == Observation(date=date(2024, 2, 1), value=20.0)  # only a


@respx.mock
async def test_fetch_pmi_proxy_tolerates_failures():
    # All regional series hit the same endpoint; return one good payload then
    # a 500 for subsequent calls. The composite should still return data.
    respx.get(FRED_OBSERVATIONS_URL).mock(
        side_effect=[
            Response(200, json={"observations": [{"date": "2024-01-01", "value": "5"}]}),
            Response(500),
            Response(500),
        ]
    )
    out = await fetch_pmi_proxy("fake-key")
    assert out == [Observation(date=date(2024, 1, 1), value=5.0)]
