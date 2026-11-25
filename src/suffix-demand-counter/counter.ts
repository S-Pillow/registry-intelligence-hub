import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCandidatesFromApplicationsDocumentPath,
  resolveExampleListCandidates,
  type CandidateMode,
  type ResolvedCandidates,
} from "./candidates";
import { MATCHING_POLICY } from "./match";
import { assertMidPanelCoverage, assertPanelManifest, loadPanelManifest } from "./manifest";
import { streamPanelFile } from "./stream-file";
import { buildSuffixMatchIndex } from "./suffix-trie";
import {
  ACTIVEDNS_SOURCE_NAME,
  ACTIVEDNS_SOURCE_URL,
  SuffixDemandCounterError,
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
  /**
   * Candidate mode:
   * - example-list (default): FORECAST_V1_EXAMPLE_STRINGS / optional overrides
   * - applications-document-v2: forecast-eligible selected/current strings
   * - observed-proposed-strings: all source-backed proposed labels including WDO
   */
  candidateMode?: CandidateMode;
  /** Required for applications-document-v2 and observed-proposed-strings. */
  applicationsDocumentPath?: string;
  /** Override example-list candidates (ignored in document modes). */
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
  const candidateMode: CandidateMode = options.candidateMode ?? "example-list";

  try {
    assertOutputUnderData(outputPath, cwd, options.allowNonDataOutput === true);

    // Fail closed if a prior aggregate occupies the destination — callers should
    // choose a fresh path for one-shot runs.
    try {
      await access(outputPath);
      throw new SuffixDemandCounterError(
        "Output path already exists — refusing to overwrite; choose a fresh .data/ path",
        [outputPath],
      );
    } catch (err) {
      if (err instanceof SuffixDemandCounterError) throw err;
      // ENOENT expected
    }

    const manifest = await loadPanelManifest(manifestPath);
    if (requireMidPanel) assertMidPanelCoverage(manifest);

    const resolved = await resolveCandidates(candidateMode, options, cwd);
    await assertInputFilesExist(inputDir, manifest);

    const matchIndex = buildSuffixMatchIndex(resolved.eligibleLabels);
    const matchCounts = new Map<string, number>(
      resolved.eligibleLabels.map((c) => [c, 0]),
    );
    const files: FileVerification[] = [];

    // Stable TLD order from manifest for deterministic processing/output.
    for (const spec of manifest.panel) {
      const absolutePath = path.join(inputDir, spec.filename);
      const result = await streamPanelFile({
        absolutePath,
        spec,
        snapshotDate: manifest.snapshotDate,
        matchIndex,
        matchCounts,
      });
      files.push(result.verification);
    }

    const aggregate = buildAggregate({
      manifest,
      resolved,
      matchCounts,
      files,
    });

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${stableStringify(aggregate)}\n`, "utf8");

    return { ok: true, aggregate, outputPath };
  } catch (err) {
    const failure = toFailure(err, manifestPath);
    return { ok: false, failure };
  }
}

async function resolveCandidates(
  mode: CandidateMode,
  options: RunSuffixDemandCounterOptions,
  cwd: string,
): Promise<ResolvedCandidates> {
  if (mode === "example-list") {
    return resolveExampleListCandidates(options.candidates);
  }
  if (mode === "applications-document-v2" || mode === "observed-proposed-strings") {
    const docPath = options.applicationsDocumentPath;
    if (!docPath) {
      throw new SuffixDemandCounterError(
        `${mode} mode requires --applications-document <path>`,
      );
    }
    return loadCandidatesFromApplicationsDocumentPath(path.resolve(cwd, docPath), mode);
  }
  throw new SuffixDemandCounterError(`Unknown candidate mode: ${String(mode)}`);
}

export function buildAggregate(options: {
  manifest: PanelManifest;
  resolved: ResolvedCandidates;
  matchCounts: Map<string, number>;
  files: FileVerification[];
}): SuffixDemandAggregate {
  const { manifest, resolved, matchCounts, files } = options;
  const sourceId = `activedns-${manifest.snapshotDate}-panel-${manifest.manifestId}`;
  const census = resolved.provenance.applicationCensusCoverage;
  const coverageNote = [
    "Observed registrable domains from an ActiveDNS mid-panel subset",
    `(${manifest.panel.map((p) => `.${p.tld}`).join(", ")}).`,
    "Observed DNS domains are not equivalent to all registered domains.",
    "Counts are panel-limited suffix-demand evidence only — not full-market registration forecasts.",
    `Candidate provenance: ${resolved.provenance.mode}.`,
    census
      ? `Application census coverage status: ${census.status} (assertsCompleteRoundInventory=false).`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const sourceLabel = `${manifest.sourceName} monthly registrable-domain lists (${manifest.sourceUrl})`;
  const attribution =
    "Domain list provided by ActiveDNS — https://activedns.net/. Derived aggregate suffix-demand counts only; raw lists are not redistributed.";

  const observedByLabel = new Map(
    resolved.observedCandidates.map((c) => [c.stringLabel, c] as const),
  );
  const contestedByUnit = new Map(
    resolved.eligibleUnits.map((u) => [u.stringLabel, u.contested] as const),
  );

  const strings: StringDemandCount[] = resolved.eligibleLabels.map((stringLabel) => {
    const domainCount = matchCounts.get(stringLabel) ?? 0;
    const observed = observedByLabel.get(stringLabel);
    const contested =
      observed !== undefined
        ? observed.contestedObserved
        : (contestedByUnit.get(stringLabel) ?? null);

    return {
      stringLabel,
      domainCount,
      contested,
      brandExcluded: false,
      brandDesignationObserved: observed?.brandDesignationObserved ?? null,
      measurementStatus: "measured",
      origins: observed?.origins,
      fromNormalizedApplication: observed?.fromNormalizedApplication,
      fromKnownExcluded: observed?.fromKnownExcluded,
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

  const applicationCensusStatus = census?.status ?? "not-applicable";

  return {
    schemaVersion: 3,
    status: "complete",
    domainScan: {
      status: "complete",
      referencePanelTlds: manifest.panel.map((p) => p.tld),
      filesVerified: files.length,
    },
    applicationCensus: {
      status: applicationCensusStatus,
      assertsCompleteRoundInventory: false,
      note:
        applicationCensusStatus === "partial-observed"
          ? "Domain-scan status=complete does not imply a complete ICANN application census. Candidate inventory is observed/partial source-backed proposed strings only."
          : applicationCensusStatus === "not-applicable"
            ? "No application-census claim applies for this candidate mode."
            : "Application census fields are recorded; assertsCompleteRoundInventory remains false unless independently certified elsewhere.",
    },
    sourceName: manifest.sourceName || ACTIVEDNS_SOURCE_NAME,
    sourceUrl: manifest.sourceUrl || ACTIVEDNS_SOURCE_URL,
    attribution,
    snapshotDate: manifest.snapshotDate,
    manifestId: manifest.manifestId,
    sourceId,
    referencePanelTlds: manifest.panel.map((p) => p.tld),
    candidateProvenance: resolved.provenance,
    matching: { ...MATCHING_POLICY },
    files: files.map((f) => ({
      ...f,
      path: f.filename,
    })),
    processing,
    strings,
    unmeasuredStrings: resolved.unmeasuredCandidates,
    limitations: [
      "ActiveDNS publishes observed registrable domains, not complete registry zone files.",
      "This mid-panel excludes .com and other large TLDs; counts understate broader suffix demand.",
      "Matching is a literal ASCII equals/endsWith heuristic on the second-level label, not semantic analysis.",
      "Duplicate suppression assumes each ActiveDNS list file is sorted; unsorted input fails closed.",
      "Collection coverage and observation windows are those of ActiveDNS; gaps are expected.",
      "Do not treat these counts as year-four registration forecasts, launch eligibility, open-registration policy, or full-market coverage.",
      ...(resolved.provenance.mode === "example-list"
        ? [
            "Example-list mode uses FORECAST_V1_EXAMPLE_STRINGS only and is not a complete 2026 round inventory.",
          ]
        : []),
      ...(resolved.provenance.mode === "applications-document-v2"
        ? [
            "applications-document-v2 mode excludes confirmed Brand-designated forecast units via the existing Brand proxy and omits knownExcluded-only strings such as WDO.",
          ]
        : []),
      ...(resolved.provenance.mode === "observed-proposed-strings"
        ? [
            "observed-proposed-strings mode measures source-backed proposed labels including knownExcluded primary strings (e.g. WDO) and Brand-designated strings; it does not assert a complete application census.",
            "Unknown Brand/selection/contention attributes remain null — not inferred false.",
            "Unmeasured labels (e.g. Unicode without A-label) are listed separately and are not silent zeros.",
          ]
        : []),
    ],
    forecastConversion: {
      applied: false,
      reason:
        "Panel-limited observed suffix-demand counts are not automatically converted into registration forecasts.",
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
      schemaVersion: 3,
      status: "failed",
      reason: err.message,
      manifestId: null,
      details: err.details,
    };
  }
  return {
    schemaVersion: 3,
    status: "failed",
    reason: err instanceof Error ? err.message : String(err),
    manifestId: null,
    details: [`manifestPath=${manifestPath}`],
  };
}

export { assertPanelManifest, loadPanelManifest, assertMidPanelCoverage };
