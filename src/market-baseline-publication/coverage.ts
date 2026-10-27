import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256Hex } from "@/market-baseline-mrr/hash";
import {
  historyWindowEndingAt,
  normalizeTldAsciiLabel,
  probeReportingPeriodFromAsOf,
} from "@/market-baseline-mrr/period";
import {
  indexPath,
  manifestPath,
  mrrRoot,
} from "@/market-baseline-mrr/storage";
import type {
  AcquisitionOutcome,
  AcquisitionOutcomesArtifact,
  AcquisitionRequestOutcome,
  AcquisitionRunManifest,
  OutcomeCountBucket,
  ReportingPeriod,
} from "@/market-baseline-mrr/types";
import { snapshotKey, type SnapshotKey } from "./keys";

/** Subset of MRR indexes/current.json used as operational reference only. */
export type MrrArchiveCurrentIndex = {
  latestRunId: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  outcomesArtifactPath: string;
  outcomesArtifactSha256?: string;
};

export type PublicationAcquisitionAudit = {
  sourceAcquisitionRunId: string;
  sourceOutcomesArtifactSha256: string;
  /** Operational indexes/current.json run when present; may differ from governing. */
  operationalCurrentRunId: string | null;
  operationalCurrentDiffersFromGoverning: boolean;
  /** Whether the selected run auto-qualified as full Stage-D (false for explicit bounded). */
  selectedAsFullQualified: boolean;
};

export type ResolvedAcquisitionCoverage = {
  runId: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  outcomes: AcquisitionOutcomesArtifact;
  outcomesArtifactSha256: string;
  /** Probe-phase TLD universe (sorted). */
  probeUniverseTlds: string[];
  /**
   * Periods explicitly requested for each TLD (probe + history),
   * excluding periods outside the publication history window.
   */
  requestedPeriodsByTld: Map<string, ReportingPeriod[]>;
  /** Outcome for each requested tld@period. */
  requestOutcomesByKey: Map<SnapshotKey, AcquisitionRequestOutcome>;
  audit: PublicationAcquisitionAudit;
};

export type QualificationFailure = {
  runId: string;
  reasons: string[];
};

export function missingReasonFromOutcome(outcome: AcquisitionOutcome): string {
  return `acquisition_outcome:${outcome}`;
}

function sumBucket(bucket: OutcomeCountBucket | undefined): number {
  if (!bucket) return 0;
  return (
    bucket.success
    + bucket.missing
    + bucket.downloadFailed
    + bucket.unsupportedSchema
    + bucket.parseFailed
    + bucket.validationFailed
    + bucket.normalizationFailed
  );
}

function bucketsEqual(a: OutcomeCountBucket, b: OutcomeCountBucket): boolean {
  return (
    a.success === b.success
    && a.missing === b.missing
    && a.downloadFailed === b.downloadFailed
    && a.unsupportedSchema === b.unsupportedSchema
    && a.parseFailed === b.parseFailed
    && a.validationFailed === b.validationFailed
    && a.normalizationFailed === b.normalizationFailed
  );
}

function countBucketFromRequests(
  requests: AcquisitionRequestOutcome[],
  phase: "PROBE" | "HISTORY",
): OutcomeCountBucket {
  const bucket: OutcomeCountBucket = {
    success: 0,
    missing: 0,
    downloadFailed: 0,
    unsupportedSchema: 0,
    parseFailed: 0,
    validationFailed: 0,
    normalizationFailed: 0,
  };
  for (const r of requests) {
    if (r.phase !== phase) continue;
    switch (r.outcome) {
      case "SUCCESS":
        bucket.success += 1;
        break;
      case "MISSING_REPORT":
        bucket.missing += 1;
        break;
      case "DOWNLOAD_FAILED":
        bucket.downloadFailed += 1;
        break;
      case "UNSUPPORTED_SCHEMA":
        bucket.unsupportedSchema += 1;
        break;
      case "PARSE_FAILED":
        bucket.parseFailed += 1;
        break;
      case "VALIDATION_FAILED":
        bucket.validationFailed += 1;
        break;
      case "NORMALIZATION_FAILED":
        bucket.normalizationFailed += 1;
        break;
    }
  }
  return bucket;
}

