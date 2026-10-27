import {
  historyWindowEndingAt,
  previousPeriod,
  probeReportingPeriodFromAsOf,
  yearAgoPeriod,
} from "@/market-baseline-mrr/period";
import { readNormalizedForPeriod, readPeriodCurrent } from "@/market-baseline-mrr/storage";
import type { NormalizedTransactionsSnapshot, ReportingPeriod } from "@/market-baseline-mrr/types";
import {
  composePublicationIdentity,
  projectTldPublicationGrain,
  type SnapshotKey,
} from "./build";
import {
  filterUniverseByAllowlist,
  missingReasonFromOutcome,
  resolveAcquisitionCoverage,
} from "./coverage";
import { snapshotKey } from "./keys";
import type { MarketBaselinePublicationIndex, PublishedTldPeriodFact } from "./types";
import {
  cleanupPublicationStaging,
  createPublicationStagingDir,
  finalizePublicationFromStaging,
  writeStagedShardSemantic,
  type FinalizePublicationOptions,
} from "./write";

export type LoadArchiveOptions = {
  cwd?: string;
  asOfDate: string;
  /** Limit TLDs to a subset of the accepted probe universe (smoke / tests). */
  tldAllowlist?: string[];
  /** History window length ending at probe (default 24). Filters requested history. */
  historyPeriodCount?: number;
  /** Explicit acquisition run id when archive coverage would otherwise be ambiguous. */
  runId?: string;
  generatedAt?: string;
  /** Test-only finalization hooks. */
  finalizeOptions?: FinalizePublicationOptions;
};

export type ArchivePublicationResult = {
  index: MarketBaselinePublicationIndex;
  contentSha256: string;
  indexPath: string;
  shardPaths: string[];
  currentPointerPath: string;
};

/**
 * Load current accepted normalized snapshots for a bounded TLD set.
 * Full-universe publication must call this per-TLD (or small batches), never for all TLDs at once.
 */
export async function loadCurrentSnapshotsFromArchive(args: {
  cwd: string;
  tlds: string[];
  periodsByTld: Map<string, ReportingPeriod[]>;
}): Promise<Map<SnapshotKey, NormalizedTransactionsSnapshot>> {
  const map = new Map<SnapshotKey, NormalizedTransactionsSnapshot>();
  for (const tld of args.tlds) {
    const periods = args.periodsByTld.get(tld) ?? [];
    for (const period of periods) {
      const current = await readPeriodCurrent(tld, period, args.cwd);
      if (!current) continue;
      const snap = await readNormalizedForPeriod(tld, period, args.cwd);
      if (!snap) continue;
      if (snap.normalizedContentSha256 !== current.currentNormalizedSha256) {
        throw new Error(
          `Period current mismatch for ${tld}/${period}: pointer ${current.currentNormalizedSha256} != snapshot ${snap.normalizedContentSha256}`,
        );
      }
      if (snap.rawSha256 !== current.currentRawSha256) {
        throw new Error(
          `Period current raw mismatch for ${tld}/${period}: pointer ${current.currentRawSha256} != snapshot ${snap.rawSha256}`,
        );
      }
      map.set(snapshotKey(tld, period), snap);
    }
  }
  return map;
}

/**
 * Bounded-memory full-archive publication.
 *
 * Pass 1: per TLD — load only that TLD's snapshots, project, hash shard, stage, retain compact grains.
 * Pass 2: compose publication identity from digests, materialize finals, commit pointer last.
 *
 * Does not retain all shard bodies or all snapshots in memory simultaneously.
 */
