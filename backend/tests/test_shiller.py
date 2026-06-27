"""Phase B: Shiller CAPE parsing."""

from __future__ import annotations

from datetime import date

from app.sources.shiller import parse_multpl_table

SAMPLE_HTML = """
<table>
  <tr><th>Date</th><th>Value</th></tr>
  <tr><td>Jun 1, 2026</td><td>35.12</td></tr>
  <tr><td>May 1, 2026</td><td>34.80</td></tr>
  <tr><td>Apr 1, 2026</td><td>33.95</td></tr>
</table>
"""


def test_parse_multpl_table_sorted_ascending():
    obs = parse_multpl_table(SAMPLE_HTML)
    assert [o.date for o in obs] == [
        date(2026, 4, 1),
        date(2026, 5, 1),
        date(2026, 6, 1),
    ]
    assert obs[-1].value == 35.12


def test_parse_multpl_table_skips_bad_rows():
    html = """
    <table>
      <tr><th>Date</th><th>Value</th></tr>
      <tr><td>Jan 1, 2025</td><td>30.0</td></tr>
      <tr><td>n/a</td><td>oops</td></tr>
    </table>
    """
    obs = parse_multpl_table(html)
    assert len(obs) == 1
    assert obs[0].value == 30.0
