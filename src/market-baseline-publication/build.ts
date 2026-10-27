import { hashNormalizedContent } from "@/market-baseline-mrr/hash";
import { normalizeTldAsciiLabel, probeReportingPeriodFromAsOf } from "@/market-baseline-mrr/period";
import type { NormalizedTransactionsSnapshot, ReportingPeriod } from "@/market-baseline-mrr/types";
import { previousPeriod, yearAgoPeriod } from "@/market-baseline-mrr/period";
import { snapshotKey, type SnapshotKey } from "./keys";
import { tldShardRelativePath } from "./paths";
import {
  projectAvailableTldPeriod,
  projectMissingTldPeriod,
  projectRegistrarPeriodFacts,
} from "./project";
import type {
  MarketBaselinePublicationIndex,
  MarketBaselinePublicationSemantic,
  MarketBaselineTldShard,
  PublishedTldPeriodFact,
  TldDomainBaseRankEntry,
  TldGrowthRankEntry,
} from "./types";
import {
  MARKET_BASELINE_PUBLICATION_BUILDER_VERSION,
  MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION,
} from "./types";

export type { SnapshotKey } from "./keys";
export { snapshotKey } from "./keys";

export type BuildPublicationInput = {
  asOfDate: string;
  /** Current accepted normalized snapshots keyed by tld@period. */
  snapshots: Map<SnapshotKey, NormalizedTransactionsSnapshot>;
  /**
   * Universe of TLD labels to include in current-period coverage.
   * Defaults to all TLDs present in snapshots.
   */
  universeTlds?: string[];
  /**
   * History periods to materialize per TLD (requested acquisition coverage).
   * Defaults to all periods observed for that TLD in snapshots.
   * Absence of a period from this map means outside publication/acquisition coverage
   * (omit from shard). Explicit MISSING facts are only emitted for listed periods
   * lacking an accepted snapshot.
   */
  historyPeriodsByTld?: Map<string, ReportingPeriod[]>;
  /**
   * Optional acquisition-outcome reasons for requested periods without snapshots.
   * Keyed by tld@period.
   */
  missingReasonsByKey?: Map<SnapshotKey, string>;
  generatedAt?: string;
  /** Nonsemantic acquisition audit (run id / outcomes SHA / scope). */
  acquisitionAudit?: {
    sourceAcquisitionRunId: string;
    sourceOutcomesArtifactSha256: string;
    sourceAcquisitionRunScope?: "FULL_STAGE_D" | "BOUNDED" | "LEGACY_UNKNOWN";
    operationalCurrentRunId?: string | null;
    operationalCurrentDiffersFromGoverning?: boolean;
  };
};

export type BuiltPublication = {
  index: MarketBaselinePublicationIndex;
  shards: MarketBaselineTldShard[];
};

function resolveSnapshot(
  map: Map<SnapshotKey, NormalizedTransactionsSnapshot>,
  tld: string,
  period: ReportingPeriod,
): NormalizedTransactionsSnapshot | null {
  return map.get(snapshotKey(tld, period)) ?? null;
}

function projectFact(
  map: Map<SnapshotKey, NormalizedTransactionsSnapshot>,
  tld: string,
  period: ReportingPeriod,
  missingReasonsByKey?: Map<SnapshotKey, string>,
): PublishedTldPeriodFact {
  const snap = resolveSnapshot(map, tld, period);
  if (!snap) {
    const reason =
      missingReasonsByKey?.get(snapshotKey(tld, period))
      ?? "normalized_snapshot_unavailable";
    return projectMissingTldPeriod(tld, period, reason);
  }
  return projectAvailableTldPeriod({
    snapshot: snap,
    previousSnapshot: resolveSnapshot(map, tld, previousPeriod(period)),
    yearAgoSnapshot: resolveSnapshot(map, tld, yearAgoPeriod(period)),
  });
}

