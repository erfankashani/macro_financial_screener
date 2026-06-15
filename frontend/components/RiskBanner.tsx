import type { MetricDetail, Status } from "@/lib/types";
import { TIMING_IDS, VALUATION_IDS, STATUS_META } from "@/lib/format";

function worst(statuses: Status[]): Status {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("amber")) return "amber";
  if (statuses.every((s) => s === "unknown")) return "unknown";
  return "green";
}

const TIMING_COPY: Record<
  Status,
  { title: string; sub: string; rail: string; dot: string }
> = {
  green: {
    title: "No acute macro warnings",
    sub: "Recession-onset, credit, labor and cycle signals are calm today.",
    rail: "var(--up)",
    dot: "bg-up",
  },
  amber: {
    title: "Some caution flags",
    sub: "At least one timing signal is drifting toward warning territory — worth a look.",
    rail: "var(--warn)",
    dot: "bg-warn",
  },
  red: {
    title: "Elevated macro risk",
    sub: "One or more recession/credit/labor signals are flashing. Read the warning cards below.",
    rail: "var(--down)",
    dot: "bg-down",
  },
  unknown: {
    title: "Awaiting data",
    sub: "Timing signals could not be evaluated.",
    rail: "var(--text-subtle)",
    dot: "bg-[var(--text-subtle)]",
  },
};

const DOT: Record<Status, string> = {
  green: "bg-up",
  amber: "bg-warn",
  red: "bg-down",
  unknown: "bg-[var(--text-subtle)]",
};

export default function RiskBanner({ metrics }: { metrics: MetricDetail[] }) {
  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  const timingMetrics = TIMING_IDS.map((id) => byId[id]).filter(
    Boolean,
  ) as MetricDetail[];
  const timing = timingMetrics.map((m) => m.status);
  const valuation = VALUATION_IDS.map((id) => byId[id]?.status).filter(
    Boolean,
  ) as Status[];

  const acute = worst(timing);
  const copy = TIMING_COPY[acute];
  const valWorst = worst(valuation);

  const tally = {
    green: timing.filter((s) => s === "green").length,
    amber: timing.filter((s) => s === "amber").length,
    red: timing.filter((s) => s === "red").length,
  };

  const valNote =
    valWorst === "red"
      ? "Long-run valuations are extremely rich — historically a drag on 10-year-forward returns (not a timing signal)."
      : valWorst === "amber"
        ? "Long-run valuations are elevated — expect muted multi-year returns."
        : "Long-run valuations are near historical norms.";

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
      style={{ boxShadow: "inset 4px 0 0 0 " + copy.rail }}
    >
      <div className="grid gap-x-10 gap-y-6 p-7 pl-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Hero verdict — the ONE thing to read in 3 seconds. */}
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${copy.dot} ${
                acute === "red" ? "animate-pulse" : ""
              }`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Today&apos;s read
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-strong sm:text-[28px] sm:leading-[1.15]">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text">
            {copy.sub}
          </p>
          <p className="mt-3 max-w-xl border-t border-border pt-3 text-xs leading-relaxed text-text-muted">
            {valNote}
          </p>
        </div>

        {/* Signal breakdown — structure for the eye, evidence for the verdict. */}
        <div className="lg:border-l lg:border-border lg:pl-10">
          <div className="flex items-baseline gap-4">
            <Tally n={tally.green} label="calm" color="text-up" />
            <Tally n={tally.amber} label="caution" color="text-warn" />
            <Tally n={tally.red} label="warning" color="text-down" />
          </div>
          <ul className="mt-4 space-y-1.5">
            {timingMetrics.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex items-center gap-2 text-text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${DOT[m.status]}`}
                  />
                  {m.name}
                </span>
                <span className="text-text-subtle">
                  {STATUS_META[m.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Tally({
  n,
  label,
  color,
}: {
  n: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`nums text-2xl font-bold ${color}`}>{n}</span>
      <span className="text-[11px] uppercase tracking-wide text-text-muted">
        {label}
      </span>
    </div>
  );
}
