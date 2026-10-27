import { normalizeTldAsciiLabel } from "@/market-baseline-mrr/period";
import {
  loadCurrentPublicationPointer,
  loadPublicationIndex,
  loadTldShard,
} from "@/market-baseline-publication/load";
import {
  verifyPublicationIndexContentSha,
  verifyTldShard,
} from "@/market-baseline-publication/verify";
import type {
  MarketBaselinePublicationIndex,
  PublishedTldPeriodFact,
} from "@/market-baseline-publication/types";
import {
  DATA_METHODOLOGY_HREF,
  absentDetailModel,
  absentOverviewModel,
  formatReportingPeriodLabel,
  formatTldDisplayLabel,
  invalidOverviewModel,
  marketTldHref,
  optionalMetricView,
  shortenSha,
  type RegistryMarketCurrentRow,
  type RegistryMarketDetailModel,
  type RegistryMarketHistoryRow,
  type RegistryMarketOverviewModel,
  type RegistryMarketRegistrarRow,
  REGISTRY_MARKET_SOURCE_SYSTEM_LABEL,
} from "@/lib/market-baseline-ui";

export { DATA_METHODOLOGY_HREF };

function momFromCurrentFact(
  fact: PublishedTldPeriodFact | undefined,
): ReturnType<typeof optionalMetricView> {
  if (!fact || fact.availability !== "AVAILABLE") return null;
  return optionalMetricView(fact.monthOverMonthGrowth);
}

function buildCurrentRows(
  index: MarketBaselinePublicationIndex,
): RegistryMarketCurrentRow[] {
  return index.semantic.currentPeriod.map((fact) => {
    const tld = fact.tldAsciiLabel;
    if (fact.availability === "MISSING") {
      return {
        tldAsciiLabel: tld,
        displayLabel: formatTldDisplayLabel(tld),
        href: marketTldHref(tld),
        availability: "MISSING" as const,
        dataStateLabel: "Report unavailable" as const,
        totalDomains: null,
        monthOverMonthGrowth: null,
        yearOverYearGrowth: null,
        registrarBreadth: null,
        topRegistrarShare: null,
      };
    }
    return {
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
      href: marketTldHref(tld),
      availability: "AVAILABLE" as const,
      dataStateLabel: "Available" as const,
      totalDomains: fact.totalDomains,
      monthOverMonthGrowth: optionalMetricView(fact.monthOverMonthGrowth),
      yearOverYearGrowth: optionalMetricView(fact.yearOverYearGrowth),
      registrarBreadth: fact.registrarBreadth,
      topRegistrarShare: optionalMetricView(fact.topRegistrarShare),
    };
  });
}

function buildOverviewFromIndex(
  index: MarketBaselinePublicationIndex,
): RegistryMarketOverviewModel {
  const period = index.semantic.sourceReportingPeriod;
  const byTld = new Map(
    index.semantic.currentPeriod.map((f) => [f.tldAsciiLabel, f]),
  );

  return {
    status: "READY",
    userMessage: "Registry Market publication loaded.",
    sourceReportingPeriod: period,
    sourcePeriodLabel: formatReportingPeriodLabel(period),
    sourceSystemLabel: REGISTRY_MARKET_SOURCE_SYSTEM_LABEL,
    publicationContentSha256: index.publicationContentSha256,
    publicationShaShort: shortenSha(index.publicationContentSha256),
    coverage: {
      tldCountInPublication: index.semantic.coverage.tldCountInPublication,
      availableAtSourcePeriod: index.semantic.coverage.availableAtSourcePeriod,
      missingAtSourcePeriod: index.semantic.coverage.missingAtSourcePeriod,
    },
    domainBaseRanking: index.semantic.domainBaseRanking.map((row) => ({
      rank: row.rank,
      tldAsciiLabel: row.tldAsciiLabel,
      displayLabel: formatTldDisplayLabel(row.tldAsciiLabel),
      href: marketTldHref(row.tldAsciiLabel),
      totalDomains: row.totalDomains,
      monthOverMonthGrowth: momFromCurrentFact(byTld.get(row.tldAsciiLabel)),
    })),
    monthOverMonthGrowthRanking: index.semantic.monthOverMonthGrowthRanking.map(
      (row) => ({
        rank: row.rank,
        tldAsciiLabel: row.tldAsciiLabel,
        displayLabel: formatTldDisplayLabel(row.tldAsciiLabel),
        href: marketTldHref(row.tldAsciiLabel),
        monthOverMonthGrowth: row.monthOverMonthGrowth,
        totalDomains: row.totalDomains,
      }),
    ),
    currentPeriodRows: buildCurrentRows(index),
  };
}

/**
 * Load Registry Market overview from the current product publication only.
 * Does not scan MRR raw/normalized archives.
 */