export async function publishFromMrrArchive(
  options: LoadArchiveOptions,
): Promise<ArchivePublicationResult> {
  const cwd = options.cwd ?? process.cwd();
  const asOfDate = options.asOfDate;
  const probe = probeReportingPeriodFromAsOf(asOfDate);
  const historyCount = options.historyPeriodCount ?? 24;
  void historyWindowEndingAt(probe, historyCount);

  const coverage = await resolveAcquisitionCoverage({
    cwd,
    asOfDate,
    historyPeriodCount: historyCount,
    runId: options.runId,
  });

  const universeTlds = filterUniverseByAllowlist(
    coverage.probeUniverseTlds,
    options.tldAllowlist,
  ).slice().sort();

  const { stagingDir } = await createPublicationStagingDir(cwd);

  const currentPeriod: PublishedTldPeriodFact[] = [];
  const tldHistoryPeriodCounts: Record<string, number> = {};
  const digestEntries = [];

  try {
    for (const tld of universeTlds) {
      const historyPeriods =
        coverage.requestedPeriodsByTld.get(tld) ?? [probe];

      // Load only this TLD's working set (requested periods + temporal priors).
      const periodsNeeded = new Set<ReportingPeriod>(historyPeriods);
      periodsNeeded.add(probe);
      for (const period of [...periodsNeeded]) {
        periodsNeeded.add(previousPeriod(period));
        periodsNeeded.add(yearAgoPeriod(period));
      }

      const periodsByTld = new Map<string, ReportingPeriod[]>([
        [tld, [...periodsNeeded]],
      ]);
      const snapshots = await loadCurrentSnapshotsFromArchive({
        cwd,
        tlds: [tld],
        periodsByTld,
      });

      const missingReasonsByKey = new Map<SnapshotKey, string>();
      for (const period of historyPeriods) {
        const key = snapshotKey(tld, period);
        if (snapshots.has(key)) continue;
        const req = coverage.requestOutcomesByKey.get(key);
        if (req) {
          missingReasonsByKey.set(key, missingReasonFromOutcome(req.outcome));
        }
      }
      // Probe period missing reason
      {
        const key = snapshotKey(tld, probe);
        if (!snapshots.has(key)) {
          const req = coverage.requestOutcomesByKey.get(key);
          if (req) {
            missingReasonsByKey.set(key, missingReasonFromOutcome(req.outcome));
          }
        }
      }

      const grain = projectTldPublicationGrain({
        tldAsciiLabel: tld,
        sourceReportingPeriod: probe,
        snapshots,
        historyPeriods,
        missingReasonsByKey,
      });

      await writeStagedShardSemantic({
        stagingDir,
        tldAsciiLabel: grain.tldAsciiLabel,
        shardContentSha256: grain.shardContentSha256,
        semantic: grain.shardSemantic,
      });

      currentPeriod.push(grain.currentFact);
      tldHistoryPeriodCounts[grain.tldAsciiLabel] = grain.availableHistoryCount;
      digestEntries.push(grain.digestEntry);
      // snapshots / grain.shardSemantic released at end of iteration (no retained Map of all TLDs).
    }

    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const { semantic, publicationContentSha256 } = composePublicationIdentity({
      sourceReportingPeriod: probe,
      currentPeriod,
      tldHistoryPeriodCounts,
      digestEntries,
    });

    const index: MarketBaselinePublicationIndex = {
      semantic,
      publicationContentSha256,
      generatedAt,
      asOfDate,
      sourceAcquisitionRunId: coverage.audit.sourceAcquisitionRunId,
      sourceOutcomesArtifactSha256: coverage.audit.sourceOutcomesArtifactSha256,
      sourceAcquisitionRunScope: coverage.audit.sourceAcquisitionRunScope,
      operationalCurrentRunId: coverage.audit.operationalCurrentRunId,
      operationalCurrentDiffersFromGoverning:
        coverage.audit.operationalCurrentDiffersFromGoverning,
    };

    const written = await finalizePublicationFromStaging({
      cwd,
      stagingDir,
      index,
      options: options.finalizeOptions,
    });

    return {
      index,
      contentSha256: written.contentSha256,
      indexPath: written.indexPath,
      shardPaths: written.shardPaths,
      currentPointerPath: written.currentPointerPath,
    };
  } catch (err) {
    await cleanupPublicationStaging(stagingDir).catch(() => undefined);
    throw err;
  }
}
