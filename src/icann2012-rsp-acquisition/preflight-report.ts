import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { sha256Hex } from "@/normalization/hashes";
import {
  assertLivePreflightEligible,
  evaluateMappingArtifactEligibility,
  loadEvidenceSnapshotIndex,
} from "./artifact-eligibility";
import { pilotMappingPath } from "./bundle-paths";
import {
  GTLDRESULT_ORIGIN,
  RSP_ACQUISITION_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
} from "./constants";
import { loadPilotManifest, resolveGtldresultAcId } from "./load-manifest";
import { runMappingDryRun } from "./mapping-dry-run";
import { defaultLiveStagingRoot } from "./staging-containment";
import type { Registry2012RspMappingArtifact } from "./types";

export type PreflightOperation = "pilot" | "pilot-live" | "mapping-dry-run" | "mapping-live";

export interface PreflightReportInput {
  workspaceRoot: string;
  operation: PreflightOperation;
  stagingRoot?: string;
  mappingArtifactPath?: string;
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
  mappedCount: number;
  unresolvedCount: number;
  evidenceSnapshotCount: number;
  targetHost: string;
  stagingRoot: string;
  authState: {
    legacyAcquisitionEnv: boolean;
    pilotLiveAuthorized: boolean;
  };
  networkRequestsExpected: number;
  pilotApplicationToAcId?: Array<{ applicationId: string; gtldresultAcId: number | null }>;
  blockingReasons: string[];
}

function legacyAuthSet(): boolean {
  return process.env[RSP_ACQUISITION_AUTH_ENV] === "1";
}

export function isPilotLiveAuthorized(): boolean {
  return process.env[RSP_PILOT_LIVE_AUTH_ENV] === "1";
}

export async function buildPreflightReport(input: PreflightReportInput): Promise<PreflightReport> {
  const artifactPath = resolve(input.mappingArtifactPath ?? pilotMappingPath(input.workspaceRoot));
  const artifactBytes = await readFile(artifactPath);
  const artifactSha256 = sha256Hex(artifactBytes);
  const artifact = JSON.parse(artifactBytes.toString("utf8")) as Registry2012RspMappingArtifact;

  const snapshots = await loadEvidenceSnapshotIndex(input.workspaceRoot);
  const eligibility = evaluateMappingArtifactEligibility(artifact, snapshots);

  const stagingRoot = input.stagingRoot ?? defaultLiveStagingRoot();
  const blockingReasons: string[] = [...eligibility.artifactIssues];

  if (input.operation === "mapping-live") {
    blockingReasons.push("MAPPING_LIVE_NOT_IMPLEMENTED");
  }

  if (input.operation === "pilot-live") {
    if (!isPilotLiveAuthorized()) {
      blockingReasons.push(`${RSP_PILOT_LIVE_AUTH_ENV} is not set — pilot-live requires operation-specific authorization`);
    }
    if (legacyAuthSet()) {
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

  let networkRequestsExpected = 0;
  let pilotApplicationToAcId: PreflightReport["pilotApplicationToAcId"];

  if (input.operation === "pilot" || input.operation === "pilot-live") {
    const manifest = await loadPilotManifest(input.workspaceRoot);
    const mappingByApp = new Map(
      artifact.entries.map((e) => [e.applicationId, e.gtldresultAcId] as const),
    );
    pilotApplicationToAcId = manifest.entries.map((entry) => ({
      applicationId: entry.applicationId,
      gtldresultAcId: resolveGtldresultAcId(entry.applicationId, entry, mappingByApp),
    }));
    if (input.operation === "pilot-live" && blockingReasons.length === 0) {
      networkRequestsExpected = pilotApplicationToAcId.filter((r) => r.gtldresultAcId != null).length;
    }
  }

  if (input.operation === "mapping-dry-run" || input.operation === "mapping-live") {
    const dry = await runMappingDryRun({
      workspaceRoot: input.workspaceRoot,
      approvedMappingJsonPath: artifactPath,
    });
    networkRequestsExpected = 0;
    if (input.operation === "mapping-dry-run") {
      blockingReasons.push(...[]);
    }
    eligibility.mappedCount = dry.resolved.filter((r) => r.gtldresultAcId != null).length;
    eligibility.unresolvedCount = dry.unresolvedApplicationIds.length;
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
    mappedCount: eligibility.mappedCount,
    unresolvedCount: eligibility.unresolvedCount,
    evidenceSnapshotCount: eligibility.snapshotCount,
    targetHost: new URL(GTLDRESULT_ORIGIN).hostname,
    stagingRoot,
    authState: {
      legacyAcquisitionEnv: legacyAuthSet(),
      pilotLiveAuthorized: isPilotLiveAuthorized(),
    },
    networkRequestsExpected,
    pilotApplicationToAcId,
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
    `mappedCount: ${report.mappedCount}`,
    `unresolvedCount: ${report.unresolvedCount}`,
    `evidenceSnapshotCount: ${report.evidenceSnapshotCount}`,
    `targetHost: ${report.targetHost}`,
    `stagingRoot: ${report.stagingRoot}`,
    `legacyAcquisitionEnv (${RSP_ACQUISITION_AUTH_ENV}): ${report.authState.legacyAcquisitionEnv}`,
    `pilotLiveAuthorized (${RSP_PILOT_LIVE_AUTH_ENV}): ${report.authState.pilotLiveAuthorized}`,
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
