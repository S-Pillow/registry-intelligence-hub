import { resolve } from "node:path";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import {
  isLegacyAcquisitionEnvSet,
  isMappingLiveAuthorized,
  isPilotLiveAuthorized,
} from "./auth-gates";
import {
  ROUND_WIDE_APPLICATION_COUNT,
  loadRevealDayApplicationIds,
} from "./canonical-reconciliation";
import {
  GTLDRESULT_ORIGIN,
  RSP_ACQUISITION_AUTH_ENV,
  RSP_ACQUISITION_LIMITS,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
} from "./constants";
import { mappingLiveCheckpointPath, readMappingLiveCheckpoint } from "./mapping-checkpoint";
import { defaultLiveStagingRoot } from "./staging-containment";
import { realpath } from "node:fs/promises";
import { isPathContainedIn } from "./staging-containment";

export interface MappingLivePreflightReport {
  operation: "mapping-live";
  corpusContentHash: string;
  roundWideExpectedCount: number;
  outputArtifactPurpose: "EVIDENCE";
  outputApprovalState: "DRAFT";
  outputScope: "ROUND_WIDE_EXACT";
  targetHost: string;
  stagingRoot: string;
  stagingOutsideWorkspace: boolean;
  resumeCheckpointPresent: boolean;
  resumeRunId?: string;
  resumePagesCompleted?: number;
  authState: {
    legacyAcquisitionEnv: boolean;
    pilotLiveAuthorized: boolean;
    mappingLiveAuthorized: boolean;
  };
  networkRequestsExpected: number;
  mappingLivePageSafetyCap: number;
  blockingReasons: string[];
}

export interface MappingLivePreflightInput {
  workspaceRoot: string;
  stagingRoot?: string;
}

export async function buildMappingLivePreflightReport(
  input: MappingLivePreflightInput,
): Promise<MappingLivePreflightReport> {
  const stagingRoot = input.stagingRoot ?? defaultLiveStagingRoot();
  const blockingReasons: string[] = [];

  if (!isMappingLiveAuthorized()) {
    blockingReasons.push(
      `${RSP_MAPPING_LIVE_AUTH_ENV} is not set — mapping-live requires operation-specific authorization`,
    );
  }

  let stagingOutsideWorkspace = true;
  try {
    const resolvedStaging = await realpath(resolve(stagingRoot)).catch(() => resolve(stagingRoot));
    const resolvedWorkspace = await realpath(resolve(input.workspaceRoot));
    stagingOutsideWorkspace = !isPathContainedIn(resolvedStaging, resolvedWorkspace);
    if (!stagingOutsideWorkspace) {
      blockingReasons.push("stagingRoot must be outside repository workspace");
    }
  } catch {
    blockingReasons.push("unable to validate stagingRoot containment");
  }

  const ids = await loadRevealDayApplicationIds(input.workspaceRoot);
  if (ids.length !== ROUND_WIDE_APPLICATION_COUNT) {
    blockingReasons.push(
      `Reveal Day corpus pin mismatch: expected ${ROUND_WIDE_APPLICATION_COUNT}, got ${ids.length}`,
    );
  }

  const ckPath = mappingLiveCheckpointPath(stagingRoot);
  const checkpoint = await readMappingLiveCheckpoint(ckPath);

  let networkRequestsExpected = 0;
  if (blockingReasons.length === 0) {
    networkRequestsExpected = 1 + RSP_ACQUISITION_LIMITS.maxIndexGridPages;
  }

  return {
    operation: "mapping-live",
    corpusContentHash: APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    roundWideExpectedCount: ROUND_WIDE_APPLICATION_COUNT,
    outputArtifactPurpose: "EVIDENCE",
    outputApprovalState: "DRAFT",
    outputScope: "ROUND_WIDE_EXACT",
    targetHost: new URL(GTLDRESULT_ORIGIN).hostname,
    stagingRoot,
    stagingOutsideWorkspace,
    resumeCheckpointPresent: checkpoint != null,
    resumeRunId: checkpoint?.runId,
    resumePagesCompleted: checkpoint?.lastCompletedPageOrdinal,
    authState: {
      legacyAcquisitionEnv: isLegacyAcquisitionEnvSet(),
      pilotLiveAuthorized: isPilotLiveAuthorized(),
      mappingLiveAuthorized: isMappingLiveAuthorized(),
    },
    networkRequestsExpected,
    mappingLivePageSafetyCap: RSP_ACQUISITION_LIMITS.mappingLivePageSafetyCap,
    blockingReasons,
  };
}

export function formatMappingLivePreflightReport(report: MappingLivePreflightReport): string {
  const lines: string[] = [
    "icann2012-rsp mapping-live preflight (zero HTTP)",
    `operation: ${report.operation}`,
    `corpusContentHash: ${report.corpusContentHash}`,
    `roundWideExpectedCount: ${report.roundWideExpectedCount}`,
    `outputArtifactPurpose: ${report.outputArtifactPurpose}`,
    `outputApprovalState: ${report.outputApprovalState}`,
    `outputScope: ${report.outputScope}`,
    `targetHost: ${report.targetHost}`,
    `stagingRoot: ${report.stagingRoot}`,
    `stagingOutsideWorkspace: ${report.stagingOutsideWorkspace}`,
    `resumeCheckpointPresent: ${report.resumeCheckpointPresent}`,
    `mappingLivePageSafetyCap: ${report.mappingLivePageSafetyCap}`,
    `legacyAcquisitionEnv (${RSP_ACQUISITION_AUTH_ENV}): ${report.authState.legacyAcquisitionEnv}`,
    `pilotLiveAuthorized (${RSP_PILOT_LIVE_AUTH_ENV}): ${report.authState.pilotLiveAuthorized}`,
    `mappingLiveAuthorized (${RSP_MAPPING_LIVE_AUTH_ENV}): ${report.authState.mappingLiveAuthorized}`,
    `networkRequestsExpected: ${report.networkRequestsExpected}`,
  ];
  if (report.resumeRunId) lines.push(`resumeRunId: ${report.resumeRunId}`);
  if (report.resumePagesCompleted != null) {
    lines.push(`resumePagesCompleted: ${report.resumePagesCompleted}`);
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
