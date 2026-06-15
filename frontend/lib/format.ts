import type { MetricDetail, Status } from "./types";

export const STATUS_META: Record<
  Status,
  { label: string; dot: string; text: string; border: string; chart: string }
> = {
  green: {
    label: "Calm",
    dot: "bg-up",
    text: "text-up",
    border: "border-up/30",
    chart: "#34d399",
  },
  amber: {
    label: "Caution",
    dot: "bg-warn",
    text: "text-warn",
    border: "border-warn/30",
    chart: "#fbbf24",
  },
  red: {
    label: "Warning",
    dot: "bg-down",
    text: "text-down",
    border: "border-down/40",
    chart: "#fb7185",
  },
  unknown: {
    label: "No data",
    dot: "bg-[var(--text-subtle)]",
    text: "text-text-muted",
    border: "border-border",
    chart: "#8593a6",
  },
};

// Which metrics are acute "timing" signals vs long-run "valuation" gauges.
export const TIMING_IDS = [
  "jobless_claims",
  "sahm_rule",
  "hy_credit_spread",
  "yield_curve",
  "pmi_proxy",
];
export const SENTIMENT_IDS = ["fear_greed", "vix"];
export const VALUATION_IDS = ["buffett_indicator", "cape"];

// The "400k rule of thumb" line drawn on the jobless-claims chart.
export const CLAIMS_RULE_OF_THUMB = 400_000;

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Human-readable headline value for a metric's latest reading. */
export function displayValue(m: MetricDetail): string {
  if (m.latest_value === null) return "—";
  const v = m.latest_value;
  switch (m.id) {
    case "jobless_claims":
      return nf0.format(v);
    case "hy_credit_spread":
      return `${nf0.format(v * 100)} bps`;
    case "yield_curve":
      return `${v.toFixed(2)}%`;
    case "buffett_indicator":
      return `${nf0.format(v)}%`;
    case "sahm_rule":
      return v.toFixed(2);
    case "pmi_proxy":
      return v.toFixed(1);
    case "cape":
      return v.toFixed(1);
    case "vix":
      return v.toFixed(1);
    case "fear_greed":
      return Math.round(v).toString();
    default:
      return v.toFixed(2);
  }
}

export interface ThresholdLine {
  value: number;
  label: string;
}

/** Danger/threshold reference lines to draw on each metric's chart. */
export function thresholdLines(m: MetricDetail): ThresholdLine[] {
  const t = m.thresholds;
  switch (m.id) {
    case "sahm_rule":
      return [{ value: t.danger, label: "Recession trigger (0.5)" }];
    case "hy_credit_spread":
      return [
        { value: t.amber, label: "Stress (~550 bps)" },
        { value: t.red, label: "Crisis (~800 bps)" },
      ];
    case "yield_curve":
      return [{ value: t.inverted, label: "Inversion (0)" }];
    case "pmi_proxy":
      return [{ value: t.contraction, label: "Contraction (0)" }];
    case "buffett_indicator":
      return [
        { value: t.rich, label: "Rich (150%)" },
        { value: t.extreme, label: "Extreme (200%)" },
      ];
    case "cape":
      return [
        { value: t.elevated, label: "Elevated (30)" },
        { value: t.high, label: "High (35)" },
      ];
    case "vix":
      return [
        { value: t.calm, label: "Calm / bullish (20)" },
        { value: t.fear, label: "Fear / panic (30)" },
      ];
    case "fear_greed":
      return [
        { value: t.extreme_fear, label: "Extreme fear (25)" },
        { value: t.extreme_greed, label: "Extreme greed (75)" },
      ];
    default:
      return [];
  }
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Compact y-axis tick: 229K, 1.2M, 218, 0.39. */
export function axisTick(v: number): string {
  if (Math.abs(v) >= 1000) return compact.format(v);
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(Math.abs(v) < 10 ? 2 : 1);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
