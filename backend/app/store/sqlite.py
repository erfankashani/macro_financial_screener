"""SQLite snapshot store (local dev).

Stores the whole Snapshot as one JSON blob in a single-row table. Historical
data is static and only the latest snapshot matters for serving, so we keep just
the most recent one (upsert on a fixed id).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app.models import Snapshot


class SqliteStore:
    def __init__(self, path: str) -> None:
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS snapshot ("
                "id INTEGER PRIMARY KEY CHECK (id = 1), "
                "generated_at TEXT NOT NULL, "
                "payload TEXT NOT NULL)"
            )

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path)

    def write_snapshot(self, snapshot: Snapshot) -> None:
        payload = snapshot.model_dump_json()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO snapshot (id, generated_at, payload) VALUES (1, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET generated_at = excluded.generated_at, "
                "payload = excluded.payload",
                (snapshot.generated_at.isoformat(), payload),
            )

    def read_snapshot(self) -> Snapshot | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT payload FROM snapshot WHERE id = 1"
            ).fetchone()
        if row is None:
            return None
        return Snapshot.model_validate_json(row[0])
