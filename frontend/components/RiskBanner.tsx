import type { MetricDetail, Status } from "@/lib/types";
import { TIMING_IDS, VALUATION_IDS } from "@/lib/format";

function worst(statuses: Status[]): Status {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("amber")) return "amber";
  if (statuses.every((s) => s === "unknown")) return "unknown";
  return "green";
}

const TIMING_COPY: Record<Status, { title: string; sub: string; cls: string }> = {
  green: {
    title: "No acute macro warnings",
    sub: "Recession-onset, credit, labor and cycle signals are calm today.",
    cls: "border-emerald-500/30 from-emerald-500/10",
  },
  amber: {
    title: "Some caution flags",
    sub: "At least one timing signal is drifting toward warning territory — worth a look.",
    cls: "border-amber-500/30 from-amber-500/10",
  },
  red: {
    title: "Elevated macro risk",
    sub: "One or more recession/credit/labor signals are flashing. Read the red cards below.",
    cls: "border-rose-500/40 from-rose-500/10",
  },
  unknown: {
    title: "Awaiting data",
    sub: "Timing signals could not be evaluated.",
    cls: "border-slate-600/40 from-slate-500/10",
  },
};

export default function RiskBanner({ metrics }: { metrics: MetricDetail[] }) {
  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  const timing = TIMING_IDS.map((id) => byId[id]?.status).filter(Boolean) as Status[];
  const valuation = VALUATION_IDS.map((id) => byId[id]?.status).filter(Boolean) as Status[];

  const acute = worst(timing);
  const copy = TIMING_COPY[acute];
  const valWorst = worst(valuation);

  const valNote =
    valWorst === "red"
      ? "Long-run valuations are extremely rich — historically a drag on 10-year-forward returns (not a timing signal)."
      : valWorst === "amber"
        ? "Long-run valuations are elevated — expect muted multi-year returns."
        : "Long-run valuations are near historical norms.";

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br to-transparent p-6 ${copy.cls}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full ${
            acute === "red"
              ? "bg-rose-500"
              : acute === "amber"
                ? "bg-amber-400"
                : acute === "green"
                  ? "bg-emerald-400"
                  : "bg-slate-500"
          } ${acute === "red" ? "animate-pulse" : ""}`}
        />
        <h2 className="text-xl font-bold text-slate-100">{copy.title}</h2>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">{copy.sub}</p>
      <p className="mt-1 max-w-3xl text-xs text-slate-400">{valNote}</p>
    </div>
  );
}
