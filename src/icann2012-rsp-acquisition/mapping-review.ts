import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { sha256Hex } from "@/normalization/hashes";
import {
  loadRevealDayApplicationIds,
  reconcileCanonicalMapping,
  ROUND_WIDE_APPLICATION_COUNT,
} from "./canonical-reconciliation";
import {
  mappingLiveCheckpointPath,
  readMappingLiveCheckpoint,
} from "./mapping-checkpoint";
import { buildMappingArtifactFromCheckpoint } from "./mapping-live";
import {
  stagingIndexPageFetchMetadataPath,
  stagingIndexPageHtmlPath,
  stagingMappingArtifactPath,
} from "./bundle-paths";
import { assertAllowedGtldresultRequestUrl, NetworkTargetPolicyError } from "./network-target-policy";
import { loadPilotManifest, loadRspMappingArtifact } from "./load-manifest";
import { REGRESSION_MAPPING_LEADS } from "./synthetic-replay-corpus";
import {
  classifyMappingReviewFailure,
  type MappingReviewFailureClassification,
} from "./mapping-review-failure-classification";
import type { IndexPageFetchMetadataRecord } from "./fetch-metadata-contract";
import type { MappingLiveCheckpoint, Registry2012RspMappingArtifact } from "./types";

const FORBIDDEN_PERSISTED_SUBSTRINGS = ["set-cookie", "jsessionid", "csrf", "cookie:"] as const;

export interface MappingRunLayout {
  stagingRoot: string;
  runId: string;
  checkpointPath: string;
  checkpoint: MappingLiveCheckpoint;
  artifactPath: string;
}

export interface PilotReviewRow {
  applicationId: string;
  gtldresultAcId: number | null;
  resolved: boolean;
  validationLeadProviderLabel?: string;
}

export interface ValidationLeadCheck {
  label: keyof typeof REGRESSION_MAPPING_LEADS;
  applicationId: string;
  expectedGtldresultAcId: number;
  actualGtldresultAcId: number | null;
  matched: boolean;
}

export interface MappingReviewReport {
  reviewVersion: "registry-hub-rsp-mapping-review-report/1.0.0";
  runId: string;
  mappingArtifactPath: string;
  mappingArtifactSha256: string;
  artifactPurpose: string;
  approvalState: string;
  corpusContentHash: string;
  corpusPinValid: boolean;
  expectedApplicationCount: number;
  mappedCount: number;
  missingApplicationIds: string[];
  extraApplicationIds: string[];
  duplicateApplicationIds: string[];
  duplicateGtldresultAcIds: Array<{ gtldresultAcId: number; applicationIds: string[] }>;
  pageSnapshotCount: number;
  failedPageOrdinals: number[];
  quarantinedPageOrdinals: number[];
  stopReason?: string;
  roundWideExact: boolean;
  pilotResolvedCount: number;
  pilotExpectedCount: number;
  pilotRows: PilotReviewRow[];
  validationLeadsMatched: boolean;
  validationLeadChecks: ValidationLeadCheck[];
  pilotOnlyExactCandidate: boolean;
  failureClassification: MappingReviewFailureClassification;
  integrityFailures: string[];
  mappingReviewPass: boolean;
  reviewHold: boolean;
  reviewHoldReasons: string[];
  checkpointConsistentWithArtifact: boolean;
  paginationDiagnosticsConsistent: boolean;
}

export interface MappingReviewOptions {
  workspaceRoot: string;
  runDir: string;
}

export async function resolveMappingRunLayout(runDir: string): Promise<MappingRunLayout> {
  const stagingRoot = runDir.replace(/\/$/, "");
  const checkpointPath = mappingLiveCheckpointPath(stagingRoot);
  let checkpoint = await readMappingLiveCheckpoint(checkpointPath);

  if (!checkpoint) {
    const mappingRoot = join(stagingRoot, "registry-2012-rsp-mapping");
    const runs = await readdir(mappingRoot).catch(() => [] as string[]);
    if (runs.length !== 1) {
      throw new Error(
        "No mapping-live-checkpoint.json and cannot infer runId — pass a completed staging run",
      );
    }
    const runId = runs[0]!;
    checkpoint = {
      checkpointVersion: "icann2012-rsp-mapping-live-checkpoint/1.0.0",
      runId,
      corpusContentHash: APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
      state: "failed",
      lastCompletedPageOrdinal: 0,
      pages: [],
      mappings: {},
      applicationPageOrdinal: {},
    };
  }

  const artifactPath = stagingMappingArtifactPath(stagingRoot, checkpoint.runId);
  return { stagingRoot, runId: checkpoint.runId, checkpointPath, checkpoint, artifactPath };
}

