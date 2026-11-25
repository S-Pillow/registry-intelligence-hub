import { createHash } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { FORECAST_V1_EXAMPLE_STRINGS } from "@/lib/registration-forecast";
import { MATCHING_POLICY, normalizeAsciiLabel } from "./match";
import { loadAuthoritative2026Candidates } from "./candidate-source";
import { createSuffixMatcher } from "./suffix-matcher";
import { assertMidPanelCoverage, assertPanelManifest, loadPanelManifest } from "./manifest";
import { streamPanelFile } from "./stream-file";
import {
  ACTIVEDNS_SOURCE_NAME,
  ACTIVEDNS_SOURCE_URL,
  SuffixDemandCounterError,
  type CandidateProvenance,
  type CounterFailure,
  type FileVerification,
  type PanelManifest,
  type StringDemandCount,
  type SuffixDemandAggregate,
} from "./types";

export type RunSuffixDemandCounterOptions = {
  /** Directory containing the gzip panel files named in the manifest. */
  inputDir: string;
  /** Path to the panel manifest JSON. */
  manifestPath: string;
  /**
   * Destination JSON path. Must resolve under `.data/` unless
   * `allowNonDataOutput` is set (tests only).
   */
  outputPath: string;
  /** Explicit local authoritative RegistryApplicationsDocumentV2 JSON snapshot. */
  applicationsDocumentPath?: string;
  /** Override candidates (defaults to FORECAST_V1_EXAMPLE_STRINGS). Tests/dev only. */
  candidates?: readonly string[];
  /** Require exact mid-panel TLD coverage (default true). */
  requireMidPanel?: boolean;
  /** Test-only escape hatch for writing outside `.data/`. */
  allowNonDataOutput?: boolean;
  cwd?: string;
};

export type RunSuffixDemandCounterResult =
  | { ok: true; aggregate: SuffixDemandAggregate; outputPath: string }
  | { ok: false; failure: CounterFailure };

export async function runSuffixDemandCounter(
  options: RunSuffixDemandCounterOptions,
): Promise<RunSuffixDemandCounterResult> {
  const cwd = options.cwd ?? process.cwd();
  const inputDir = path.resolve(cwd, options.inputDir);
  const manifestPath = path.resolve(cwd, options.manifestPath);
  const outputPath = path.resolve(cwd, options.outputPath);
  const requireMidPanel = options.requireMidPanel !== false;
  const tempPath = `${outputPath}.tmp-${process.pid}`;
  let outputAuthorized = false;

  try {
    assertOutputUnderData(outputPath, cwd, options.allowNonDataOutput === true);
    outputAuthorized = true;
    // Never leave a previously successful aggregate at the path after a failed rerun.
    await rm(outputPath, { force: true });
    await rm(tempPath, { force: true });

    if (options.applicationsDocumentPath && options.candidates) {
      throw new SuffixDemandCounterError(
        "Cannot combine authoritative applications-document mode with explicit candidates",
      );
    }
    const manifest = await loadPanelManifest(manifestPath);
    if (requireMidPanel) assertMidPanelCoverage(manifest);

    const source = options.applicationsDocumentPath
      ? await loadAuthoritative2026Candidates(path.resolve(cwd, options.applicationsDocumentPath))
      : null;
    const candidates = normalizeCandidates(
      source?.labels ?? options.candidates ?? FORECAST_V1_EXAMPLE_STRINGS,
    );
    const candidateProvenance: CandidateProvenance = source
      ? source.provenance
      : {
          mode: options.candidates ? "explicit-list" : "examples",
          candidateListId: options.candidates
            ? "explicit-candidate-list"
            : "FORECAST_V1_EXAMPLE_STRINGS",
          candidateListSha256: createHash("sha256").update(candidates.join("\n")).digest("hex"),
          candidateCount: candidates.length,
          excludedBrandStrings: 0,
          brandExclusionPolicy: "Not applied to prototype/example candidate lists",
          applicationSnapshot: null,
        };
    await assertInputFilesExist(inputDir, manifest);

    const matcher = createSuffixMatcher(candidates);
    const matchCounts = new Map<string, number>(candidates.map((c) => [c, 0]));
    const files: FileVerification[] = [];

    // Stable TLD order from manifest for deterministic processing/output.
    for (const spec of manifest.panel) {
      const absolutePath = path.join(inputDir, spec.filename);
      const result = await streamPanelFile({
        absolutePath,
        spec,
        snapshotDate: manifest.snapshotDate,
        matcher,
        matchCounts,
      });
      files.push(result.verification);
    }

    const aggregate = buildAggregate({
      manifest,
      candidates,
      matchCounts,
      files,
      candidateProvenance,
    });

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(tempPath, `${stableStringify(aggregate)}\n`, "utf8");
    await rename(tempPath, outputPath);

    return { ok: true, aggregate, outputPath };
  } catch (err) {
    if (outputAuthorized) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      await rm(outputPath, { force: true }).catch(() => undefined);
    }
    const failure = toFailure(err, manifestPath);
    return { ok: false, failure };
  }
}

