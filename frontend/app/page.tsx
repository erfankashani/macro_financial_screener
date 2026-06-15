"use client";

import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/types";
import { getSnapshot } from "@/lib/api";
import { SENTIMENT_IDS, TIMING_IDS, VALUATION_IDS, formatDate } from "@/lib/format";
import RiskBanner from "@/components/RiskBanner";
import MetricCard from "@/components/MetricCard";
import { EVENT_STYLE, type EventKind } from "@/lib/events";

function ShadingLegend() {
  const kinds: EventKind[] = ["recession", "crash", "bubble"];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span className="text-slate-400">Chart shading:</span>
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-3.5 rounded-sm"
            style={{ backgroundColor: EVENT_STYLE[k].fill, opacity: 0.55 }}
          />
          {EVENT_STYLE[k].label}
        </span>
      ))}
      <span className="text-slate-600">— hover a band for what happened</span>
    </div>
  );
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSnapshot()
      .then(setSnapshot)
      .catch((e) => setError(e.message));
  }, []);

  const byId = snapshot
    ? Object.fromEntries(snapshot.metrics.map((m) => [m.id, m]))
    : {};
  const timing = TIMING_IDS.map((id) => byId[id]).filter(Boolean);
  const sentiment = SENTIMENT_IDS.map((id) => byId[id]).filter(Boolean);
  const valuation = VALUATION_IDS.map((id) => byId[id]).filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Macro Market Screener
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Your one-glance morning read on macro risk — recession onset, credit
          stress, the labor market, the business cycle, and long-run valuation.
        </p>
        {snapshot && (
          <p className="mt-1 text-xs text-slate-600">
            Data as of {formatDate(snapshot.generated_at)}
          </p>
        )}
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p className="font-semibold">Couldn&apos;t load data</p>
          <p className="mt-1 text-rose-300/80">{error}</p>
        </div>
      )}

      {!error && !snapshot && (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-800/40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-2xl bg-slate-800/40"
              />
            ))}
          </div>
        </div>
      )}

      {snapshot && (
        <div className="space-y-8">
          <RiskBanner metrics={snapshot.metrics} />

          <ShadingLegend />

          {sentiment.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Market Sentiment and Volatility
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {sentiment.map((m) => (
                  <MetricCard key={m.id} metric={m} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
              USA Macro Economy Health Indicators
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {timing.map((m) => (
                <MetricCard key={m.id} metric={m} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Long-Run Valuation — 10-Year Return Outlook
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {valuation.map((m) => (
                <MetricCard key={m.id} metric={m} />
              ))}
            </div>
          </section>
        </div>
      )}

      <footer className="mt-12 border-t border-slate-800 pt-4 text-xs text-slate-600">
        Educational use only — not investment advice. The manufacturing PMI is a
        regional-Fed proxy (real ISM is license-restricted). Data via FRED and
        multpl.com.
      </footer>
    </main>
  );
}
