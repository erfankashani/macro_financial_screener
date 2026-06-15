// Shared Fear & Greed zone definitions (used by the gauge and the chart hue bands).

export interface FearGreedZone {
  label: string;
  min: number;
  max: number;
  color: string;
}

export const FEAR_GREED_ZONES: FearGreedZone[] = [
  { label: "Extreme Fear", min: 0, max: 25, color: "#ef4444" },
  { label: "Fear", min: 25, max: 45, color: "#f97316" },
  { label: "Neutral", min: 45, max: 55, color: "#eab308" },
  { label: "Greed", min: 55, max: 75, color: "#84cc16" },
  { label: "Extreme Greed", min: 75, max: 100, color: "#22c55e" },
];

export function fearGreedZone(v: number): FearGreedZone {
  return FEAR_GREED_ZONES.find((z) => v < z.max) ?? FEAR_GREED_ZONES[FEAR_GREED_ZONES.length - 1];
}