export function buildAggregate(options: {
  manifest: PanelManifest;
  candidates: readonly string[];
  matchCounts: Map<string, number>;
  files: FileVerification[];
  candidateProvenance: CandidateProvenance;
}): SuffixDemandAggregate {
  const { manifest, candidates, matchCounts, files, candidateProvenance } = options;
  const sourceId = `activedns-${manifest.snapshotDate}-panel-${manifest.manifestId}` +
    (candidateProvenance.mode === "applications-document-v2"
      ? `-candidates-${candidateProvenance.candidateListSha256.slice(0, 12)}`
      : "");
  const coverageNote = [
    "Observed registrable domains from an ActiveDNS mid-panel subset",
    `(${manifest.panel.map((p) => `.${p.tld}`).join(", ")}).`,
    "Observed DNS domains are not equivalent to all registered domains.",
    "Counts are panel-limited suffix-demand evidence only — not full-market registration forecasts.",
  ].join(" ");

  const sourceLabel = `${manifest.sourceName} monthly registrable-domain lists (${manifest.sourceUrl})`;
  const attribution =
    "Domain list provided by ActiveDNS — https://activedns.net/. Derived aggregate suffix-demand counts only; raw lists are not redistributed.";

  const strings: StringDemandCount[] = candidates.map((stringLabel) => {
    const domainCount = matchCounts.get(stringLabel) ?? 0;
    return {
      stringLabel,
      domainCount,
      suffixDemandEvidence: {
        status: "available",
        domainCount,
        sourceId,
        sourceLabel,
        coverageNote,
      },
    };
  });

  const processing = {
    acceptedRecords: files.reduce((n, f) => n + f.acceptedRecords, 0),
    rejectedRecords: files.reduce((n, f) => n + f.rejectedRecords, 0),
    duplicateRecords: files.reduce((n, f) => n + f.duplicateRecords, 0),
    headerLines: files.reduce((n, f) => n + f.headerLines, 0),
  };

  return {
    schemaVersion: 1,
    status: "complete",
    sourceName: manifest.sourceName || ACTIVEDNS_SOURCE_NAME,
    sourceUrl: manifest.sourceUrl || ACTIVEDNS_SOURCE_URL,
    attribution,
    snapshotDate: manifest.snapshotDate,
    manifestId: manifest.manifestId,
    sourceId,
    candidateProvenance,
    referencePanelTlds: manifest.panel.map((p) => p.tld),
    matching: { ...MATCHING_POLICY },
    files: files.map((f) => ({
      ...f,
      // Drop absolute host paths from the committed-shape aggregate for portability
      // in tests; retain basename-relative identity via filename.
      path: f.filename,
    })),
    processing,
    strings,
    limitations: [
      "ActiveDNS publishes observed registrable domains, not complete registry zone files.",
      "This mid-panel excludes .com and other large TLDs; counts understate broader suffix demand.",
      "Matching is a literal ASCII equals/endsWith heuristic on the second-level label, not semantic analysis.",
      "Collection coverage and observation windows are those of ActiveDNS; gaps are expected.",
      "Do not treat these counts as year-four registration forecasts or apply conversion factors silently.",
    ],
    forecastConversion: {
      applied: false,
      reason:
        "Panel-limited observed suffix-demand counts are not automatically converted into registration forecasts in RIH-FCAST-03.",
    },
  };
}

/** Deterministic JSON with sorted object keys. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortValue(obj[key]);
    }
    return out;
  }
  return value;
}

function normalizeCandidates(candidates: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const normalized = normalizeAsciiLabel(raw);
    if (!normalized) {
      throw new SuffixDemandCounterError(`Invalid candidate string: ${JSON.stringify(raw)}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (!out.length) {
    throw new SuffixDemandCounterError("Candidate string list is empty");
  }
  return out;
}

async function assertInputFilesExist(inputDir: string, manifest: PanelManifest): Promise<void> {
  const missing: string[] = [];
  for (const spec of manifest.panel) {
    const filePath = path.join(inputDir, spec.filename);
    try {
      await access(filePath);
    } catch {
      missing.push(filePath);
    }
  }
  if (missing.length) {
    throw new SuffixDemandCounterError(
      "Panel input is incomplete — refusing to emit zero/available evidence",
      missing.map((p) => `missing file: ${p}`),
    );
  }
}

function assertOutputUnderData(outputPath: string, cwd: string, allowNonDataOutput: boolean): void {
  if (allowNonDataOutput) return;
  const dataRoot = path.resolve(cwd, ".data");
  const resolved = path.resolve(outputPath);
  if (resolved !== dataRoot && !resolved.startsWith(`${dataRoot}${path.sep}`)) {
    throw new SuffixDemandCounterError(
      "Evidence output must be written under the ignored .data/ directory",
      [`outputPath=${resolved}`, `requiredPrefix=${dataRoot}`],
    );
  }
}

function toFailure(err: unknown, manifestPath: string): CounterFailure {
  if (err instanceof SuffixDemandCounterError) {
    return {
      schemaVersion: 1,
      status: "failed",
      reason: err.message,
      manifestId: null,
      details: err.details,
    };
  }
  return {
    schemaVersion: 1,
    status: "failed",
    reason: err instanceof Error ? err.message : String(err),
    manifestId: null,
    details: [`manifestPath=${manifestPath}`],
  };
}

export { assertPanelManifest, loadPanelManifest, assertMidPanelCoverage };
