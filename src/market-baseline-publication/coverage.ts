import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  historyWindowEndingAt,
  normalizeTldAsciiLabel,
  probeReportingPeriodFromAsOf,
} from "@/market-baseline-mrr/period";
import {
  indexPath,
  manifestPath,
  mrrRoot,
  outcomesPath,
} from "@/market-baseline-mrr/storage";
import type {
  AcquisitionOutcome,
  AcquisitionOutcomesArtifact,
  AcquisitionRequestOutcome,
  AcquisitionRunManifest,
  ReportingPeriod,
} from "@/market-baseline-mrr/types";
import { snapshotKey, type SnapshotKey } from "./keys";

/** Subset of MRR indexes/current.json used for publication coverage selection. */
export type MrrArchiveCurrentIndex = {
  latestRunId: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  outcomesArtifactPath: string;
  outcomesArtifactSha256?: string;
};

export type ResolvedAcquisitionCoverage = {
  runId: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  outcomes: AcquisitionOutcomesArtifact;
  /** Probe-phase TLD universe (sorted). */
  probeUniverseTlds: string[];
  /**
   * Periods explicitly requested for each TLD (probe + history),
   * excluding periods outside the publication history window.
   */
  requestedPeriodsByTld: Map<string, ReportingPeriod[]>;
  /** Outcome for each requested tld@period. */
  requestOutcomesByKey: Map<SnapshotKey, AcquisitionRequestOutcome>;
};

