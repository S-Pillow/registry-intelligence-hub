import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { sha256Hex } from "@/normalization/hashes";
import { loadApprovedMappingRunEvidenceIndex } from "./approved-mapping-evidence-index";
import {
  assertLivePreflightEligible,
  countArtifactMappedRows,
  evaluateMappingArtifactEligibility,
  isProductionEligibleArtifact,
  loadEvidenceSnapshotIndex,
  type EvidenceSnapshotIndex,
} from "./artifact-eligibility";
import {
  isLegacyAcquisitionEnvSet,
  isMappingLiveAuthorized,
  isPilotLiveAuthorized,
} from "./auth-gates";
import { pilotMappingPath } from "./bundle-paths";
import {
  GTLDRESULT_ORIGIN,
  RSP_ACQUISITION_AUTH_ENV,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
} from "./constants";
import { computePilotPreflightCounts } from "./pilot-preflight";
import type { Registry2012RspMappingArtifact } from "./types";
import { buildMappingLivePreflightReport } from "./mapping-live-preflight";
import { defaultLiveStagingRoot } from "./staging-containment";

export type PreflightOperation = "pilot" | "pilot-live" | "mapping-dry-run" | "mapping-live";

export interface PreflightReportInput {
  workspaceRoot: string;
  operation: PreflightOperation;
  stagingRoot?: string;
  mappingArtifactPath?: string;
  /**
   * Mapping-live run directory (checkpoint + page HTML + fetch metadata).
   * Required for pilot-live when the mapping artifact is EVIDENCE+APPROVED.
   * The checkout fixture raw-snapshots.json is not accepted.
   */
  evidenceIndexPath?: string;
}

export interface PreflightReport {
  operation: PreflightOperation;
  artifactPath: string;
  artifactSha256: string;
  scope: string;
  artifactPurpose: string;
  approvalState: string;
  productionEligible: boolean;
  corpusContentHash: string;
  artifactMappedCount: number;
  pilotExpectedCount: number;
  pilotResolvedCount: number;
  pilotUnresolvedCount: number;
  evidenceSnapshotCount: number;
  evidenceIndexPath: string | null;
  targetHost: string;
  stagingRoot: string;
  authState: {
    legacyAcquisitionEnv: boolean;
    pilotLiveAuthorized: boolean;
    mappingLiveAuthorized: boolean;
  };
  networkRequestsExpected: number;
  pilotApplicationToAcId?: Array<{ applicationId: string; gtldresultAcId: number | null }>;
  blockingReasons: string[];
}

export { isPilotLiveAuthorized } from "./auth-gates";

const FIXTURE_CATALOG_REFUSED =
  "pilot-live requires --evidence-index pointing at the approved mapping run directory. Fixture raw-snapshots.json is not accepted.";

