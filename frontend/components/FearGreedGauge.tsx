// Compact linear Fear & Greed gauge: the 5 CNN zones on a line with a marker
// at today's value. Shown beside the numeric score on the Fear & Greed card.

import { FEAR_GREED_ZONES, fearGreedZone } from "@/lib/sentiment";

export default function FearGreedGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const zone = fearGreedZone(v);

  return (
    <div className="min-w-0 flex-1">
      <div className="relative pt-2">
        {/* marker */}
        <div
          className="absolute top-0 z-10 -translate-x-1/2"
          style={{ left: `${v}%` }}
        >
          <div className="mx-auto h-0 w-0 border-l-4 border-r-4 border-t-[5px] border-l-transparent border-r-transparent border-t-slate-100" />
        </div>
        <div
          className="absolute bottom-0 top-2 z-10 w-px -translate-x-1/2 bg-slate-100/80"
          style={{ left: `${v}%` }}
        />
        {/* segmented bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full">
          {FEAR_GREED_ZONES.map((s) => (
            <div
              key={s.label}
              style={{ width: `${s.max - s.min}%`, backgroundColor: s.color }}
              title={s.label}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: zone.color }}>
          {zone.label}
        </span>
        <span className="text-[9px] text-slate-500">0–100</span>
      </div>
    </div>
  );
}