export function missingReasonFromOutcome(outcome: AcquisitionOutcome): string {
  return `acquisition_outcome:${outcome}`;
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function loadOutcomesAt(
  cwd: string,
  relativeOrAbsolutePath: string,
): Promise<AcquisitionOutcomesArtifact | null> {
  const path = relativeOrAbsolutePath.startsWith("/")
    ? relativeOrAbsolutePath
    : join(cwd, relativeOrAbsolutePath);
  return readJsonFile<AcquisitionOutcomesArtifact>(path);
}

async function listManifestRunIds(cwd: string): Promise<string[]> {
  const dir = join(mrrRoot(cwd), "manifests");
  try {
    const names = await readdir(dir);
    return names
      .filter((n) => n.endsWith(".json") && !n.endsWith(".outcomes.json"))
      .map((n) => n.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Deterministic acquisition-coverage selection for publication.
 *
 * Rules (documented + tested):
 * 1. If `runId` is provided, use that run's outcomes when probe period matches.
 * 2. Else if `indexes/current.json` points at a run whose probe period matches
 *    the publication source reporting period, use that outcomes artifact.
 * 3. Else among manifests with matching probe period:
 *    - exactly one → use it;
 *    - zero → error (no acquisition evidence);
 *    - multiple → error (ambiguous; pass explicit --run-id).
 */
export async function resolveAcquisitionCoverage(args: {
  cwd: string;
  asOfDate: string;
  historyPeriodCount: number;
  runId?: string;
}): Promise<ResolvedAcquisitionCoverage> {
  const cwd = args.cwd;
  const probeReportingPeriod = probeReportingPeriodFromAsOf(args.asOfDate);
  const historyWindow = new Set(
    historyWindowEndingAt(probeReportingPeriod, args.historyPeriodCount),
  );

  let chosen: AcquisitionOutcomesArtifact | null = null;
  let chosenRunId: string | null = null;

  if (args.runId) {
    const outcomes = await readJsonFile<AcquisitionOutcomesArtifact>(
      outcomesPath(args.runId, cwd),
    );
    if (!outcomes) {
      throw new Error(
        `Publication coverage: outcomes not found for --run-id ${args.runId}`,
      );
    }
    if (outcomes.probeReportingPeriod !== probeReportingPeriod) {
      throw new Error(
        `Publication coverage: run ${args.runId} probe period ${outcomes.probeReportingPeriod} != required ${probeReportingPeriod}`,
      );
    }
    chosen = outcomes;
    chosenRunId = args.runId;
  } else {
    const current = await readJsonFile<MrrArchiveCurrentIndex>(indexPath(cwd));
    if (
      current
      && current.probeReportingPeriod === probeReportingPeriod
      && current.latestRunId
    ) {
      const outcomes =
        (await loadOutcomesAt(cwd, current.outcomesArtifactPath))
        ?? (await readJsonFile<AcquisitionOutcomesArtifact>(
          outcomesPath(current.latestRunId, cwd),
        ));
      if (!outcomes) {
        throw new Error(
          `Publication coverage: current index references missing outcomes for run ${current.latestRunId}`,
        );
      }
      if (outcomes.probeReportingPeriod !== probeReportingPeriod) {
        throw new Error(
          `Publication coverage: outcomes probe period ${outcomes.probeReportingPeriod} mismatches current index ${probeReportingPeriod}`,
        );
      }
      chosen = outcomes;
      chosenRunId = current.latestRunId;
    } else {
      const matches: { runId: string; outcomes: AcquisitionOutcomesArtifact }[] = [];
      for (const runId of await listManifestRunIds(cwd)) {
        const manifest = await readJsonFile<AcquisitionRunManifest>(
          manifestPath(runId, cwd),
        );
        if (!manifest || manifest.probeReportingPeriod !== probeReportingPeriod) {
          continue;
        }
        const outcomes =
          (await loadOutcomesAt(cwd, manifest.outcomesArtifactPath))
          ?? (await readJsonFile<AcquisitionOutcomesArtifact>(
            outcomesPath(runId, cwd),
          ));
        if (!outcomes) continue;
        if (outcomes.probeReportingPeriod !== probeReportingPeriod) continue;
        matches.push({ runId, outcomes });
      }
      if (matches.length === 0) {
        throw new Error(
          `Publication coverage: no MRR acquisition outcomes for probe period ${probeReportingPeriod}. Run market-mrr acquisition or pass --run-id.`,
        );
      }
      if (matches.length > 1) {
        const ids = matches.map((m) => m.runId).join(", ");
        throw new Error(
          `Publication coverage: ambiguous acquisition runs for probe ${probeReportingPeriod}: ${ids}. Pass --run-id to select.`,
        );
      }
      chosen = matches[0]!.outcomes;
      chosenRunId = matches[0]!.runId;
    }
  }

  return materializeCoverage({
    outcomes: chosen,
    runId: chosenRunId!,
    probeReportingPeriod,
    historyWindow,
  });
}

function materializeCoverage(args: {
  outcomes: AcquisitionOutcomesArtifact;
  runId: string;
  probeReportingPeriod: ReportingPeriod;
  historyWindow: Set<ReportingPeriod>;
}): ResolvedAcquisitionCoverage {
  const requestOutcomesByKey = new Map<SnapshotKey, AcquisitionRequestOutcome>();
  const periodsByTld = new Map<string, Set<ReportingPeriod>>();
  const probeTlds = new Set<string>();

  for (const req of args.outcomes.requests) {
    const tld = normalizeTldAsciiLabel(req.tldAsciiLabel);
    const period = req.reportingPeriod;
    const key = snapshotKey(tld, period);

    // Last write wins only if duplicate keys appear; prefer keeping first for stability.
    if (!requestOutcomesByKey.has(key)) {
      requestOutcomesByKey.set(key, { ...req, tldAsciiLabel: tld });
    }

    if (req.phase === "PROBE") {
      if (period !== args.probeReportingPeriod) {
        throw new Error(
          `Publication coverage: PROBE request ${tld}@${period} != outcomes probe ${args.probeReportingPeriod}`,
        );
      }
      probeTlds.add(tld);
      let set = periodsByTld.get(tld);
      if (!set) {
        set = new Set();
        periodsByTld.set(tld, set);
      }
      set.add(period);
      continue;
    }

    if (req.phase === "HISTORY") {
      // Outside publication history window → omit (not acquired-for-this-publication).
      if (!args.historyWindow.has(period)) continue;
      let set = periodsByTld.get(tld);
      if (!set) {
        set = new Set();
        periodsByTld.set(tld, set);
      }
      set.add(period);
    }
  }

  const probeUniverseTlds = [...probeTlds].sort();
  const requestedPeriodsByTld = new Map<string, ReportingPeriod[]>();
  for (const tld of probeUniverseTlds) {
    const set = periodsByTld.get(tld) ?? new Set<ReportingPeriod>();
    // Probe period is always requested for probe-universe members.
    set.add(args.probeReportingPeriod);
    requestedPeriodsByTld.set(
      tld,
      [...set].sort().reverse(),
    );
  }

  // History-only TLDs (should not happen in Stage D; keep periods if present).
  for (const [tld, set] of periodsByTld) {
    if (requestedPeriodsByTld.has(tld)) continue;
    requestedPeriodsByTld.set(tld, [...set].sort().reverse());
  }

  return {
    runId: args.runId,
    asOfDate: args.outcomes.asOfDate,
    probeReportingPeriod: args.probeReportingPeriod,
    outcomes: args.outcomes,
    probeUniverseTlds,
    requestedPeriodsByTld,
    requestOutcomesByKey,
  };
}

export function filterUniverseByAllowlist(
  probeUniverseTlds: string[],
  tldAllowlist: string[] | undefined,
): string[] {
  if (!tldAllowlist?.length) return [...probeUniverseTlds].sort();
  const allow = new Set(tldAllowlist.map((t) => normalizeTldAsciiLabel(t)));
  return probeUniverseTlds.filter((t) => allow.has(t)).sort();
}
