"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricDetail } from "@/lib/types";
import {
  CLAIMS_RULE_OF_THUMB,
  STATUS_META,
  axisTick,
  thresholdLines,
} from "@/lib/format";
import { EVENT_STYLE, MARKET_EVENTS, eventAt } from "@/lib/events";
import { FEAR_GREED_ZONES } from "@/lib/sentiment";

type Range = "1W" | "1M" | "YTD" | "1Y" | "5Y" | "MAX";
const DEFAULT_RANGES: Range[] = ["YTD", "1Y", "5Y", "MAX"];
const FAST_RANGES: Range[] = ["1W", "1M", "1Y", "MAX"];
// Fast-moving daily metrics get short-window options + a shorter default.
const FAST_METRIC_IDS = ["fear_greed", "vix"];

const GREEN = "var(--chart-up)";
const AMBER = "var(--chart-warn)";
const RED = "var(--chart-down)";

/** Gradient stops that color a line green below a threshold, amber→red above. */
function thresholdGradientStops(
  yMin: number,
  yMax: number,
  threshold: number,
): { offset: string; color: string }[] {
  if (yMax <= threshold) return [{ offset: "0%", color: GREEN }];
  if (yMin >= threshold)
    return [
      { offset: "0%", color: RED },
      { offset: "100%", color: AMBER },
    ];
  const off = ((yMax - threshold) / (yMax - yMin)) * 100;
  return [
    { offset: "0%", color: RED },
    { offset: `${off}%`, color: AMBER },
    { offset: `${off}%`, color: GREEN },
    { offset: "100%", color: GREEN },
  ];
}

interface Point {
  t: number;
  value: number;
}

function cutoff(range: Range, latest: number): number {
  const d = new Date(latest);
  switch (range) {
    case "1W":
      return latest - 7 * 24 * 3600 * 1000;
    case "1M":
      return new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()).getTime();
    case "YTD":
      return new Date(d.getFullYear(), 0, 1).getTime();
    case "1Y":
      return new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).getTime();
    case "5Y":
      return new Date(d.getFullYear() - 5, d.getMonth(), d.getDate()).getTime();
    case "MAX":
      return -Infinity;
  }
}

interface TipProps {
  active?: boolean;
  label?: number;
  payload?: { value: number }[];
  unit: string;
}

