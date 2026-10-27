import { deriveTldMarketSeriesTemporal } from "@/market-baseline-mrr/series";
import type {
  NormalizedTransactionsSnapshot,
  OptionalMetric,
  ReportingPeriod,
} from "@/market-baseline-mrr/types";
import type {
  PublishedFactProvenance,
  PublishedRegistrarPeriodFact,
  PublishedTldPeriodAvailable,
  PublishedTldPeriodFact,
  PublishedTldPeriodMissing,
} from "./types";

export function provenanceFromSnapshot(
  snapshot: NormalizedTransactionsSnapshot,
): PublishedFactProvenance {
  return {
    sourceSystem: "icann-mrr-transactions",
    sourceUrl: snapshot.sourceUrl,
    rawSha256: snapshot.rawSha256,
    normalizedContentSha256: snapshot.normalizedContentSha256,
    normalizedSchemaVersion: snapshot.schemaVersion,
    parserVersion: snapshot.parserVersion,
    schemaProfileVersion: snapshot.schemaProfileVersion,
  };
}

export function projectAvailableTldPeriod(args: {
  snapshot: NormalizedTransactionsSnapshot;
  previousSnapshot?: NormalizedTransactionsSnapshot | null;
  yearAgoSnapshot?: NormalizedTransactionsSnapshot | null;
}): PublishedTldPeriodAvailable {
  const { snapshot } = args;
  const temporal = deriveTldMarketSeriesTemporal({
    snapshot,
    previousSnapshot: args.previousSnapshot,
    yearAgoSnapshot: args.yearAgoSnapshot,
  });
  return {
    availability: "AVAILABLE",
    tldAsciiLabel: snapshot.tldAsciiLabel,
    reportingPeriod: snapshot.reportingPeriod,
    totalDomains: snapshot.metrics.totalDomains,
    netAddsCount: snapshot.metrics.netAddsCount,
    netRenewCount: snapshot.metrics.netRenewCount,
    deleteCount: snapshot.metrics.deleteCount,
    transferGainingCount: snapshot.metrics.transferGainingCount,
    transferLosingCount: snapshot.metrics.transferLosingCount,
    registrarBreadth: snapshot.metrics.registrarBreadth,
    topRegistrarShare: snapshot.metrics.topRegistrarShare,
    top5RegistrarShare: snapshot.metrics.top5RegistrarShare,
    accreditedRegistrarDomains: snapshot.metrics.accreditedRegistrarDomains,
    specialOrSystemDomains: snapshot.metrics.specialOrSystemDomains,
    netDomainBaseChange: temporal.netDomainBaseChange,
    monthOverMonthGrowth: temporal.monthOverMonthGrowth,
    yearOverYearGrowth: temporal.yearOverYearGrowth,
    provenance: provenanceFromSnapshot(snapshot),
  };
}

export function projectMissingTldPeriod(
  tldAsciiLabel: string,
  reportingPeriod: ReportingPeriod,
  reason = "normalized_snapshot_unavailable",
): PublishedTldPeriodMissing {
  return {
    availability: "MISSING",
    tldAsciiLabel,
    reportingPeriod,
    reason,
  };
}

function shareOfTotal(domains: number, total: number): OptionalMetric {
  if (total === 0) return { available: false, reason: "total_domains_zero" };
  return { available: true, value: domains / total };
}

/** Project registrar grain; excludes TOTALS rows. */
export function projectRegistrarPeriodFacts(
  snapshot: NormalizedTransactionsSnapshot,
): PublishedRegistrarPeriodFact[] {
  const provenance = provenanceFromSnapshot(snapshot);
  const total = snapshot.metrics.totalDomains;
  const rows: PublishedRegistrarPeriodFact[] = [];
  for (const r of snapshot.registrars) {
    if (r.classification === "TOTALS") continue;
    rows.push({
      tldAsciiLabel: snapshot.tldAsciiLabel,
      reportingPeriod: snapshot.reportingPeriod,
      ianaRegistrarId: r.ianaRegistrarId,
      registrarName: r.registrarName,
      classification: r.classification,
      totalDomains: r.totalDomains,
      shareOfTldTotal: shareOfTotal(r.totalDomains, total),
      provenance,
    });
  }
  rows.sort(
    (a, b) =>
      b.totalDomains - a.totalDomains
      || a.ianaRegistrarId.localeCompare(b.ianaRegistrarId),
  );
  return rows;
}

export function assertFactIsNotZeroMissing(fact: PublishedTldPeriodFact): void {
  if (fact.availability === "MISSING") return;
  // Available with totalDomains === 0 is legitimate (empty TLD month), distinct from MISSING.
}
