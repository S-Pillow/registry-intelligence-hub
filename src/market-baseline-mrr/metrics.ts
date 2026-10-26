import { isBreadthEligible } from "./classify";
import type {
  NormalizedRegistrarRow,
  NormalizedTotals,
  OptionalMetric,
  TermCounts,
  TldMonthMetrics,
} from "./types";

export function emptyTermCounts(): TermCounts {
  return {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
  };
}

export function sumTermCounts(a: TermCounts, b: TermCounts): TermCounts {
  const out = emptyTermCounts();
  for (const k of Object.keys(out) as (keyof TermCounts)[]) {
    out[k] = a[k] + b[k];
  }
  return out;
}

export function sumTermValues(t: TermCounts): number {
  let n = 0;
  for (const k of Object.keys(t) as (keyof TermCounts)[]) n += t[k];
  return n;
}

export function computeTldMonthMetrics(args: {
  totals: NormalizedTotals;
  registrars: NormalizedRegistrarRow[];
  previousTotalDomains?: number | null;
  yearAgoTotalDomains?: number | null;
}): TldMonthMetrics {
  const { totals, registrars } = args;
  const eligible = registrars.filter((r) => isBreadthEligible(r.classification, r.totalDomains));
  const specialOrSystemDomains = registrars
    .filter((r) => r.classification === "SPECIAL_REGISTRY_OR_SYSTEM")
    .reduce((a, r) => a + r.totalDomains, 0);
  const accreditedRegistrarDomains = eligible.reduce((a, r) => a + r.totalDomains, 0);

  const totalDomains = totals.totalDomains;
  let topRegistrarShare: OptionalMetric;
  let top5RegistrarShare: OptionalMetric;
  if (totalDomains === 0 || eligible.length === 0) {
    const reason =
      totalDomains === 0 ? "total_domains_zero" : "no_eligible_accredited_registrars";
    topRegistrarShare = { available: false, reason };
    top5RegistrarShare = { available: false, reason };
  } else {
    const sorted = [...eligible].sort((a, b) => {
      if (b.totalDomains !== a.totalDomains) return b.totalDomains - a.totalDomains;
      return a.ianaRegistrarId.localeCompare(b.ianaRegistrarId);
    });
    topRegistrarShare = {
      available: true,
      value: sorted[0]!.totalDomains / totalDomains,
    };
    const top5 = sorted.slice(0, 5).reduce((a, r) => a + r.totalDomains, 0);
    top5RegistrarShare = { available: true, value: top5 / totalDomains };
  }

  // Temporal placeholders filled by normalize.ts once priors known
  const unavailable: OptionalMetric = { available: false, reason: "prior_period_unavailable" };

  return {
    totalDomains,
    netAddsCount: sumTermValues(totals.netAddsByTerm),
    netRenewCount: sumTermValues(totals.netRenewsByTerm),
    deleteCount: totals.deletedDomainsGrace + totals.deletedDomainsNograce,
    transferGainingCount: totals.transferGainingSuccessful,
    transferLosingCount: totals.transferLosingSuccessful,
    registrarBreadth: eligible.length,
    topRegistrarShare,
    top5RegistrarShare,
    accreditedRegistrarDomains,
    specialOrSystemDomains,
    netDomainBaseChange: unavailable,
    monthOverMonthGrowth: unavailable,
    yearOverYearGrowth: unavailable,
  };
}