export async function loadRegistryMarketOverview(
  cwd = process.cwd(),
): Promise<RegistryMarketOverviewModel> {
  const pointer = await loadCurrentPublicationPointer(cwd);
  if (!pointer) return absentOverviewModel();

  let index: MarketBaselinePublicationIndex;
  try {
    index = await loadPublicationIndex(pointer.publicationContentSha256, cwd);
  } catch {
    return invalidOverviewModel(
      "Registry Market unavailable. The market publication index could not be loaded.",
    );
  }

  if (index.publicationContentSha256 !== pointer.publicationContentSha256) {
    return invalidOverviewModel(
      "Registry Market unavailable. Publication pointer and index identity disagree.",
    );
  }

  const verified = verifyPublicationIndexContentSha(index);
  if (!verified.ok) {
    return invalidOverviewModel(
      "Registry Market unavailable. The market publication failed integrity verification.",
    );
  }

  return buildOverviewFromIndex(index);
}

/**
 * Load a single TLD detail model from the publication (one shard only).
 */
export async function loadRegistryMarketTldDetail(
  rawTld: string,
  cwd = process.cwd(),
): Promise<RegistryMarketDetailModel> {
  let tld: string;
  try {
    tld = normalizeTldAsciiLabel(rawTld);
  } catch {
    return {
      ...absentDetailModel("Requested TLD is not part of the Registry Market baseline."),
      status: "TLD_NOT_FOUND",
      tldAsciiLabel: null,
      displayLabel: null,
    };
  }

  const pointer = await loadCurrentPublicationPointer(cwd);
  if (!pointer) {
    return {
      ...absentDetailModel(),
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
    };
  }

  let index: MarketBaselinePublicationIndex;
  try {
    index = await loadPublicationIndex(pointer.publicationContentSha256, cwd);
  } catch {
    return {
      ...absentDetailModel(
        "Registry Market unavailable. The market publication index could not be loaded.",
      ),
      status: "PUBLICATION_INVALID",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
    };
  }

  const indexOk = verifyPublicationIndexContentSha(index);
  if (
    !indexOk.ok
    || index.publicationContentSha256 !== pointer.publicationContentSha256
  ) {
    return {
      ...absentDetailModel(
        "Registry Market unavailable. The market publication failed integrity verification.",
      ),
      status: "PUBLICATION_INVALID",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
    };
  }

  const inUniverse = index.semantic.currentPeriod.some(
    (f) => f.tldAsciiLabel === tld,
  );
  if (!inUniverse) {
    return {
      ...absentDetailModel("Requested TLD is not part of the Registry Market baseline."),
      status: "TLD_NOT_FOUND",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
      publicationContentSha256: index.publicationContentSha256,
      sourceReportingPeriod: index.semantic.sourceReportingPeriod,
      sourcePeriodLabel: formatReportingPeriodLabel(
        index.semantic.sourceReportingPeriod,
      ),
    };
  }

  const digestEntry = index.semantic.tldShards.find(
    (e) => e.tldAsciiLabel === tld,
  );
  if (!digestEntry) {
    return {
      ...absentDetailModel(
        "Registry Market unavailable. TLD shard digest entry is missing from the publication index.",
      ),
      status: "TLD_SHARD_INVALID",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
      publicationContentSha256: index.publicationContentSha256,
    };
  }

  let shard;
  try {
    shard = await loadTldShard(index.publicationContentSha256, tld, cwd);
  } catch {
    return {
      ...absentDetailModel(
        "Registry Market unavailable. The selected TLD shard could not be loaded.",
      ),
      status: "TLD_SHARD_INVALID",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
      publicationContentSha256: index.publicationContentSha256,
    };
  }

  const shardOk = verifyTldShard({
    shard,
    publicationContentSha256: index.publicationContentSha256,
    indexDigestEntry: digestEntry,
  });
  if (!shardOk.ok) {
    return {
      ...absentDetailModel(
        "Registry Market unavailable. The selected TLD shard failed integrity verification.",
      ),
      status: "TLD_SHARD_INVALID",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
      publicationContentSha256: index.publicationContentSha256,
    };
  }

  const period = index.semantic.sourceReportingPeriod;
  const current = shard.periods[period];
  if (!current) {
    return {
      ...absentDetailModel(
        "Registry Market unavailable. Current-period fact is missing from the TLD shard.",
      ),
      status: "TLD_SHARD_INVALID",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
      publicationContentSha256: index.publicationContentSha256,
    };
  }

  const historyRows: RegistryMarketHistoryRow[] = Object.keys(shard.periods)
    .sort()
    .reverse()
    .map((p) => {
      const fact = shard.periods[p]!;
      if (fact.availability === "MISSING") {
        return {
          reportingPeriod: p,
          periodLabel: formatReportingPeriodLabel(p),
          availability: "MISSING" as const,
          dataStateLabel: "Report unavailable" as const,
          totalDomains: null,
          monthOverMonthGrowth: null,
          yearOverYearGrowth: null,
          netAddsCount: null,
          deleteCount: null,
          registrarBreadth: null,
        };
      }
      return {
        reportingPeriod: p,
        periodLabel: formatReportingPeriodLabel(p),
        availability: "AVAILABLE" as const,
        dataStateLabel: "Available" as const,
        totalDomains: fact.totalDomains,
        monthOverMonthGrowth: optionalMetricView(fact.monthOverMonthGrowth),
        yearOverYearGrowth: optionalMetricView(fact.yearOverYearGrowth),
        netAddsCount: fact.netAddsCount,
        deleteCount: fact.deleteCount,
        registrarBreadth: fact.registrarBreadth,
      };
    });

  const onlySourcePeriod =
    historyRows.length === 1 && historyRows[0]!.reportingPeriod === period;
  const historyNote = onlySourcePeriod
    ? "Historical series was not acquired for this TLD in the Stage-D baseline."
    : null;

  if (current.availability === "MISSING") {
    return {
      status: "MISSING_CURRENT_REPORT",
      userMessage:
        "Report unavailable for this TLD in the source reporting period. A missing report does not mean the TLD has zero domains.",
      tldAsciiLabel: tld,
      displayLabel: formatTldDisplayLabel(tld),
      sourceReportingPeriod: period,
      sourcePeriodLabel: formatReportingPeriodLabel(period),
      sourceSystemLabel: REGISTRY_MARKET_SOURCE_SYSTEM_LABEL,
      publicationContentSha256: index.publicationContentSha256,
      dataStateLabel: "Report unavailable",
      currentAvailability: "MISSING",
      metrics: null,
      historyRows,
      historyNote,
      topAccreditedRegistrars: [],
      specialSystemNote: null,
      provenance: null,
    };
  }

  const regs = shard.registrarsByPeriod[period] ?? [];
  const accredited = regs
    .filter((r) => r.classification === "ACCREDITED_OR_STANDARD")
    .slice(0, 10)
    .map(
      (r): RegistryMarketRegistrarRow => ({
        registrarName: r.registrarName,
        ianaRegistrarId: r.ianaRegistrarId,
        totalDomains: r.totalDomains,
        shareOfTldTotal: optionalMetricView(r.shareOfTldTotal)!,
      }),
    );
  const hasSpecial = regs.some(
    (r) => r.classification === "SPECIAL_REGISTRY_OR_SYSTEM",
  );

  return {
    status: "READY",
    userMessage: "TLD market facts loaded.",
    tldAsciiLabel: tld,
    displayLabel: formatTldDisplayLabel(tld),
    sourceReportingPeriod: period,
    sourcePeriodLabel: formatReportingPeriodLabel(period),
    sourceSystemLabel: REGISTRY_MARKET_SOURCE_SYSTEM_LABEL,
    publicationContentSha256: index.publicationContentSha256,
    dataStateLabel: "Available",
    currentAvailability: "AVAILABLE",
    metrics: {
      totalDomains: current.totalDomains,
      monthOverMonthGrowth: optionalMetricView(current.monthOverMonthGrowth),
      yearOverYearGrowth: optionalMetricView(current.yearOverYearGrowth),
      registrarBreadth: current.registrarBreadth,
      topRegistrarShare: optionalMetricView(current.topRegistrarShare),
      top5RegistrarShare: optionalMetricView(current.top5RegistrarShare),
      accreditedRegistrarDomains: current.accreditedRegistrarDomains,
      specialOrSystemDomains: current.specialOrSystemDomains,
      netAddsCount: current.netAddsCount,
      netRenewCount: current.netRenewCount,
      deleteCount: current.deleteCount,
      transferGainingCount: current.transferGainingCount,
      transferLosingCount: current.transferLosingCount,
    },
    historyRows,
    historyNote,
    topAccreditedRegistrars: accredited,
    specialSystemNote: hasSpecial
      ? "Special/system rows are preserved separately and excluded from registrar breadth."
      : null,
    provenance: {
      sourceSystem: current.provenance.sourceSystem,
      reportingPeriod: period,
      sourceUrl: current.provenance.sourceUrl,
      rawSha256: current.provenance.rawSha256,
      rawShaShort: shortenSha(current.provenance.rawSha256),
      normalizedContentSha256: current.provenance.normalizedContentSha256,
      normalizedShaShort: shortenSha(current.provenance.normalizedContentSha256),
      publicationContentSha256: index.publicationContentSha256,
      publicationShaShort: shortenSha(index.publicationContentSha256),
    },
  };
}
