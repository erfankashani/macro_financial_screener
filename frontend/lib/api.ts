import type { Snapshot } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function getSnapshot(): Promise<Snapshot> {
  const res = await fetch(`${API_BASE}/api/snapshot`, { cache: "no-store" });
  if (res.status === 503) {
    throw new Error(
      "The backend has no data yet. Run the daily refresh: `uv run python -m app.refresh`.",
    );
  }
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}. Is the API running on ${API_BASE}?`);
  }
  return res.json();
}
