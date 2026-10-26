import { previousPeriod, yearAgoPeriod } from "./period";
import type {
  NormalizedTransactionsSnapshot,
  OptionalMetric,
  ReportingPeriod,
  TldMarketSeriesTemporal,
} from "./types";

function growthMetric(current: number, prior: number | null | undefined): OptionalMetric {
  if (prior == null) return { available: false, reason: "prior_period_unavailable" };
  if (prior === 0) return { available: false, reason: "prior_denominator_zero" };
  return { available: true, value: (current - prior) / prior };
}

/**
 * Derive MoM / YoY / net base change from a collection of intrinsic snapshots.
 * Does not bridge missing calendar months.
 */
export function deriveTldMarketSeriesTemporal(args: {
  snapshot: NormalizedTransactionsSnapshot;
  previousSnapshot?: NormalizedTransactionsSnapshot | null;
  yearAgoSnapshot?: NormalizedTransactionsSnapshot | null;
}): TldMarketSeriesTemporal {
  const { snapshot } = args;
  const prevPeriod = previousPeriod(snapshot.reportingPeriod);
  const yoyPeriod = yearAgoPeriod(snapshot.reportingPeriod);

  const prev =
    args.previousSnapshot
    && args.previousSnapshot.tldAsciiLabel === snapshot.tldAsciiLabel
    && args.previousSnapshot.reportingPeriod === prevPeriod
      ? args.previousSnapshot
      : null;
  const yoy =
    args.yearAgoSnapshot
    && args.yearAgoSnapshot.tldAsciiLabel === snapshot.tldAsciiLabel
    && args.yearAgoSnapshot.reportingPeriod === yoyPeriod
      ? args.yearAgoSnapshot
      : null;

  const current = snapshot.metrics.totalDomains;
  const prevDomains = prev?.metrics.totalDomains ?? null;
  const yoyDomains = yoy?.metrics.totalDomains ?? null;

  return {
    tldAsciiLabel: snapshot.tldAsciiLabel,
    reportingPeriod: snapshot.reportingPeriod as ReportingPeriod,
    totalDomains: current,
    previousPeriod: prevPeriod,
    yearAgoPeriod: yoyPeriod,
    netDomainBaseChange:
      prevDomains == null
        ? { available: false, reason: "prior_period_unavailable" }
        : { available: true, value: current - prevDomains },
    monthOverMonthGrowth: growthMetric(current, prevDomains),
    yearOverYearGrowth: growthMetric(current, yoyDomains),
  };
}