async function loadPreflightEvidenceIndex(
  input: PreflightReportInput,
  artifact: Registry2012RspMappingArtifact,
): Promise<{ snapshots: EvidenceSnapshotIndex; error: string | null }> {
  if (input.operation !== "pilot-live") {
    return { snapshots: await loadEvidenceSnapshotIndex(input.workspaceRoot), error: null };
  }
  if (!input.evidenceIndexPath) {
    return {
      snapshots: { byId: new Map() },
      error: isProductionEligibleArtifact(artifact) ? FIXTURE_CATALOG_REFUSED : null,
    };
  }
  try {
    return {
      snapshots: await loadApprovedMappingRunEvidenceIndex(input.evidenceIndexPath),
      error: null,
    };
  } catch (err) {
    return {
      snapshots: { byId: new Map() },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function buildPreflightReport(input: PreflightReportInput): Promise<PreflightReport> {
  const artifactPath = resolve(input.mappingArtifactPath ?? pilotMappingPath(input.workspaceRoot));
  const artifactBytes = await readFile(artifactPath);
  const artifactSha256 = sha256Hex(artifactBytes);
  const artifact = JSON.parse(artifactBytes.toString("utf8")) as Registry2012RspMappingArtifact;

  const evidence = await loadPreflightEvidenceIndex(input, artifact);
  const snapshots = evidence.snapshots;
  const eligibility = evaluateMappingArtifactEligibility(artifact, snapshots);
  const { artifactMappedCount } = countArtifactMappedRows(artifact);
  const pilotCounts = await computePilotPreflightCounts(input.workspaceRoot, artifact);

  const stagingRoot = input.stagingRoot ?? defaultLiveStagingRoot();
  const blockingReasons: string[] =
    input.operation === "mapping-live" ? [] : [...eligibility.artifactIssues];
  let networkRequestsExpected = 0;

  if (input.operation === "mapping-live") {
    const mappingPreflight = await buildMappingLivePreflightReport({
      workspaceRoot: input.workspaceRoot,
      stagingRoot: input.stagingRoot,
    });
    blockingReasons.push(...mappingPreflight.blockingReasons);
    if (mappingPreflight.blockingReasons.length === 0) {
      networkRequestsExpected = mappingPreflight.networkRequestsExpected;
    }
  }

  if (input.operation === "pilot-live") {
    if (evidence.error) {
      blockingReasons.push(evidence.error);
    }
    if (!isPilotLiveAuthorized()) {
      blockingReasons.push(`${RSP_PILOT_LIVE_AUTH_ENV} is not set — pilot-live requires operation-specific authorization`);
    }
    if (isLegacyAcquisitionEnvSet()) {
      blockingReasons.push(
        `${RSP_ACQUISITION_AUTH_ENV} is deprecated and does not grant live permission`,
      );
    }
    try {
      assertLivePreflightEligible(artifact, eligibility);
    } catch (err) {
      blockingReasons.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (input.operation === "pilot-live" && blockingReasons.length === 0) {
    networkRequestsExpected = pilotCounts.pilotResolvedCount;
  }

  return {
    operation: input.operation,
    artifactPath,
    artifactSha256,
    scope: artifact.scope,
    artifactPurpose: artifact.artifactPurpose,
    approvalState: artifact.approvalState,
    productionEligible: eligibility.productionEligible,
    corpusContentHash: APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    artifactMappedCount,
    pilotExpectedCount: pilotCounts.pilotExpectedCount,
    pilotResolvedCount: pilotCounts.pilotResolvedCount,
    pilotUnresolvedCount: pilotCounts.pilotUnresolvedCount,
    evidenceSnapshotCount: eligibility.snapshotCount,
    evidenceIndexPath: input.evidenceIndexPath ?? null,
    targetHost: new URL(GTLDRESULT_ORIGIN).hostname,
    stagingRoot,
    authState: {
      legacyAcquisitionEnv: isLegacyAcquisitionEnvSet(),
      pilotLiveAuthorized: isPilotLiveAuthorized(),
      mappingLiveAuthorized: isMappingLiveAuthorized(),
    },
    networkRequestsExpected,
    pilotApplicationToAcId:
      input.operation === "pilot" ||
      input.operation === "pilot-live" ||
      input.operation === "mapping-dry-run"
        ? pilotCounts.pilotApplicationToAcId
        : undefined,
    blockingReasons,
  };
}

export function formatPreflightReport(report: PreflightReport): string {
  const lines: string[] = [
    "icann2012-rsp acquisition preflight (zero HTTP)",
    `operation: ${report.operation}`,
    `artifactPath: ${report.artifactPath}`,
    `artifactSha256: ${report.artifactSha256}`,
    `scope: ${report.scope}`,
    `artifactPurpose: ${report.artifactPurpose}`,
    `approvalState: ${report.approvalState}`,
    `productionEligible: ${report.productionEligible}`,
    `corpusContentHash: ${report.corpusContentHash}`,
    `artifactMappedCount: ${report.artifactMappedCount}`,
    `pilotExpectedCount: ${report.pilotExpectedCount}`,
    `pilotResolvedCount: ${report.pilotResolvedCount}`,
    `pilotUnresolvedCount: ${report.pilotUnresolvedCount}`,
    `evidenceSnapshotCount: ${report.evidenceSnapshotCount}`,
    `evidenceIndexPath: ${report.evidenceIndexPath ?? "(none)"}`,
    `targetHost: ${report.targetHost}`,
    `stagingRoot: ${report.stagingRoot}`,
    `legacyAcquisitionEnv (${RSP_ACQUISITION_AUTH_ENV}): ${report.authState.legacyAcquisitionEnv}`,
    `pilotLiveAuthorized (${RSP_PILOT_LIVE_AUTH_ENV}): ${report.authState.pilotLiveAuthorized}`,
    `mappingLiveAuthorized (${RSP_MAPPING_LIVE_AUTH_ENV}): ${report.authState.mappingLiveAuthorized}`,
    `networkRequestsExpected: ${report.networkRequestsExpected}`,
  ];

  if (report.pilotApplicationToAcId) {
    lines.push("", "pilot Application ID → gtldresultAcId:");
    for (const row of report.pilotApplicationToAcId) {
      lines.push(`  ${row.applicationId} → ${row.gtldresultAcId ?? "null"}`);
    }
  }

  if (report.blockingReasons.length > 0) {
    lines.push("", "blockingReasons:");
    for (const reason of report.blockingReasons) {
      lines.push(`  - ${reason}`);
    }
  } else {
    lines.push("", "blockingReasons: (none)");
  }

  return lines.join("\n");
}
