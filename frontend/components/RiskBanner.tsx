"use client";

import { useState } from "react";
import type { MetricDetail, Status } from "@/lib/types";
import {
  TIMING_IDS,
  SENTIMENT_IDS,
  VALUATION_IDS,
  STATUS_META,
} from "@/lib/format";
import RadarChart, { type RadarPoint } from "./RadarChart";

function worst(statuses: Status[]): Status {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("amber")) return "amber";
  if (statuses.length && statuses.every((s) => s === "unknown")) return "unknown";
  return "green";
}

const DOT: Record<Status, string> = {
  green: "bg-up",
  amber: "bg-warn",
  red: "bg-down",
  unknown: "bg-[var(--text-subtle)]",
};

const RAIL: Record<Status, string> = {
  green: "var(--up)",
  amber: "var(--warn)",
  red: "var(--down)",
  unknown: "var(--text-subtle)",
};

const SEVERITY: Record<Status, number> = { green: 1, amber: 2, red: 3, unknown: 1 };

// Short labels for the radar axes (full names are too long to ring a small chart).
const SHORT: Record<string, string> = {
  fear_greed: "Fear/Greed",
  vix: "VIX",
  jobless_claims: "Claims",
  sahm_rule: "Sahm",
  hy_credit_spread: "HY OAS",
  yield_curve: "Curve",
  pmi_proxy: "PMI",
  buffett_indicator: "Buffett",
  cape: "CAPE",
};

interface SectionDef {
  key: string;
  tab: string;
  ids: string[];
}

const SECTIONS: SectionDef[] = [
  { key: "sentiment", tab: "Market Sentiment", ids: SENTIMENT_IDS },
  { key: "macro", tab: "USA Macro Economy", ids: TIMING_IDS },
  { key: "valuation", tab: "Stock Valuation", ids: VALUATION_IDS },
];

function readFor(key: string, w: Status): string {
  if (w === "unknown") return "Awaiting data for this group.";
  if (key === "sentiment")
    return {
      green: "Sentiment and volatility are calm — a risk-on backdrop.",
      amber: "Sentiment is jittery — at least one gauge is elevated.",
      red: "Sentiment is stressed — fear and volatility gauges are spiking.",
    }[w]!;
  if (key === "macro")
    return {
      green: "Recession-onset, credit, labor and cycle signals are calm today.",
      amber: "At least one timing signal is drifting toward warning territory — worth a look.",
      red: "One or more recession/credit/labor signals are flashing. Read the warning cards below.",
    }[w]!;
  return {
    green: "Long-run valuations are near historical norms.",
    amber: "Long-run valuations are elevated — expect muted multi-year returns.",
    red: "Long-run valuations are extremely rich — historically a drag on 10-year-forward returns (not a timing signal).",
  }[w]!;
}

function scrollToMetric(id: string) {
  const el = document.getElementById(`metric-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("ring-2", "ring-accent/60");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-accent/60"), 1600);
}

export default function RiskBanner({ metrics }: { metrics: MetricDetail[] }) {
  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  const [active, setActive] = useState(0);

  const sections = SECTIONS.map((s) => {
    const items = s.ids.map((id) => byId[id]).filter(Boolean) as MetricDetail[];
    const statuses = items.map((m) => m.status);
    return { ...s, items, worst: worst(statuses) };
  });

  const sel = sections[active];
  const tally = {
    green: sel.items.filter((m) => m.status === "green").length,
    amber: sel.items.filter((m) => m.status === "amber").length,
    red: sel.items.filter((m) => m.status === "red").length,
  };

  // Radar keeps every signal as an axis, but only the active section's signals
  // carry a value/color and form the shape; the rest collapse to center.
  const radar: RadarPoint[] = sections.flatMap((s) => {
    const isActive = s.key === sel.key;
    return s.items.map((m) => ({
      label: SHORT[m.id] ?? m.name,
      value: isActive ? SEVERITY[m.status] : 0,
      color: STATUS_META[m.status].chart,
      active: isActive,
    }));
  });

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
      style={{ boxShadow: "inset 4px 0 0 0 " + RAIL[sel.worst] }}
    >
      <div className="p-7 pl-8">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Today&apos;s read
        </span>

        {/* Section tabs — each shows that group's worst status. */}
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {sections.map((s, i) => {
            const isActive = i === active;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(i)}
                className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-border-strong bg-elevated text-text-strong"
                    : "border-transparent bg-surface-2 text-text-muted hover:text-text"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${DOT[s.worst]}`} />
                {s.tab}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
          {/* Radar for the selected section — top on mobile, right on desktop */}
          <div className="order-first flex flex-col items-center justify-center lg:order-last lg:border-l lg:border-border lg:pl-8">
            <RadarChart data={radar} />
            <p className="mt-1 text-center text-[10px] text-text-subtle">
              {sel.tab} · outer ring = warning
            </p>
          </div>

          {/* Selected section detail */}
          <div className="lg:order-first">
            <p className="text-sm leading-relaxed text-text">
              {readFor(sel.key, sel.worst)}
            </p>

            <div className="mt-4 flex items-baseline gap-4">
              <Tally n={tally.green} label="calm" color="text-up" />
              <Tally n={tally.amber} label="caution" color="text-warn" />
              <Tally n={tally.red} label="warning" color="text-down" />
            </div>

            <ul className="mt-4 max-w-sm space-y-0.5">
              {sel.items.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => scrollToMetric(m.id)}
                    className="group flex w-full items-center justify-between gap-4 rounded-[var(--radius-control)] px-2 py-1.5 text-xs transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-2 text-text-muted group-hover:text-text-strong">
                      <span className={`h-1.5 w-1.5 rounded-full ${DOT[m.status]}`} />
                      {m.name}
                      <span className="text-text-subtle opacity-0 transition-opacity group-hover:opacity-100">
                        ↓ view
                      </span>
                    </span>
                    <span className={STATUS_META[m.status].text}>
                      {STATUS_META[m.status].label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tally({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`nums text-2xl font-bold ${color}`}>{n}</span>
      <span className="text-[11px] uppercase tracking-wide text-text-muted">
        {label}
      </span>
    </div>
  );
}