async function readRawFile(path: string): Promise<Uint8Array | null> {
  try {
    const buf = await readFile(path);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function resolveArtifactPath(cwd: string, relativeOrAbsolutePath: string): string {
  return relativeOrAbsolutePath.startsWith("/")
    ? relativeOrAbsolutePath
    : join(cwd, relativeOrAbsolutePath);
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

async function readManifest(
  cwd: string,
  runId: string,
): Promise<AcquisitionRunManifest | null> {
  try {
    const text = await readFile(manifestPath(runId, cwd), "utf8");
    return JSON.parse(text) as AcquisitionRunManifest;
  } catch {
    return null;
  }
}

async function readCurrentIndex(cwd: string): Promise<MrrArchiveCurrentIndex | null> {
  try {
    const text = await readFile(indexPath(cwd), "utf8");
    return JSON.parse(text) as MrrArchiveCurrentIndex;
  } catch {
    return null;
  }
}

/**
 * Load outcomes bytes, verify SHA against expected, then parse.
 * Fail closed on mismatch.
 */
export async function loadVerifiedOutcomesArtifact(args: {
  cwd: string;
  outcomesArtifactPath: string;
  expectedSha256: string;
}): Promise<{ outcomes: AcquisitionOutcomesArtifact; actualSha256: string; bytes: Uint8Array }> {
  const path = resolveArtifactPath(args.cwd, args.outcomesArtifactPath);
  const bytes = await readRawFile(path);
  if (!bytes) {
    throw new Error(
      `Publication coverage: outcomes artifact missing at ${args.outcomesArtifactPath}`,
    );
  }
  const actualSha256 = sha256Hex(bytes);
  if (actualSha256 !== args.expectedSha256) {
    throw new Error(
      `Publication coverage: outcomes artifact integrity mismatch (expected ${args.expectedSha256}, actual ${actualSha256})`,
    );
  }
  const outcomes = JSON.parse(Buffer.from(bytes).toString("utf8")) as AcquisitionOutcomesArtifact;
  return { outcomes, actualSha256, bytes };
}

export type LoadedRunEvidence = {
  runId: string;
  manifest: AcquisitionRunManifest;
  outcomes: AcquisitionOutcomesArtifact;
  outcomesArtifactSha256: string;
};

/**
 * Load a single run's durable receipt (manifest) + verified outcomes.
 * Used for both explicit and automatic selection paths.
 */
export async function loadRunEvidence(
  cwd: string,
  runId: string,
): Promise<LoadedRunEvidence> {
  const manifest = await readManifest(cwd, runId);
  if (!manifest) {
    throw new Error(`Publication coverage: manifest not found for run ${runId}`);
  }
  if (manifest.runId !== runId) {
    throw new Error(
      `Publication coverage: manifest.runId ${manifest.runId} != requested ${runId}`,
    );
  }
  if (!manifest.outcomesArtifactPath || !manifest.outcomesArtifactSha256) {
    throw new Error(
      `Publication coverage: run ${runId} missing outcomesArtifactPath/outcomesArtifactSha256 receipt fields`,
    );
  }
  const { outcomes, actualSha256 } = await loadVerifiedOutcomesArtifact({
    cwd,
    outcomesArtifactPath: manifest.outcomesArtifactPath,
    expectedSha256: manifest.outcomesArtifactSha256,
  });
  if (outcomes.runId !== manifest.runId) {
    throw new Error(
      `Publication coverage: outcomes.runId ${outcomes.runId} != manifest.runId ${manifest.runId}`,
    );
  }
  if (outcomes.probeReportingPeriod !== manifest.probeReportingPeriod) {
    throw new Error(
      `Publication coverage: outcomes probe period ${outcomes.probeReportingPeriod} != manifest ${manifest.probeReportingPeriod}`,
    );
  }
  return {
    runId,
    manifest,
    outcomes,
    outcomesArtifactSha256: actualSha256,
  };
}

function reconcileRequestDetails(
  manifest: AcquisitionRunManifest,
  outcomes: AcquisitionOutcomesArtifact,
): string[] {
  const reasons: string[] = [];
  const probes = outcomes.requests.filter((r) => r.phase === "PROBE");
  const history = outcomes.requests.filter((r) => r.phase === "HISTORY");
  const probeBucket = countBucketFromRequests(outcomes.requests, "PROBE");
  const historyBucket = countBucketFromRequests(outcomes.requests, "HISTORY");

  if (!bucketsEqual(probeBucket, manifest.probe)) {
    reasons.push("probe outcome detail does not reconcile to manifest.probe");
  }
  if (sumBucket(manifest.probe) !== probes.length) {
    reasons.push("manifest.probe sum != PROBE request count");
  }
  if (!bucketsEqual(historyBucket, manifest.history)) {
    reasons.push("history outcome detail does not reconcile to manifest.history");
  }
  if (sumBucket(manifest.history) !== history.length) {
    reasons.push("manifest.history sum != HISTORY request count");
  }
  if (manifest.filesRequested !== probes.length + history.length) {
    reasons.push(
      `filesRequested ${manifest.filesRequested} != probe+history ${probes.length + history.length}`,
    );
  }
  return reasons;
}

/**
 * Full Stage-D automatic-qualification checks.
 * Explicit `--run-id` uses a lighter integrity/reconciliation gate and may be bounded.
 */
export function evaluateFullStageDQualification(
  evidence: LoadedRunEvidence,
  requiredProbePeriod: ReportingPeriod,
): { ok: true } | { ok: false; reasons: string[] } {
  const { manifest, outcomes } = evidence;
  const reasons: string[] = [];

  if (manifest.probeReportingPeriod !== requiredProbePeriod) {
    reasons.push(
      `probeReportingPeriod ${manifest.probeReportingPeriod} != required ${requiredProbePeriod}`,
    );
  }
  if (manifest.resultStatus === "FAILED" || manifest.resultStatus === "STOPPED_THROTTLED") {
    reasons.push(`resultStatus ${manifest.resultStatus} is not allowed for auto-qualification`);
  } else if (manifest.resultStatus !== "SUCCESS" && manifest.resultStatus !== "PARTIAL") {
    reasons.push(`resultStatus ${manifest.resultStatus} is not allowed for auto-qualification`);
  }

  const probes = outcomes.requests.filter((r) => r.phase === "PROBE");
  const history = outcomes.requests.filter((r) => r.phase === "HISTORY");
  const probeTlds = probes.map((r) => normalizeTldAsciiLabel(r.tldAsciiLabel));
  const distinct = new Set(probeTlds);

  if (probes.length !== manifest.discoveredTldCount) {
    reasons.push(
      `PROBE count ${probes.length} != discoveredTldCount ${manifest.discoveredTldCount}`,
    );
  }
  if (distinct.size !== manifest.discoveredTldCount) {
    reasons.push(
      `distinct PROBE TLDs ${distinct.size} != discoveredTldCount ${manifest.discoveredTldCount}`,
    );
  }
  if (distinct.size !== probes.length) {
    reasons.push("duplicate PROBE TLD identities");
  }
  for (const r of probes) {
    if (r.reportingPeriod !== manifest.probeReportingPeriod) {
      reasons.push(
        `PROBE ${r.tldAsciiLabel}@${r.reportingPeriod} != manifest probe ${manifest.probeReportingPeriod}`,
      );
      break;
    }
  }

  const expectedHistory =
    (manifest.historyUniverse?.length ?? 0) * Math.max(manifest.historyPeriodCount - 1, 0);
  if (history.length !== expectedHistory) {
    reasons.push(
      `HISTORY count ${history.length} != expected ${expectedHistory} (historyUniverse×(historyPeriodCount-1))`,
    );
  }

  reasons.push(...reconcileRequestDetails(manifest, outcomes));

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

/** Integrity + aggregate reconciliation required for any selected run (including explicit). */
export function evaluateSelectedRunIntegrity(
  evidence: LoadedRunEvidence,
  requiredProbePeriod: ReportingPeriod,
): { ok: true } | { ok: false; reasons: string[] } {
  const { manifest, outcomes } = evidence;
  const reasons: string[] = [];
  if (manifest.probeReportingPeriod !== requiredProbePeriod) {
    reasons.push(
      `probeReportingPeriod ${manifest.probeReportingPeriod} != required ${requiredProbePeriod}`,
    );
  }
  for (const r of outcomes.requests.filter((x) => x.phase === "PROBE")) {
    if (r.reportingPeriod !== manifest.probeReportingPeriod) {
      reasons.push(
        `PROBE ${r.tldAsciiLabel}@${r.reportingPeriod} != manifest probe ${manifest.probeReportingPeriod}`,
      );
      break;
    }
  }
  reasons.push(...reconcileRequestDetails(manifest, outcomes));
  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

function assertSameRunCurrentConsistency(
  current: MrrArchiveCurrentIndex,
  evidence: LoadedRunEvidence,
): void {
  if (current.latestRunId !== evidence.runId) {
    throw new Error(
      `Publication coverage: internal error — same-run current check for mismatched run`,
    );
  }
  if (current.probeReportingPeriod !== evidence.manifest.probeReportingPeriod) {
    throw new Error(
      `Publication coverage: current-index probe period ${current.probeReportingPeriod} mismatches governing run ${evidence.manifest.probeReportingPeriod}`,
    );
  }
  if (current.outcomesArtifactPath !== evidence.manifest.outcomesArtifactPath) {
    throw new Error(
      `Publication coverage: current-index outcomes path mismatches governing manifest for run ${evidence.runId}`,
    );
  }
  if (
    current.outcomesArtifactSha256
    && current.outcomesArtifactSha256 !== evidence.manifest.outcomesArtifactSha256
  ) {
    throw new Error(
      `Publication coverage: current-index outcomes SHA mismatches governing manifest for run ${evidence.runId}`,
    );
  }
}

/**
 * Deterministic acquisition-coverage selection for publication.
 *
 * Default (no --run-id):
 * 1. Evaluate all matching-period manifests for full Stage-D qualification
 *    (integrity + probe/history completeness). `indexes/current.json` is not authority.
 * 2. Exactly one full-qualified → use it.
 * 3. Zero or multiple → fail closed (require --run-id).
 *
 * Explicit --run-id:
 * - may be bounded;
 * - still requires manifest + SHA-verified outcomes + aggregate reconciliation.
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
  const current = await readCurrentIndex(cwd);

  let evidence: LoadedRunEvidence;
  let selectedAsFullQualified = false;

  if (args.runId) {
    evidence = await loadRunEvidence(cwd, args.runId);
    const integrity = evaluateSelectedRunIntegrity(evidence, probeReportingPeriod);
    if (!integrity.ok) {
      throw new Error(
        `Publication coverage: explicit run ${args.runId} failed integrity/reconciliation: ${integrity.reasons.join("; ")}`,
      );
    }
    const full = evaluateFullStageDQualification(evidence, probeReportingPeriod);
    selectedAsFullQualified = full.ok;
  } else {
    const candidates: LoadedRunEvidence[] = [];
    const failures: QualificationFailure[] = [];

    for (const runId of await listManifestRunIds(cwd)) {
      const manifest = await readManifest(cwd, runId);
      if (!manifest || manifest.probeReportingPeriod !== probeReportingPeriod) continue;
      if (!manifest.outcomesArtifactPath || !manifest.outcomesArtifactSha256) {
        failures.push({
          runId,
          reasons: ["missing outcomesArtifactPath/outcomesArtifactSha256"],
        });
        continue;
      }
      let loaded: LoadedRunEvidence;
      try {
        loaded = await loadRunEvidence(cwd, runId);
      } catch (e) {
        failures.push({
          runId,
          reasons: [e instanceof Error ? e.message : String(e)],
        });
        continue;
      }
      const qual = evaluateFullStageDQualification(loaded, probeReportingPeriod);
      if (qual.ok) candidates.push(loaded);
      else failures.push({ runId, reasons: qual.reasons });
    }

    if (candidates.length === 0) {
      const detail = failures
        .map((f) => `${f.runId}: ${f.reasons.join("; ")}`)
        .slice(0, 8)
        .join(" | ");
      throw new Error(
        `Publication coverage: no full-qualified acquisition run for probe period ${probeReportingPeriod}. Pass --run-id to select a specific run (including bounded).${detail ? ` Candidates considered: ${detail}` : ""}`,
      );
    }
    if (candidates.length > 1) {
      const ids = candidates.map((c) => c.runId).join(", ");
      throw new Error(
        `Publication coverage: multiple full-qualified acquisition runs for probe ${probeReportingPeriod}: ${ids}. Pass --run-id to select.`,
      );
    }
    evidence = candidates[0]!;
    selectedAsFullQualified = true;
  }

  if (current && current.latestRunId === evidence.runId) {
    assertSameRunCurrentConsistency(current, evidence);
  }

  const operationalCurrentRunId = current?.latestRunId ?? null;
  const operationalCurrentDiffersFromGoverning =
    operationalCurrentRunId != null && operationalCurrentRunId !== evidence.runId;

  return materializeCoverage({
    outcomes: evidence.outcomes,
    runId: evidence.runId,
    outcomesArtifactSha256: evidence.outcomesArtifactSha256,
    probeReportingPeriod,
    historyWindow,
    audit: {
      sourceAcquisitionRunId: evidence.runId,
      sourceOutcomesArtifactSha256: evidence.outcomesArtifactSha256,
      operationalCurrentRunId,
      operationalCurrentDiffersFromGoverning,
      selectedAsFullQualified,
    },
  });
}

function materializeCoverage(args: {
  outcomes: AcquisitionOutcomesArtifact;
  runId: string;
  outcomesArtifactSha256: string;
  probeReportingPeriod: ReportingPeriod;
  historyWindow: Set<ReportingPeriod>;
  audit: PublicationAcquisitionAudit;
}): ResolvedAcquisitionCoverage {
  const requestOutcomesByKey = new Map<SnapshotKey, AcquisitionRequestOutcome>();
  const periodsByTld = new Map<string, Set<ReportingPeriod>>();
  const probeTlds = new Set<string>();

  for (const req of args.outcomes.requests) {
    const tld = normalizeTldAsciiLabel(req.tldAsciiLabel);
    const period = req.reportingPeriod;
    const key = snapshotKey(tld, period);

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
    set.add(args.probeReportingPeriod);
    requestedPeriodsByTld.set(tld, [...set].sort().reverse());
  }

  for (const [tld, set] of periodsByTld) {
    if (requestedPeriodsByTld.has(tld)) continue;
    requestedPeriodsByTld.set(tld, [...set].sort().reverse());
  }

  return {
    runId: args.runId,
    asOfDate: args.outcomes.asOfDate,
    probeReportingPeriod: args.probeReportingPeriod,
    outcomes: args.outcomes,
    outcomesArtifactSha256: args.outcomesArtifactSha256,
    probeUniverseTlds,
    requestedPeriodsByTld,
    requestOutcomesByKey,
    audit: args.audit,
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
