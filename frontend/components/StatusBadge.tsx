import type { Status } from "@/lib/types";
import { STATUS_META } from "@/lib/format";

const TINT: Record<Status, string> = {
  green: "bg-up/10",
  amber: "bg-warn/10",
  red: "bg-down/10",
  unknown: "bg-[var(--text-subtle)]/10",
};

export default function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${TINT[status]} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
