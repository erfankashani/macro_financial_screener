export type Status = "green" | "amber" | "red" | "unknown";

export interface Observation {
  date: string; // ISO date
  value: number;
}

export interface RecessionPeriod {
  start: string;
  end: string;
}

export interface MetricDetail {
  id: string;
  name: string;
  unit: string;
  latest_value: number | null;
  as_of: string | null;
  status: Status;
  meaning: string;
  source: string;
  series: Observation[];
  recessions: RecessionPeriod[];
  thresholds: Record<string, number>;
  history_context: string;
  overlay: Observation[];
  overlay_label: string | null;
}

export interface Snapshot {
  generated_at: string;
  metrics: MetricDetail[];
}
