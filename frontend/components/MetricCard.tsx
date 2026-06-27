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
      id={`metric-${metric.id}`}
      className="group flex min-w-0 scroll-mt-20 flex-col rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-all hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-strong">
            {metric.name}
          </h3>
          <p className="mt-0.5 text-xs text-text-subtle">
            as of {formatDate(metric.as_of)}
          </p>
        </div>
        <StatusBadge status={metric.status} />
      </div>

      {/* Number is the hero of the card: large, tabular, with a muted unit. */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className={`nums text-[40px] font-bold leading-none tracking-tight ${meta.text}`}>
            {displayValue(metric)}
          </span>
          <span className="text-xs text-text-muted">{metric.unit}</span>
        </div>
        {metric.id === "fear_greed" && metric.latest_value !== null && (
          <FearGreedGauge value={metric.latest_value} />
        )}
      </div>

      <p className="mt-3 text-sm leading-snug text-text">{metric.meaning}</p>

      <div className="mt-4">
        <MetricChart metric={metric} />
      </div>

      <details className="group/faq mt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-accent hover:brightness-125">
          Why {metric.name} / FAQ ▾
        </summary>
        <div className="mt-2 space-y-1">
          {faq.map((item) => (
            <details
              key={item.q}
              className="rounded-[var(--radius-control)] border border-border bg-surface-2"
            >
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-text hover:text-text-strong">
                <span className="mr-1 text-accent">▸</span>
                {item.q}
              </summary>
              <div className="px-3 pb-3 text-xs leading-relaxed text-text-muted">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </details>

      <p className="mt-4 border-t border-border pt-2.5 text-[10px] text-text-subtle">
        Source: {metric.source}
      </p>
    </div>
  );
}
