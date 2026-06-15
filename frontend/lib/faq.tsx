import type { ReactNode } from "react";

export interface FaqItem {
  q: string;
  a: ReactNode;
}

// SEO-friendly lead question per metric. Its answer is the metric's
// history_context (supplied by the backend), so search engines can index a
// real question + answer pair for each indicator.
export const FAQ_LEAD: Record<string, string> = {
  jobless_claims:
    "Why do initial jobless claims matter as an early recession indicator?",
  sahm_rule: "What is the Sahm Rule recession indicator and how does it work?",
  hy_credit_spread:
    "Why do high-yield credit spreads (OAS) warn of stock market stress?",
  yield_curve:
    "Why does an inverted 10y–2y Treasury yield curve predict recessions?",
  pmi_proxy:
    "What does the manufacturing PMI say about the business cycle?",
  buffett_indicator:
    "What is the Buffett Indicator and is the stock market overvalued?",
  cape: "What is the Shiller CAPE ratio and is the stock market expensive?",
  vix: "What is the VIX volatility index and what levels signal panic vs a bullish market?",
  fear_greed:
    "What is the CNN Fear & Greed Index and how is it calculated?",
};

// Optional extra Q&A appended after the lead question.
export const METRIC_FAQ: Record<string, FaqItem[]> = {
  jobless_claims: [
    {
      q: "What is the 400k initial jobless claims rule of thumb?",
      a: (
        <>
          400k is a convenient mental anchor but a blunt one. The historical
          record shows the meaningful threshold moves around, sits closer to
          ~434k since the mid-1980s, and is more useful for confirming
          expansion-phase deterioration than for calling recessions. Most
          analysts now lean on the 4-week moving average and on changes relative
          to recent trend rather than any single absolute number.
        </>
      ),
    },
    {
      q: "Where can I read more about initial jobless claims and the economy?",
      a: (
        <a
          href="https://fredblog.stlouisfed.org/2025/05/what-initial-jobless-claims-may-say-about-the-economy/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 underline hover:text-sky-300"
        >
          FRED Blog — What initial jobless claims may say about the economy (May
          2025)
        </a>
      ),
    },
  ],
  vix: [
    {
      q: "What VIX level means the stock market is in panic vs really bullish?",
      a: (
        <>
          As a rule of thumb: a VIX below ~15 reflects a calm, complacent, bullish
          market; 15–20 is normal; 20–30 is elevated/anxious; above 30 signals
          fear; and above 40 is outright panic. The VIX closed near ~80 during the
          2008 financial crisis and ~82 in the March 2020 crash, while extended
          bull markets often see sustained readings in the low teens.
        </>
      ),
    },
  ],
};
