// Dependency-free SVG radar — an at-a-glance "risk shape" across all signals.
// Each axis is one metric; the spoke length is its severity (calm -> warning),
// so a calm market draws a small blob and a stressed one bulges outward.
// Points are colored by each metric's semantic status.

export interface RadarPoint {
  label: string;
  value: number; // 1 = calm, 2 = caution, 3 = warning
  color: string; // semantic status hex
}

const MAX = 3;

export default function RadarChart({
  data,
  size = 230,
  levels = 3,
}: {
  data: RadarPoint[];
  size?: number;
  levels?: number;
}) {
  const n = data.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 34; // leave room for axis labels

  // Axis i points start-up then clockwise.
  const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  const ringPath = (r: number) =>
    data
      .map((_, i) => {
        const p = pt(i, r);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const dataPath =
    data
      .map((d, i) => {
        const p = pt(i, (Math.max(0, Math.min(MAX, d.value)) / MAX) * radius);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="overflow-visible"
      role="img"
      aria-label="Risk radar across all signals"
    >
      {/* concentric webs */}
      {Array.from({ length: levels }).map((_, l) => (
        <path
          key={`ring-${l}`}
          d={ringPath(((l + 1) / levels) * radius)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
          strokeOpacity={0.7}
        />
      ))}

      {/* spokes */}
      {data.map((_, i) => {
        const p = pt(i, radius);
        return (
          <line
            key={`spoke-${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--border)"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        );
      })}

      {/* severity polygon */}
      <path
        d={dataPath}
        fill="var(--accent)"
        fillOpacity={0.12}
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeOpacity={0.7}
      />

      {/* status-colored points */}
      {data.map((d, i) => {
        const p = pt(i, (Math.max(0, Math.min(MAX, d.value)) / MAX) * radius);
        return (
          <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3.5} fill={d.color} />
        );
      })}

      {/* axis labels */}
      {data.map((d, i) => {
        const p = pt(i, radius + 12);
        const a = angle(i);
        const anchor =
          Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
        return (
          <text
            key={`lbl-${i}`}
            x={p.x}
            y={p.y}
            dy="0.32em"
            textAnchor={anchor}
            fill="var(--text-subtle)"
            fontSize={9}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
