// Curated major market episodes — used to highlight and annotate chart regions.
// "kind" drives the tint and whether it reads as a negative or positive episode.

export type EventKind = "recession" | "crash" | "bubble";

export interface MarketEvent {
  name: string;
  start: string; // ISO
  end: string; // ISO
  kind: EventKind;
  note: string;
}

// Desaturated era hues — historical context should tint, not compete with the
// semantic green/amber/red that carry the live signal.
export const EVENT_STYLE: Record<EventKind, { fill: string; label: string }> = {
  recession: { fill: "#c66b78", label: "Recession" }, // dusty rose
  crash: { fill: "#cf9a63", label: "Crash / bear" }, // dusty amber
  bubble: { fill: "#9990c4", label: "Bubble / mania" }, // dusty violet
};

export const MARKET_EVENTS: MarketEvent[] = [
  {
    name: "1973–75 Oil Crisis recession",
    start: "1973-11-01",
    end: "1975-03-01",
    kind: "recession",
    note: "OPEC embargo + stagflation; S&P 500 fell ~48%.",
  },
  {
    name: "Volcker double-dip recession",
    start: "1980-01-01",
    end: "1982-11-01",
    kind: "recession",
    note: "Fed funds pushed toward ~20% to break inflation.",
  },
  {
    name: "Black Monday (1987)",
    start: "1987-09-01",
    end: "1987-12-01",
    kind: "crash",
    note: "Dow −22.6% in a single day; no recession followed.",
  },
  {
    name: "1990–91 recession",
    start: "1990-07-01",
    end: "1991-03-01",
    kind: "recession",
    note: "Gulf War oil spike + the S&L crisis.",
  },
  {
    name: "Dot-com bubble",
    start: "1997-06-01",
    end: "2000-03-01",
    kind: "bubble",
    note: "Tech mania; Shiller CAPE hit a record ~44.",
  },
  {
    name: "Dot-com bust (2001 recession)",
    start: "2001-03-01",
    end: "2001-11-01",
    kind: "recession",
    note: "Nasdaq fell ~78% peak-to-trough into 2002.",
  },
  {
    name: "Global Financial Crisis",
    start: "2007-12-01",
    end: "2009-06-01",
    kind: "recession",
    note: "Housing/credit collapse; S&P −57%, HY OAS >1,500 bps.",
  },
  {
    name: "COVID crash",
    start: "2020-02-01",
    end: "2020-04-30",
    kind: "recession",
    note: "Fastest bear ever; HY OAS ~1,100 bps, claims ~6M/week.",
  },
  {
    name: "2021 “everything” bubble",
    start: "2021-01-01",
    end: "2021-12-31",
    kind: "bubble",
    note: "Meme/crypto/SPAC peak; CAPE ~38, Buffett >200%.",
  },
  {
    name: "2022 bear market",
    start: "2022-01-01",
    end: "2022-10-01",
    kind: "crash",
    note: "Inflation shock + rapid rate hikes; S&P −25%.",
  },
];

/** The event (if any) whose span contains the given timestamp (ms). */
export function eventAt(ts: number): MarketEvent | null {
  for (const e of MARKET_EVENTS) {
    if (ts >= Date.parse(e.start) && ts <= Date.parse(e.end)) return e;
  }
  return null;
}
