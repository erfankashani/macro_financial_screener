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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-subtle">
      <span className="text-text-muted">Chart shading:</span>
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-3.5 rounded-sm"
            style={{ backgroundColor: EVENT_STYLE[k].fill, opacity: 0.55 }}
          />
          {EVENT_STYLE[k].label}
        </span>
      ))}
      <span className="text-text-subtle/70">— hover a band for what happened</span>
    </div>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {children}
      </h2>
      {count != null && (
        <span className="nums rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-subtle">
          {count}
        </span>
      )}
      <span className="h-px flex-1 bg-border" />
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
      <header className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-text-strong">
          Macro Market Screener
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-muted">
          Your one-glance morning read on macro risk — recession onset, credit
          stress, the labor market, the business cycle, and long-run valuation.
        </p>
        {snapshot && (
          <p className="mt-2 text-xs text-text-subtle">
            Data as of {formatDate(snapshot.generated_at)}
          </p>
        )}
      </header>

      {error && (
        <div className="rounded-[var(--radius-card)] border border-down/40 bg-down/10 p-6 text-sm text-down">
          <p className="font-semibold">Couldn&apos;t load data</p>
          <p className="mt-1 opacity-80">{error}</p>
        </div>
      )}

      {!error && !snapshot && (
        <div className="space-y-6">
          <div className="h-36 animate-pulse rounded-[var(--radius-card)] bg-surface" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface"
              />
            ))}
          </div>
        </div>
      )}

      {snapshot && (
        <div className="space-y-9">
          <RiskBanner metrics={snapshot.metrics} />

          <ShadingLegend />

          {sentiment.length > 0 && (
            <section>
              <SectionLabel count={sentiment.length}>
                Market Sentiment &amp; Volatility
              </SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                {sentiment.map((m) => (
                  <MetricCard key={m.id} metric={m} />
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionLabel count={timing.length}>
              USA Macro Economy Health Indicators
            </SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              {timing.map((m) => (
                <MetricCard key={m.id} metric={m} />
              ))}
            </div>
          </section>

          <section>
            <SectionLabel count={valuation.length}>
              Long-Run Valuation — 10-Year Return Outlook
            </SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              {valuation.map((m) => (
                <MetricCard key={m.id} metric={m} />
              ))}
            </div>
          </section>
        </div>
      )}

      <footer className="mt-14 border-t border-border pt-4 text-xs text-text-subtle">
        Educational use only — not investment advice. The manufacturing PMI is a
        regional-Fed proxy (real ISM is license-restricted). Data via FRED and
        multpl.com.
      </footer>
    </main>
  );
}
