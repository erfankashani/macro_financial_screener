// Dependency-free SVG radar — an at-a-glance "risk shape" for the selected
// section. The full web of every signal stays put so shapes are comparable, but
// only the active section's signals carry a value and color; the rest collapse
// to the center (no contribution) and dim out.

export interface RadarPoint {
  label: string;
  value: number; // 1 = calm, 2 = caution, 3 = warning; 0 when inactive
  color: string; // semantic status hex
  active: boolean;
}

const MAX = 3;

export default function RadarChart({
  data,
  size = 280,
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
  const radius = size / 2 - 36; // leave room for axis labels

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

  const valuePt = (i: number, d: RadarPoint) =>
    pt(i, (Math.max(0, Math.min(MAX, d.value)) / MAX) * radius);

  const dataPath =
    data
      .map((d, i) => {
        const p = valuePt(i, d);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height={size}
      style={{ maxWidth: size }}
      className="overflow-visible"
      role="img"
      aria-label="Risk radar for the selected section"
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

      {/* spokes — dimmer for inactive signals */}
      {data.map((d, i) => {
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
            strokeOpacity={d.active ? 0.6 : 0.25}
          />
        );
      })}

      {/* active-section shape */}
      <path
        d={dataPath}
        fill="var(--accent)"
        fillOpacity={0.12}
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeOpacity={0.7}
      />

      {/* points — only active signals are plotted, in their status color */}
      {data.map((d, i) => {
        if (!d.active) return null;
        const p = valuePt(i, d);
        return (
          <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3.5} fill={d.color} />
        );
      })}

      {/* axis labels — active full, inactive dimmed */}
      {data.map((d, i) => {
        const p = pt(i, radius + 13);
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
            fill={d.active ? "var(--text-muted)" : "var(--text-subtle)"}
            fillOpacity={d.active ? 1 : 0.45}
            fontSize={9}
            fontWeight={d.active ? 600 : 400}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