export function buildMarketBaselinePublication(
  input: BuildPublicationInput,
): BuiltPublication {
  const sourceReportingPeriod = probeReportingPeriodFromAsOf(input.asOfDate);
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const tldsFromSnaps = new Set<string>();
  const periodsByTld = new Map<string, Set<ReportingPeriod>>();
  for (const [key, snap] of input.snapshots) {
    const [tld] = key.split("@");
    if (!tld) continue;
    tldsFromSnaps.add(tld);
    let set = periodsByTld.get(tld);
    if (!set) {
      set = new Set();
      periodsByTld.set(tld, set);
    }
    set.add(snap.reportingPeriod);
  }

  const universe = (input.universeTlds ?? [...tldsFromSnaps])
    .map((t) => normalizeTldAsciiLabel(t))
    .sort();

  const currentPeriod: PublishedTldPeriodFact[] = universe.map((tld) =>
    projectFact(
      input.snapshots,
      tld,
      sourceReportingPeriod,
      input.missingReasonsByKey,
    ),
  );

  const availableCurrent = currentPeriod.filter(
    (f): f is Extract<PublishedTldPeriodFact, { availability: "AVAILABLE" }> =>
      f.availability === "AVAILABLE",
  );

  const domainBaseRanking: TldDomainBaseRankEntry[] = [...availableCurrent]
    .sort(
      (a, b) =>
        b.totalDomains - a.totalDomains || a.tldAsciiLabel.localeCompare(b.tldAsciiLabel),
    )
    .map((f, i) => ({
      rank: i + 1,
      tldAsciiLabel: f.tldAsciiLabel,
      totalDomains: f.totalDomains,
      reportingPeriod: f.reportingPeriod,
    }));

  const growthCandidates = availableCurrent.filter(
    (f) => f.monthOverMonthGrowth.available,
  );
  const monthOverMonthGrowthRanking: TldGrowthRankEntry[] = [...growthCandidates]
    .sort((a, b) => {
      const av = a.monthOverMonthGrowth.available ? a.monthOverMonthGrowth.value : -Infinity;
      const bv = b.monthOverMonthGrowth.available ? b.monthOverMonthGrowth.value : -Infinity;
      if (bv !== av) return bv - av;
      return a.tldAsciiLabel.localeCompare(b.tldAsciiLabel);
    })
    .map((f, i) => ({
      rank: i + 1,
      tldAsciiLabel: f.tldAsciiLabel,
      reportingPeriod: f.reportingPeriod,
      monthOverMonthGrowth: f.monthOverMonthGrowth.available
        ? f.monthOverMonthGrowth.value
        : 0,
      totalDomains: f.totalDomains,
    }));

  const shards: MarketBaselineTldShard[] = [];
  const tldHistoryPeriodCounts: Record<string, number> = {};

  for (const tld of universe) {
    const historyPeriods =
      input.historyPeriodsByTld?.get(tld)
      ?? [...(periodsByTld.get(tld) ?? new Set<ReportingPeriod>())].sort().reverse();

    // Always include source period for probe-universe members (requested at probe).
    const periodSet = new Set<ReportingPeriod>([...historyPeriods, sourceReportingPeriod]);
    const ordered = [...periodSet].sort().reverse();

    const periods: Record<ReportingPeriod, PublishedTldPeriodFact> = {};
    const registrarsByPeriod: MarketBaselineTldShard["registrarsByPeriod"] = {};
    let availableHistory = 0;

    for (const period of ordered) {
      const fact = projectFact(
        input.snapshots,
        tld,
        period,
        input.missingReasonsByKey,
      );
      periods[period] = fact;
      if (fact.availability === "AVAILABLE") {
        availableHistory += 1;
        const snap = resolveSnapshot(input.snapshots, tld, period)!;
        registrarsByPeriod[period] = projectRegistrarPeriodFacts(snap);
      }
    }

    tldHistoryPeriodCounts[tld] = availableHistory;
    shards.push({
      schemaVersion: MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION,
      tldAsciiLabel: tld,
      publicationContentSha256: "", // filled after semantic hash
      periods,
      registrarsByPeriod,
    });
  }

  const tldShardPaths = universe.map((t) => tldShardRelativePath(t));

  const semanticWithoutHash: MarketBaselinePublicationSemantic = {
    schemaVersion: MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION,
    builderVersion: MARKET_BASELINE_PUBLICATION_BUILDER_VERSION,
    sourceReportingPeriod,
    coverage: {
      sourceReportingPeriod,
      tldCountInPublication: universe.length,
      availableAtSourcePeriod: availableCurrent.length,
      missingAtSourcePeriod: currentPeriod.length - availableCurrent.length,
      tldHistoryPeriodCounts,
    },
    currentPeriod,
    domainBaseRanking,
    monthOverMonthGrowthRanking,
    tldShardPaths,
  };

  // Shard semantic bodies (without publicationContentSha256) participate in identity.
  const shardSemantics = shards.map((s) => ({
    schemaVersion: s.schemaVersion,
    tldAsciiLabel: s.tldAsciiLabel,
    periods: s.periods,
    registrarsByPeriod: s.registrarsByPeriod,
  }));

  const publicationContentSha256 = hashNormalizedContent({
    index: semanticWithoutHash,
    shards: shardSemantics,
  });

  for (const s of shards) {
    s.publicationContentSha256 = publicationContentSha256;
  }

  const index: MarketBaselinePublicationIndex = {
    semantic: semanticWithoutHash,
    publicationContentSha256,
    generatedAt,
    asOfDate: input.asOfDate,
    sourceAcquisitionRunId: input.acquisitionAudit?.sourceAcquisitionRunId,
    sourceOutcomesArtifactSha256: input.acquisitionAudit?.sourceOutcomesArtifactSha256,
    sourceAcquisitionRunScope: input.acquisitionAudit?.sourceAcquisitionRunScope,
    operationalCurrentRunId: input.acquisitionAudit?.operationalCurrentRunId,
    operationalCurrentDiffersFromGoverning:
      input.acquisitionAudit?.operationalCurrentDiffersFromGoverning,
  };

  return { index, shards };
}
