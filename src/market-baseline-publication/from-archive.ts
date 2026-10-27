import { historyWindowEndingAt, probeReportingPeriodFromAsOf } from "@/market-baseline-mrr/period";
import { readNormalizedForPeriod, readPeriodCurrent } from "@/market-baseline-mrr/storage";
import type { NormalizedTransactionsSnapshot, ReportingPeriod } from "@/market-baseline-mrr/types";
import {
  buildMarketBaselinePublication,
  type BuildPublicationInput,
  type BuiltPublication,
  type SnapshotKey,
} from "./build";
import {
  filterUniverseByAllowlist,
  missingReasonFromOutcome,
  resolveAcquisitionCoverage,
} from "./coverage";
import { snapshotKey } from "./keys";

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
};

/**
 * Load current accepted normalized snapshots from the MRR archive
 * (explicit period-current pointers only — never lexical hash selection).
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
      // Fail closed if pointer and snapshot disagree on identity
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

export async function publishFromMrrArchive(
  options: LoadArchiveOptions,
): Promise<BuiltPublication & { input: BuildPublicationInput }> {
  const cwd = options.cwd ?? process.cwd();
  const asOfDate = options.asOfDate;
  const probe = probeReportingPeriodFromAsOf(asOfDate);
  const historyCount = options.historyPeriodCount ?? 24;
  // Ensure window helper remains exercised for CLI bounds (coverage uses same window).
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
  );

  const historyPeriodsByTld = new Map<string, ReportingPeriod[]>();
  for (const tld of universeTlds) {
    historyPeriodsByTld.set(
      tld,
      coverage.requestedPeriodsByTld.get(tld) ?? [probe],
    );
  }

  const snapshots = await loadCurrentSnapshotsFromArchive({
    cwd,
    tlds: universeTlds,
    periodsByTld: historyPeriodsByTld,
  });

  const missingReasonsByKey = new Map<SnapshotKey, string>();
  for (const tld of universeTlds) {
    for (const period of historyPeriodsByTld.get(tld) ?? []) {
      const key = snapshotKey(tld, period);
      if (snapshots.has(key)) continue;
      const req = coverage.requestOutcomesByKey.get(key);
      if (req) {
        missingReasonsByKey.set(key, missingReasonFromOutcome(req.outcome));
      }
    }
  }

  const input: BuildPublicationInput = {
    asOfDate,
    snapshots,
    universeTlds,
    historyPeriodsByTld,
    missingReasonsByKey,
    generatedAt: options.generatedAt,
    acquisitionAudit: {
      sourceAcquisitionRunId: coverage.audit.sourceAcquisitionRunId,
      sourceOutcomesArtifactSha256: coverage.audit.sourceOutcomesArtifactSha256,
      sourceAcquisitionRunScope: coverage.audit.sourceAcquisitionRunScope,
      operationalCurrentRunId: coverage.audit.operationalCurrentRunId,
      operationalCurrentDiffersFromGoverning:
        coverage.audit.operationalCurrentDiffersFromGoverning,
    },
  };

  const built = buildMarketBaselinePublication(input);
  return { ...built, input };
}