function findDuplicateApplicationIdsInArtifact(
  artifact: Registry2012RspMappingArtifact,
): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const entry of artifact.entries) {
    if (seen.has(entry.applicationId)) dups.push(entry.applicationId);
    seen.add(entry.applicationId);
  }
  return [...new Set(dups)].sort();
}

function serializedHasForbiddenSessionMaterial(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PERSISTED_SUBSTRINGS.some((needle) => lower.includes(needle));
}

async function validatePageSnapshots(input: {
  stagingRoot: string;
  runId: string;
  checkpoint: MappingLiveCheckpoint;
  artifact: Registry2012RspMappingArtifact;
}): Promise<{
  integrityFailures: string[];
  failedPageOrdinals: number[];
  quarantinedPageOrdinals: number[];
  paginationDiagnosticsConsistent: boolean;
  htmlStructureDrift: boolean;
  paginationDrift: boolean;
}> {
  const integrityFailures: string[] = [];
  const failedPageOrdinals: number[] = [];
  const quarantinedPageOrdinals: number[] = [];
  let paginationDiagnosticsConsistent = true;
  let htmlStructureDrift = false;
  let paginationDrift = false;

  const pageBySnapshot = new Map(input.checkpoint.pages.map((p) => [p.snapshotId, p]));

  for (const entry of artifactEntriesWithAcId(input.artifact)) {
    const snapId = entry.evidenceSnapshotId?.trim();
    if (!snapId) {
      integrityFailures.push(`${entry.applicationId}: missing evidenceSnapshotId`);
      continue;
    }
    const page = pageBySnapshot.get(snapId);
    if (!page) {
      integrityFailures.push(`${entry.applicationId}: unknown evidenceSnapshotId ${snapId}`);
      continue;
    }

    const htmlPath = stagingIndexPageHtmlPath(input.stagingRoot, input.runId, page.pageOrdinal);
    const metaPath = stagingIndexPageFetchMetadataPath(
      input.stagingRoot,
      input.runId,
      page.pageOrdinal,
    );

    let htmlBytes: Buffer;
    try {
      htmlBytes = await readFile(htmlPath);
    } catch {
      integrityFailures.push(`Missing snapshot HTML for page ${page.pageOrdinal}`);
      failedPageOrdinals.push(page.pageOrdinal);
      continue;
    }

    const htmlSha = sha256Hex(htmlBytes);
    if (htmlSha !== page.contentSha256) {
      integrityFailures.push(
        `Page ${page.pageOrdinal} HTML SHA mismatch (checkpoint vs bytes)`,
      );
      failedPageOrdinals.push(page.pageOrdinal);
    }
    if (entry.evidenceContentSha256 && entry.evidenceContentSha256 !== page.contentSha256) {
      integrityFailures.push(
        `${entry.applicationId}: artifact evidenceContentSha256 mismatch`,
      );
    }

    let metaText: string;
    try {
      metaText = await readFile(metaPath, "utf8");
    } catch {
      integrityFailures.push(`Missing fetch metadata for page ${page.pageOrdinal}`);
      failedPageOrdinals.push(page.pageOrdinal);
      continue;
    }

    if (serializedHasForbiddenSessionMaterial(metaText)) {
      integrityFailures.push(`Forbidden session/cookie material in ${metaPath}`);
    }

    const meta = JSON.parse(metaText) as IndexPageFetchMetadataRecord;
    if (meta.contentSha256 !== page.contentSha256) {
      integrityFailures.push(`Page ${page.pageOrdinal} metadata SHA mismatch`);
      paginationDrift = true;
    }

    if (meta.parsedRowCount !== page.diagnostics.parsedRowCount) {
      paginationDiagnosticsConsistent = false;
      paginationDrift = true;
    }
    if (meta.displayStart !== page.diagnostics.displayStart) {
      paginationDiagnosticsConsistent = false;
      paginationDrift = true;
    }
    if (meta.displayEnd !== page.diagnostics.displayEnd) {
      paginationDiagnosticsConsistent = false;
      paginationDrift = true;
    }
    if (meta.displayTotal !== page.diagnostics.displayTotal) {
      paginationDiagnosticsConsistent = false;
      paginationDrift = true;
    }
    if ((meta.nextPageHref ?? null) !== (page.diagnostics.nextPageHref ?? null)) {
      paginationDiagnosticsConsistent = false;
      paginationDrift = true;
    }

    if (page.diagnostics.quarantinedBlockCount > 0) {
      quarantinedPageOrdinals.push(page.pageOrdinal);
      htmlStructureDrift = true;
    }
  }

  for (const entry of artifactEntriesWithAcId(input.artifact)) {
    const sourceUrl = entry.sourceUrl?.trim() ?? "";
    if (!sourceUrl) {
      integrityFailures.push(`${entry.applicationId}: empty sourceUrl`);
      continue;
    }
    try {
      assertAllowedGtldresultRequestUrl(sourceUrl);
    } catch (err) {
      integrityFailures.push(
        `${entry.applicationId}: ${
          err instanceof NetworkTargetPolicyError ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    integrityFailures,
    failedPageOrdinals: [...new Set(failedPageOrdinals)].sort((a, b) => a - b),
    quarantinedPageOrdinals: [...new Set(quarantinedPageOrdinals)].sort((a, b) => a - b),
    paginationDiagnosticsConsistent,
    htmlStructureDrift,
    paginationDrift,
  };
}

function artifactEntriesWithAcId(artifact: Registry2012RspMappingArtifact) {
  return artifact.entries.filter((e) => e.gtldresultAcId != null);
}

function buildValidationLeadChecks(
  mapping: Map<string, number | null>,
): { checks: ValidationLeadCheck[]; matched: boolean } {
  const checks: ValidationLeadCheck[] = [];
  for (const [label, lead] of Object.entries(REGRESSION_MAPPING_LEADS) as Array<
    [keyof typeof REGRESSION_MAPPING_LEADS, (typeof REGRESSION_MAPPING_LEADS)[keyof typeof REGRESSION_MAPPING_LEADS]]
  >) {
    const actual = mapping.get(lead.applicationId) ?? null;
    checks.push({
      label,
      applicationId: lead.applicationId,
      expectedGtldresultAcId: lead.gtldresultAcId,
      actualGtldresultAcId: actual,
      matched: actual === lead.gtldresultAcId,
    });
  }
  return { checks, matched: checks.every((c) => c.matched) };
}

function reconcilePilotExact(
  pilotApplicationIds: readonly string[],
  mapping: Map<string, number>,
): boolean {
  for (const id of pilotApplicationIds) {
    if (!mapping.has(id)) return false;
  }
  const pilotMap = new Map<string, number>();
  for (const id of pilotApplicationIds) {
    pilotMap.set(id, mapping.get(id)!);
  }
  return reconcileCanonicalMapping(pilotApplicationIds, pilotMap).exact;
}

export async function runMappingReview(options: MappingReviewOptions): Promise<MappingReviewReport> {
  const layout = await resolveMappingRunLayout(options.runDir);
  const artifactBytes = await readFile(layout.artifactPath);
  const mappingArtifactSha256 = sha256Hex(artifactBytes);
  const artifact = await loadRspMappingArtifact(layout.artifactPath);

  const expectedIds = await loadRevealDayApplicationIds(options.workspaceRoot);
  if (expectedIds.length !== ROUND_WIDE_APPLICATION_COUNT) {
    throw new Error(
      `Application corpus pin mismatch: expected ${ROUND_WIDE_APPLICATION_COUNT}, got ${expectedIds.length}`,
    );
  }

  const mapping = new Map<string, number>();
  for (const entry of artifact.entries) {
    if (entry.gtldresultAcId != null) mapping.set(entry.applicationId, entry.gtldresultAcId);
  }

  const reconciliation = reconcileCanonicalMapping(expectedIds, mapping);
  const duplicateApplicationIds = findDuplicateApplicationIdsInArtifact(artifact);

  const snapshotValidation = await validatePageSnapshots({
    stagingRoot: layout.stagingRoot,
    runId: layout.runId,
    checkpoint: layout.checkpoint,
    artifact,
  });

  const rebuilt = buildMappingArtifactFromCheckpoint(layout.checkpoint);
  const checkpointConsistentWithArtifact =
    JSON.stringify(rebuilt.entries) === JSON.stringify(artifact.entries);

  if (!checkpointConsistentWithArtifact) {
    snapshotValidation.integrityFailures.push(
      "Checkpoint mappings/pages do not match committed mapping.json artifact",
    );
  }

  const corpusPinValid = layout.checkpoint.corpusContentHash === APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH;
  if (!corpusPinValid) {
    snapshotValidation.integrityFailures.push("Corpus content hash pin mismatch on checkpoint");
  }

  const manifest = await loadPilotManifest(options.workspaceRoot);
  const pilotExpectedCount = manifest.entries.length;
  const pilotRows: PilotReviewRow[] = manifest.entries.map((entry) => {
    const fromArtifact = artifact.entries.find((e) => e.applicationId === entry.applicationId);
    const acId =
      fromArtifact?.gtldresultAcId ??
      (entry.gtldresultAcId != null ? entry.gtldresultAcId : null);
    return {
      applicationId: entry.applicationId,
      gtldresultAcId: acId,
      resolved: acId != null,
      validationLeadProviderLabel: entry.validationLeadProviderLabel,
    };
  });
  const pilotResolvedCount = pilotRows.filter((r) => r.resolved).length;

  const leadMapping = new Map<string, number | null>(
    artifact.entries.map((e) => [e.applicationId, e.gtldresultAcId]),
  );
  const { checks: validationLeadChecks, matched: validationLeadsMatched } =
    buildValidationLeadChecks(leadMapping);

  const pilotOnlyExactCandidate =
    !reconciliation.exact &&
    reconcilePilotExact(
      manifest.entries.map((e) => e.applicationId),
      mapping,
    );

  const reviewHoldReasons: string[] = [];
  if (!validationLeadsMatched) {
    reviewHoldReasons.push("Validation lead gtldresultAcId assertion mismatch");
  }

  const integrityFailures = snapshotValidation.integrityFailures;
  const roundWideExact = reconciliation.exact && artifact.scope === "ROUND_WIDE_EXACT";

  const failureClassification = classifyMappingReviewFailure({
    reconciliationExact: reconciliation.exact,
    integrityFailure: integrityFailures.length > 0 || !checkpointConsistentWithArtifact,
    paginationDrift: snapshotValidation.paginationDrift,
    htmlStructureDrift: snapshotValidation.htmlStructureDrift,
    stopReason: layout.checkpoint.stopReason,
    checkpointState: layout.checkpoint.state,
  });

  const mappingReviewPass =
    corpusPinValid &&
    integrityFailures.length === 0 &&
    checkpointConsistentWithArtifact &&
    snapshotValidation.paginationDiagnosticsConsistent &&
    duplicateApplicationIds.length === 0 &&
    validationLeadsMatched;

  const reviewHold = reviewHoldReasons.length > 0 || !mappingReviewPass;

  return {
    reviewVersion: "registry-hub-rsp-mapping-review-report/1.0.0",
    runId: layout.runId,
    mappingArtifactPath: layout.artifactPath,
    mappingArtifactSha256,
    artifactPurpose: artifact.artifactPurpose,
    approvalState: artifact.approvalState,
    corpusContentHash: layout.checkpoint.corpusContentHash,
    corpusPinValid,
    expectedApplicationCount: reconciliation.expectedCount,
    mappedCount: reconciliation.mappedCount,
    missingApplicationIds: reconciliation.missingApplicationIds,
    extraApplicationIds: reconciliation.extraApplicationIds,
    duplicateApplicationIds,
    duplicateGtldresultAcIds: reconciliation.duplicateGtldresultAcIds,
    pageSnapshotCount: layout.checkpoint.pages.length,
    failedPageOrdinals: snapshotValidation.failedPageOrdinals,
    quarantinedPageOrdinals: snapshotValidation.quarantinedPageOrdinals,
    stopReason: layout.checkpoint.stopReason,
    roundWideExact,
    pilotResolvedCount,
    pilotExpectedCount,
    pilotRows,
    validationLeadsMatched,
    validationLeadChecks,
    pilotOnlyExactCandidate,
    failureClassification,
    integrityFailures,
    mappingReviewPass,
    reviewHold,
    reviewHoldReasons,
    checkpointConsistentWithArtifact,
    paginationDiagnosticsConsistent: snapshotValidation.paginationDiagnosticsConsistent,
  };
}

export function formatMappingReviewReport(report: MappingReviewReport): string {
  return JSON.stringify(report, null, 2);
}
