import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { historyWindowEndingAt, probeReportingPeriodFromAsOf } from "@/market-baseline-mrr/period";
import { mrrRoot, readNormalizedForPeriod, readPeriodCurrent } from "@/market-baseline-mrr/storage";
import type { NormalizedTransactionsSnapshot, ReportingPeriod } from "@/market-baseline-mrr/types";
import {
  buildMarketBaselinePublication,
  snapshotKey,
  type BuildPublicationInput,
  type BuiltPublication,
  type SnapshotKey,
} from "./build";

export type LoadArchiveOptions = {
  cwd?: string;
  asOfDate: string;
  /** Limit TLDs (smoke / tests). */
  tldAllowlist?: string[];
  /** History window length ending at probe (default 24). */
  historyPeriodCount?: number;
  generatedAt?: string;
};

async function listPeriodIndexTlds(cwd: string): Promise<string[]> {
  const dir = join(mrrRoot(cwd), "indexes", "periods");
  try {
    const names = await readdir(dir);
    return names.filter((n) => !n.startsWith(".")).sort();
  } catch {
    return [];
  }
}

/**
 * Load current accepted normalized snapshots from the MRR archive
 * (explicit period-current pointers only — never lexical hash selection).
 */
export async function loadCurrentSnapshotsFromArchive(args: {
  cwd: string;
  tlds: string[];
  periods: ReportingPeriod[];
}): Promise<Map<SnapshotKey, NormalizedTransactionsSnapshot>> {
  const map = new Map<SnapshotKey, NormalizedTransactionsSnapshot>();
  for (const tld of args.tlds) {
    for (const period of args.periods) {
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
  const historyWindow = historyWindowEndingAt(probe, historyCount);

  let tlds = await listPeriodIndexTlds(cwd);
  if (options.tldAllowlist?.length) {
    const allow = new Set(options.tldAllowlist.map((t) => t.toLowerCase()));
    tlds = tlds.filter((t) => allow.has(t));
  }

  const historyPeriodsByTld = new Map<string, ReportingPeriod[]>();
  for (const tld of tlds) {
    // Full window so MISSING months remain distinguishable from zero.
    historyPeriodsByTld.set(tld, historyWindow);
  }

  const snapshots = await loadCurrentSnapshotsFromArchive({
    cwd,
    tlds,
    periods: historyWindow,
  });

  const input: BuildPublicationInput = {
    asOfDate,
    snapshots,
    universeTlds: tlds,
    historyPeriodsByTld,
    generatedAt: options.generatedAt,
  };

  const built = buildMarketBaselinePublication(input);
  return { ...built, input };
}
