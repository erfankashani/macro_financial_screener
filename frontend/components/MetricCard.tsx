import type { MetricDetail } from "@/lib/types";
import { STATUS_META, displayValue, formatDate } from "@/lib/format";
import { FAQ_LEAD, METRIC_FAQ, type FaqItem } from "@/lib/faq";
import StatusBadge from "./StatusBadge";
import MetricChart from "./MetricChart";
import FearGreedGauge from "./FearGreedGauge";

export default function MetricCard({ metric }: { metric: MetricDetail }) {
  const meta = STATUS_META[metric.status];
  // Lead Q&A (history is its answer) + any curated extras.
  const faq: FaqItem[] = [
    {
      q: FAQ_LEAD[metric.id] ?? `Why does the ${metric.name} matter?`,
      a: metric.history_context,
    },
    ...(METRIC_FAQ[metric.id] ?? []),
  ];
  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border bg-slate-900/60 p-5 backdrop-blur ${meta.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{metric.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            as of {formatDate(metric.as_of)}
          </p>
        </div>
        <StatusBadge status={metric.status} />
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold tabular-nums ${meta.text}`}>
            {displayValue(metric)}
          </span>
          <span className="text-xs text-slate-500">{metric.unit}</span>
        </div>
        {metric.id === "fear_greed" && metric.latest_value !== null && (
          <FearGreedGauge value={metric.latest_value} />
        )}
      </div>

      <p className="mt-2 text-sm leading-snug text-slate-300">{metric.meaning}</p>

      <div className="mt-3">
        <MetricChart metric={metric} />
      </div>

      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-sky-400 hover:text-sky-300">
          Why {metric.name} / FAQ ▾
        </summary>
        <div className="mt-2 space-y-1">
          {faq.map((item) => (
            <details
              key={item.q}
              className="rounded-lg border border-slate-800 bg-slate-950/40"
            >
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-300 hover:text-slate-100">
                <span className="mr-1 text-sky-500">▸</span>
                {item.q}
              </summary>
              <div className="px-3 pb-3 text-xs leading-relaxed text-slate-400">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </details>

      <p className="mt-3 border-t border-slate-800 pt-2 text-[10px] text-slate-600">
        Source: {metric.source}
      </p>
    </div>
  );
}
