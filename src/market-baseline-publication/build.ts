import { normalizeTldAsciiLabel, probeReportingPeriodFromAsOf } from "@/market-baseline-mrr/period";
import type { NormalizedTransactionsSnapshot, ReportingPeriod } from "@/market-baseline-mrr/types";
import { previousPeriod, yearAgoPeriod } from "@/market-baseline-mrr/period";
import {
  hashPublicationContent,
  hashShardContent,
  shardSemanticFromParts,
  type ShardSemantic,
} from "./hash";
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
  TldShardDigestEntry,
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

/** Compact ranking/coverage inputs retained after per-TLD projection. */
export type ProjectedTldPublicationGrain = {
  tldAsciiLabel: string;
  currentFact: PublishedTldPeriodFact;
  availableHistoryCount: number;
  shardSemantic: ShardSemantic;
  shardContentSha256: string;
  digestEntry: TldShardDigestEntry;
};

function resolveSnapshot(
  map: Map<SnapshotKey, NormalizedTransactionsSnapshot>,
  tld: string,
  period: ReportingPeriod,
): NormalizedTransactionsSnapshot | null {
  return map.get(snapshotKey(tld, period)) ?? null;
}

export function projectFact(
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

/**
 * Project one TLD's shard semantic + compact index contributions.
 * Callers should release the snapshot Map after this returns.
 */
export function projectTldPublicationGrain(args: {
  tldAsciiLabel: string;
  sourceReportingPeriod: ReportingPeriod;
  snapshots: Map<SnapshotKey, NormalizedTransactionsSnapshot>;
  historyPeriods: ReportingPeriod[];
  missingReasonsByKey?: Map<SnapshotKey, string>;
}): ProjectedTldPublicationGrain {
  const tld = normalizeTldAsciiLabel(args.tldAsciiLabel);
  const periodSet = new Set<ReportingPeriod>([
    ...args.historyPeriods,
    args.sourceReportingPeriod,
  ]);
  const ordered = [...periodSet].sort().reverse();

  const periods: Record<ReportingPeriod, PublishedTldPeriodFact> = {};
  const registrarsByPeriod: ShardSemantic["registrarsByPeriod"] = {};
  let availableHistory = 0;

  for (const period of ordered) {
    const fact = projectFact(
      args.snapshots,
      tld,
      period,
      args.missingReasonsByKey,
    );
    periods[period] = fact;
    if (fact.availability === "AVAILABLE") {
      availableHistory += 1;
      const snap = resolveSnapshot(args.snapshots, tld, period)!;
      registrarsByPeriod[period] = projectRegistrarPeriodFacts(snap);
    }
  }

  const shardSemantic = shardSemanticFromParts({
    tldAsciiLabel: tld,
    periods,
    registrarsByPeriod,
  });
  const shardContentSha256 = hashShardContent(shardSemantic);
  const path = tldShardRelativePath(tld);

  return {
    tldAsciiLabel: tld,
    currentFact: periods[args.sourceReportingPeriod]!,
    availableHistoryCount: availableHistory,
    shardSemantic,
    shardContentSha256,
    digestEntry: {
      tldAsciiLabel: tld,
      path,
      shardContentSha256,
    },
  };
}

export function buildRankingsFromCurrentFacts(
  currentPeriod: PublishedTldPeriodFact[],
): {
  availableCurrent: Extract<PublishedTldPeriodFact, { availability: "AVAILABLE" }>[];
  domainBaseRanking: TldDomainBaseRankEntry[];
  monthOverMonthGrowthRanking: TldGrowthRankEntry[];
} {
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

  return { availableCurrent, domainBaseRanking, monthOverMonthGrowthRanking };
}

/** Sort digest manifest canonically (tldAsciiLabel ASC). */
export function sortTldShardDigestManifest(
  entries: TldShardDigestEntry[],
): TldShardDigestEntry[] {
  return [...entries].sort((a, b) => a.tldAsciiLabel.localeCompare(b.tldAsciiLabel));
}

/**
 * Compose publication semantic + content SHA from compact grains.
 * Identity input contains shard digests only — never full shard bodies.
 */
export function composePublicationIdentity(args: {
  sourceReportingPeriod: ReportingPeriod;
  currentPeriod: PublishedTldPeriodFact[];
  tldHistoryPeriodCounts: Record<string, number>;
  digestEntries: TldShardDigestEntry[];
}): {
  semantic: MarketBaselinePublicationSemantic;
  publicationContentSha256: string;
} {
  const { availableCurrent, domainBaseRanking, monthOverMonthGrowthRanking } =
    buildRankingsFromCurrentFacts(args.currentPeriod);
  const tldShards = sortTldShardDigestManifest(args.digestEntries);

  const semantic: MarketBaselinePublicationSemantic = {
    schemaVersion: MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION,
    builderVersion: MARKET_BASELINE_PUBLICATION_BUILDER_VERSION,
    sourceReportingPeriod: args.sourceReportingPeriod,
    coverage: {
      sourceReportingPeriod: args.sourceReportingPeriod,
      tldCountInPublication: args.currentPeriod.length,
      availableAtSourcePeriod: availableCurrent.length,
      missingAtSourcePeriod: args.currentPeriod.length - availableCurrent.length,
      tldHistoryPeriodCounts: args.tldHistoryPeriodCounts,
    },
    currentPeriod: args.currentPeriod,
    domainBaseRanking,
    monthOverMonthGrowthRanking,
    tldShards,
  };

  return {
    semantic,
    publicationContentSha256: hashPublicationContent(semantic),
  };
}

/**
 * In-memory builder for tests / small inputs.
 * Full-archive publication must use the bounded streaming path instead.
 */
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

  const grains: ProjectedTldPublicationGrain[] = [];
  for (const tld of universe) {
    const historyPeriods =
      input.historyPeriodsByTld?.get(tld)
      ?? [...(periodsByTld.get(tld) ?? new Set<ReportingPeriod>())].sort().reverse();
    grains.push(
      projectTldPublicationGrain({
        tldAsciiLabel: tld,
        sourceReportingPeriod,
        snapshots: input.snapshots,
        historyPeriods,
        missingReasonsByKey: input.missingReasonsByKey,
      }),
    );
  }

  // Deterministic index currentPeriod order follows sorted universe (not Map insertion).
  const currentPeriod = grains.map((g) => g.currentFact);
  const tldHistoryPeriodCounts: Record<string, number> = {};
  for (const g of grains) {
    tldHistoryPeriodCounts[g.tldAsciiLabel] = g.availableHistoryCount;
  }

  const { semantic, publicationContentSha256 } = composePublicationIdentity({
    sourceReportingPeriod,
    currentPeriod,
    tldHistoryPeriodCounts,
    digestEntries: grains.map((g) => g.digestEntry),
  });

  const shards: MarketBaselineTldShard[] = grains.map((g) => ({
    schemaVersion: MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION,
    tldAsciiLabel: g.tldAsciiLabel,
    publicationContentSha256,
    shardContentSha256: g.shardContentSha256,
    periods: g.shardSemantic.periods,
    registrarsByPeriod: g.shardSemantic.registrarsByPeriod,
  }));

  const index: MarketBaselinePublicationIndex = {
    semantic,
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