function ChartTooltip({ active, label, payload, unit }: TipProps) {
  if (!active || !payload?.length || label == null) return null;
  const ev = eventAt(label);
  return (
    <div className="rounded-[var(--radius-control)] border border-border-strong bg-elevated/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="text-text-muted">
        {new Date(label).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div className="nums font-semibold text-text-strong">
        {Number(payload[0].value).toLocaleString()}{" "}
        <span className="font-normal text-text-subtle">{unit}</span>
      </div>
      {ev && (
        <div
          className="mt-1 max-w-[200px] border-t border-border pt-1"
          style={{ color: EVENT_STYLE[ev.kind].fill }}
        >
          <div className="font-medium">{ev.name}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-text-muted">
            {ev.note}
          </div>
        </div>
      )}
    </div>
  );
}

const CHART_HEIGHT = 210;

/** Measure the live width of a container via ResizeObserver. */
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export default function MetricChart({ metric }: { metric: MetricDetail }) {
  const isFast = FAST_METRIC_IDS.includes(metric.id);
  const ranges = isFast ? FAST_RANGES : DEFAULT_RANGES;
  const [range, setRange] = useState<Range>(isFast ? "1W" : "5Y");
  const [showMA, setShowMA] = useState(false);
  const { ref, width } = useContainerWidth();
  const color = STATUS_META[metric.status].chart;

  const isClaims = metric.id === "jobless_claims";
  const isFearGreed = metric.id === "fear_greed";
  const hasOverlay = metric.overlay.length > 0;

  const all: Point[] = useMemo(
    () =>
      metric.series.map((o) => ({ t: new Date(o.date).getTime(), value: o.value })),
    [metric.series],
  );
  const allOverlay: Point[] = useMemo(
    () =>
      metric.overlay.map((o) => ({ t: new Date(o.date).getTime(), value: o.value })),
    [metric.overlay],
  );

  const latest = all.length ? all[all.length - 1].t : Date.now();
  const min = cutoff(range, latest);
  const data = useMemo(() => all.filter((p) => p.t >= min), [all, min]);
  const overlayData = useMemo(
    () => allOverlay.filter((p) => p.t >= min),
    [allOverlay, min],
  );

  if (all.length === 0) {
    return (
      <div className="flex h-[210px] items-center justify-center text-sm text-text-subtle">
        No series data
      </div>
    );
  }

  const domainMin = data.length ? data[0].t : min;
  const domainMax = latest;
  const lines = thresholdLines(metric);

  // Claims line is colored by the 400k rule-of-thumb (green below, amber/red above).
  const claimsValues = isClaims ? data.map((d) => d.value) : [];
  const gradId = `grad-${metric.id}`;
  const gradStops = isClaims
    ? thresholdGradientStops(
        Math.min(...claimsValues),
        Math.max(...claimsValues),
        CLAIMS_RULE_OF_THUMB,
      )
    : [];

  // Named event bands overlapping the visible window.
  const bands = MARKET_EVENTS.map((e) => ({
    e,
    x1: Math.max(Date.parse(e.start), domainMin),
    x2: Math.min(Date.parse(e.end), domainMax),
  })).filter((b) => b.x2 >= b.x1 && b.x2 >= domainMin && b.x1 <= domainMax);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-[var(--radius-control)] px-2 py-0.5 text-[11px] font-medium transition-colors ${
                range === r
                  ? "bg-accent/15 text-accent"
                  : "text-text-subtle hover:text-text"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {hasOverlay && (
          <button
            onClick={() => setShowMA((v) => !v)}
            className={`rounded-[var(--radius-control)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
              showMA
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {metric.overlay_label ?? "4-week avg"}
          </button>
        )}
      </div>

      <div ref={ref} className="w-full min-w-0" style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <LineChart
            data={data}
            width={width}
            height={CHART_HEIGHT}
            margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
          >
            {isClaims && (
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  {gradStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
              </defs>
            )}
            <CartesianGrid stroke="var(--chart-grid)" strokeOpacity={0.9} strokeDasharray="2 4" vertical={false} />
            {isFearGreed &&
              FEAR_GREED_ZONES.map((z) => (
                <ReferenceArea
                  key={`fgz-${z.label}`}
                  x1={domainMin}
                  x2={domainMax}
                  y1={z.min}
                  y2={z.max}
                  fill={z.color}
                  fillOpacity={0.08}
                  ifOverflow="hidden"
                />
              ))}
            {bands.map((b, i) => (
              <ReferenceArea
                key={`ev-${i}`}
                x1={b.x1}
                x2={b.x2}
                fill={EVENT_STYLE[b.e.kind].fill}
                fillOpacity={0.14}
                ifOverflow="hidden"
              />
            ))}
            {!isFearGreed &&
              lines.map((l, i) => (
              <ReferenceLine
                key={`thr-${i}`}
                y={l.value}
                stroke="var(--chart-threshold)"
                strokeDasharray="4 4"
                strokeOpacity={0.55}
                label={{
                  value: l.label,
                  position: "insideTopRight",
                  fill: "var(--chart-threshold)",
                  fontSize: 10,
                }}
              />
            ))}
            {isClaims && (
              <ReferenceLine
                y={CLAIMS_RULE_OF_THUMB}
                stroke={AMBER}
                strokeDasharray="5 4"
                strokeOpacity={0.8}
                label={{
                  value: "400k rule of thumb",
                  position: "insideTopRight",
                  fill: "var(--chart-warn)",
                  fontSize: 10,
                }}
              />
            )}
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) => new Date(ts).getFullYear().toString()}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              stroke="var(--chart-axis)"
              minTickGap={50}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              stroke="var(--chart-axis)"
              width={44}
              tickFormatter={axisTick}
              domain={isFearGreed ? [0, 100] : ["auto", "auto"]}
              ticks={isFearGreed ? [0, 25, 45, 55, 75, 100] : undefined}
            />
            <Tooltip
              content={<ChartTooltip unit={metric.unit} />}
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={
                isClaims
                  ? `url(#${gradId})`
                  : isFearGreed
                    ? "var(--chart-neutral-line)"
                    : color
              }
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
            {showMA && hasOverlay && (
              <Line
                data={overlayData}
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        )}
      </div>
    </div>
  );
}
