"""Storage interface.

The API only ever READS snapshots; the daily refresh job WRITES them. Keeping
this a Protocol lets us swap the local SQLite dev impl for object storage
(S3/R2) or Postgres in a serverless deployment without touching callers.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.models import Snapshot


@runtime_checkable
class Store(Protocol):
    def write_snapshot(self, snapshot: Snapshot) -> None:
        """Persist the latest snapshot (overwriting the previous one)."""
        ...

    def read_snapshot(self) -> Snapshot | None:
        """Return the latest snapshot, or None if none has been written yet."""
        ...
