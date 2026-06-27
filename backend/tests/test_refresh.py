"""Phase D: refresh orchestration (all HTTP mocked — no network)."""

from __future__ import annotations

import respx
from httpx import Response

from app.refresh import build_snapshot, refresh
from app.config import Settings
from app.models import Status
from app.sources.fred import FRED_OBSERVATIONS_URL
from app.sources.sentiment import CNN_FEAR_GREED_URL
from app.sources.shiller import MULTPL_CAPE_URL
from app.store.sqlite import SqliteStore

# Minimal canned series keyed by FRED series_id.
FAKE_FRED = {
    "USREC": [{"date": "2020-02-01", "value": "1"}, {"date": "2020-03-01", "value": "1"},
              {"date": "2020-04-01", "value": "0"}],
    "ICSA": [{"date": f"2024-01-{d:02d}", "value": "220000"} for d in range(1, 11)],
    "SAHMREALTIME": [{"date": "2026-05-01", "value": "0.55"}],   # -> RED
    "BAMLH0A0HYM2": [{"date": "2026-06-01", "value": "3.2"}],    # -> GREEN
    "T10Y2Y": [{"date": "2026-06-01", "value": "0.40"}],         # -> GREEN
    "GACDFSA066MSFRBPHI": [{"date": "2026-05-01", "value": "4.0"}],
    "GACDISA066MSFRBNY": [{"date": "2026-05-01", "value": "2.0"}],
    "BACTSAMFRBDAL": [{"date": "2026-05-01", "value": "0.0"}],
    # equities in $millions; /1000 -> 60000 $B; 60000/28000*100 ~ 214 -> RED
    "NCBEILQ027S": [{"date": "2026-04-01", "value": "60000000"}],
    "GDP": [{"date": "2026-04-01", "value": "28000"}],
    "VIXCLS": [{"date": "2026-06-10", "value": "15.0"}],  # -> GREEN (calm)
}

MULTPL_HTML = """
<table><tr><th>Date</th><th>Value</th></tr>
<tr><td>Jun 1, 2026</td><td>36.0</td></tr></table>
"""

FEAR_GREED_JSON = {
    "fear_and_greed_historical": {
        "data": [{"x": 1781308796000, "y": 34.0, "rating": "fear"}]
    }
}


def _install_mocks() -> None:
    def fred_side_effect(request):
        sid = request.url.params["series_id"]
        return Response(200, json={"observations": FAKE_FRED.get(sid, [])})

    respx.get(FRED_OBSERVATIONS_URL).mock(side_effect=fred_side_effect)
    respx.get(MULTPL_CAPE_URL).mock(return_value=Response(200, text=MULTPL_HTML))
    respx.get(CNN_FEAR_GREED_URL).mock(
        return_value=Response(200, json=FEAR_GREED_JSON)
    )


@respx.mock
async def test_build_snapshot_scores_all_metrics():
    _install_mocks()
    snap = await build_snapshot("fake-key")

    by_id = {m.id: m for m in snap.metrics}
    assert set(by_id) == {
        "jobless_claims", "sahm_rule", "hy_credit_spread", "yield_curve",
        "pmi_proxy", "buffett_indicator", "cape", "vix", "fear_greed",
    }
    assert by_id["sahm_rule"].status == Status.RED
    assert by_id["hy_credit_spread"].status == Status.GREEN
    assert by_id["yield_curve"].status == Status.GREEN
    assert by_id["buffett_indicator"].status == Status.RED
    assert by_id["cape"].latest_value == 36.0
    assert by_id["vix"].status == Status.GREEN
    assert by_id["fear_greed"].latest_value == 34.0
    assert by_id["fear_greed"].status == Status.AMBER  # 34 -> Fear band
    # recession shading came through from USREC
    assert by_id["sahm_rule"].recessions[0].start.isoformat() == "2020-02-01"


@respx.mock
async def test_refresh_writes_to_store(tmp_path):
    _install_mocks()
    store = SqliteStore(str(tmp_path / "c.db"))
    settings = Settings(fred_api_key="fake-key", cache_db_path=str(tmp_path / "c.db"))
    await refresh(store, settings)

    got = store.read_snapshot()
    assert got is not None
    assert len(got.metrics) == 9


async def test_refresh_requires_api_key(tmp_path):
    store = SqliteStore(str(tmp_path / "c.db"))
    settings = Settings(fred_api_key="", cache_db_path=str(tmp_path / "c.db"))
    try:
        await refresh(store, settings)
        assert False, "expected RuntimeError"
    except RuntimeError as e:
        assert "FRED_API_KEY" in str(e)
