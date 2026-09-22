import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { realpath } from "node:fs/promises";
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
import { MAPPING_REVIEW_FAILURE_CLASSIFICATIONS } from "./mapping-review-failure-classification";
import { mappingLiveCheckpointPath, readMappingLiveCheckpoint } from "./mapping-checkpoint";
import { resolveOperatorCommitSha } from "./operator-git-provenance";
import { inspectStagingDiskSpace } from "./staging-disk-check";
import { defaultLiveStagingRoot, isPathContainedIn } from "./staging-containment";

export const MAPPING_LIVE_OPERATOR_PLAN_VERSION =
  "registry-hub-rsp-mapping-live-operator-plan/1.0.0" as const;

export interface MappingLiveOperatorPlan {
  planVersion: typeof MAPPING_LIVE_OPERATOR_PLAN_VERSION;
  zeroNetwork: true;
  operatorPhase: "pre-authorization-planning";
  commitSha?: string;
  corpusContentHash: string;
  roundWideExpectedCount: number;
  outputArtifactPurpose: "EVIDENCE";
  outputApprovalState: "DRAFT";
  outputScope: "ROUND_WIDE_EXACT";
  targetHost: string;
  stagingRoot: string;
  stagingOutsideWorkspace: boolean;
  stagingDisk: Awaited<ReturnType<typeof inspectStagingDiskSpace>>;
  resumeCheckpointPresent: boolean;
  resumeRunId?: string;
  resumePagesCompleted?: number;
  authState: {
    legacyAcquisitionEnv: boolean;
    pilotLiveAuthorized: boolean;
    mappingLiveAuthorized: boolean;
  };
  pacing: {
    minDelayMsBetweenRequests: number;
    maxConcurrentIndexPageDownloads: number;
    mappingLivePageSafetyCap: number;
    maxRequestsPerMinute: number;
  };
  networkRequestsIfLiveRun: number;
  preRunChecklist: string[];
  operatorBlockingBeforeLive: string[];
  oneRunRule: string;
  postRunSuccessSequence: string[];
  postRunPartialPilotSequence: string[];
  failureBranchSummary: Record<string, string>;
  scopeNote: string;
}

export interface MappingLivePlanInput {
  workspaceRoot: string;
  stagingRoot?: string;
}

export async function buildMappingLiveOperatorPlan(
  input: MappingLivePlanInput,
): Promise<MappingLiveOperatorPlan> {
  const stagingRoot = input.stagingRoot ?? defaultLiveStagingRoot();
  const operatorBlockingBeforeLive: string[] = [];

  let stagingOutsideWorkspace = true;
  try {
    const resolvedStaging = await realpath(resolve(stagingRoot)).catch(() => resolve(stagingRoot));
    const resolvedWorkspace = await realpath(resolve(input.workspaceRoot));
    stagingOutsideWorkspace = !isPathContainedIn(resolvedStaging, resolvedWorkspace);
    if (!stagingOutsideWorkspace) {
      operatorBlockingBeforeLive.push("stagingRoot must be outside repository workspace");
    }
  } catch {
    operatorBlockingBeforeLive.push("unable to validate stagingRoot containment");
  }

  const normalizedStaging = stagingRoot.replace(/\\/g, "/");
  if (normalizedStaging === "/tmp" || normalizedStaging.startsWith("/tmp/")) {
    operatorBlockingBeforeLive.push(
      "stagingRoot must not be ephemeral /tmp — use persistent VPS evidence path (e.g. /var/lib/...)",
    );
  }

  try {
    await access(stagingRoot, constants.W_OK);
  } catch {
    operatorBlockingBeforeLive.push(`stagingRoot not writable: ${stagingRoot}`);
  }

  const ids = await loadRevealDayApplicationIds(input.workspaceRoot);
  if (ids.length !== ROUND_WIDE_APPLICATION_COUNT) {
    operatorBlockingBeforeLive.push(
      `Reveal Day corpus pin mismatch: expected ${ROUND_WIDE_APPLICATION_COUNT}, got ${ids.length}`,
    );
  }

  const ckPath = mappingLiveCheckpointPath(stagingRoot);
  const checkpoint = await readMappingLiveCheckpoint(ckPath);
  if (checkpoint && checkpoint.state === "running") {
    operatorBlockingBeforeLive.push(
      "conflicting in-progress checkpoint — resolve or archive before a fresh authorized run",
    );
  }

  const stagingDisk = await inspectStagingDiskSpace(stagingRoot);
  if (stagingDisk.meetsBudget === false) {
    operatorBlockingBeforeLive.push(
      `insufficient disk space: need at least ${stagingDisk.budgetBytes} bytes free`,
    );
  }

  if (!isMappingLiveAuthorized()) {
    operatorBlockingBeforeLive.push(
      `${RSP_MAPPING_LIVE_AUTH_ENV} must be set immediately before the single live invocation (unset after stop)`,
    );
  }

  const networkRequestsIfLiveRun =
    operatorBlockingBeforeLive.length === 0 ||
    operatorBlockingBeforeLive.every((r) => r.includes(RSP_MAPPING_LIVE_AUTH_ENV))
      ? 1 + RSP_ACQUISITION_LIMITS.maxIndexGridPages
      : 0;

  const commitSha = await resolveOperatorCommitSha(input.workspaceRoot);

  const failureBranchSummary: Record<string, string> = {
    RATE_LIMITED:
      "HTTP 429 — preserve checkpoint/pages, do not increase rate or rotate identity; stop and review",
    ACCESS_METHOD_NOT_AVAILABLE:
      "HTTP 403/access denial — preserve evidence, do not workaround; stop",
    SOURCE_TEMPORARILY_UNAVAILABLE:
      "5xx/timeout exhausted — preserve evidence, stop; no aggressive retry",
    HTML_STRUCTURE_DRIFT:
      "Parser quarantine/drift — preserve HTML for offline fixtures before any new live attempt",
    PAGINATION_DRIFT:
      "Pager/hash loop — preserve pages, offline parser work before retry",
    PARTIAL_MAPPING:
      "Incomplete round-wide — keep DRAFT run + review report; pilot-only path separate",
    INTEGRITY_FAILURE:
      "Snapshot/hash mismatch — do not rerun until root cause understood",
    CANCELLED:
      "Operator stop — checkpoint + pages intact; resume requires fresh session + hash revalidation",
  };
  for (const key of MAPPING_REVIEW_FAILURE_CLASSIFICATIONS) {
    if (!failureBranchSummary[key] && key !== "EXACT_COMPLETE") {
      failureBranchSummary[key] = "Preserve evidence, stop, steward review before second live attempt";
    }
  }
  failureBranchSummary.UNEXPECTED_CROSS_HOST_REDIRECT =
    "Cross-host redirect rejected — preserve safe metadata, stop, no follow";

  return {
    planVersion: MAPPING_LIVE_OPERATOR_PLAN_VERSION,
    zeroNetwork: true,
    operatorPhase: "pre-authorization-planning",
    commitSha,
    corpusContentHash: APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    roundWideExpectedCount: ROUND_WIDE_APPLICATION_COUNT,
    outputArtifactPurpose: "EVIDENCE",
    outputApprovalState: "DRAFT",
    outputScope: "ROUND_WIDE_EXACT",
    targetHost: new URL(GTLDRESULT_ORIGIN).hostname,
    stagingRoot,
    stagingOutsideWorkspace,
    stagingDisk,
    resumeCheckpointPresent: checkpoint != null,
    resumeRunId: checkpoint?.runId,
    resumePagesCompleted: checkpoint?.lastCompletedPageOrdinal,
    authState: {
      legacyAcquisitionEnv: isLegacyAcquisitionEnvSet(),
      pilotLiveAuthorized: isPilotLiveAuthorized(),
      mappingLiveAuthorized: isMappingLiveAuthorized(),
    },
    pacing: {
      minDelayMsBetweenRequests: RSP_ACQUISITION_LIMITS.minDelayMsBetweenGtldresultRequests,
      maxConcurrentIndexPageDownloads: RSP_ACQUISITION_LIMITS.maxConcurrentIndexPageDownloads,
      mappingLivePageSafetyCap: RSP_ACQUISITION_LIMITS.mappingLivePageSafetyCap,
      maxRequestsPerMinute: RSP_ACQUISITION_LIMITS.maxRequestsPerMinute,
    },
    networkRequestsIfLiveRun,
    preRunChecklist: [
      "Verify exact git commit SHA matches steward-approved acquisition revision",
      "Verify canonical 2012 corpus hash and 1930 Application ID count",
      "Choose persistent staging/evidence directory outside repo (report path + free disk)",
      "Verify no conflicting prior run directory/checkpoint for this staging root",
      "Run mapping-live-plan (this command) with zero HTTP",
      "Inspect target host, pacing, corpus pin, staging path, expected EVIDENCE+DRAFT output",
      "Set REGISTRY_HUB_RSP_MAPPING_AUTHORIZED=1 only for the single live invocation",
      "Unset authorization immediately after completion or stop",
      "Do not deploy, restart PM2, or touch production Hub/nginx during acquisition",
    ],
    operatorBlockingBeforeLive,
    oneRunRule:
      "First authorized attempt is one controlled mapping-live run — no automatic full-crawl retry; second live attempt requires review of first run evidence and stop reason",
    postRunSuccessSequence: [
      "Crawler finishes 1930/1930 (missing 0, extra 0, duplicate Application IDs 0, duplicate AC IDs 0)",
      "Mapping artifact remains EVIDENCE + DRAFT",
      "Run mapping-review (zero HTTP)",
      "Confirm validation leads matched",
      "Write evidence-bundle manifest with deterministic SHA-256 entries",
      "Print safe provenance summary and stop — no APPROVE packet, no pilot-live",
    ],
    postRunPartialPilotSequence: [
      "If pilotResolvedCount=25 and pilotOnlyExactCandidate=true with incomplete round-wide",
      "Preserve entire DRAFT run, pages, checkpoint, mapping-review report",
      "Round-wide mapping stays unapproved — prepare pilot-scoped steward decision only",
      "Do not change artifact scope or launch pilot-live",
    ],
    failureBranchSummary,
    scopeNote:
      "Mapping-live is Application ID → ICANN internal ID only — no Applicant→RO, TLD→RO, or Application→RSP facts (RSP begins at Q23–Q25 portion extraction)",
  };
}

export function formatMappingLiveOperatorPlan(plan: MappingLiveOperatorPlan): string {
  const lines: string[] = [
    "icann2012-rsp mapping-live operator plan (zero HTTP — pre-authorization)",
    `planVersion: ${plan.planVersion}`,
    `zeroNetwork: ${plan.zeroNetwork}`,
    `commitSha: ${plan.commitSha ?? "(unknown — set REGISTRY_HUB_OPERATOR_COMMIT_SHA on VPS)"}`,
    `corpusContentHash: ${plan.corpusContentHash}`,
    `roundWideExpectedCount: ${plan.roundWideExpectedCount}`,
    `outputArtifactPurpose: ${plan.outputArtifactPurpose}`,
    `outputApprovalState: ${plan.outputApprovalState}`,
    `outputScope: ${plan.outputScope}`,
    `targetHost: ${plan.targetHost}`,
    `stagingRoot: ${plan.stagingRoot}`,
    `stagingOutsideWorkspace: ${plan.stagingOutsideWorkspace}`,
    `stagingDisk.freeBytes: ${plan.stagingDisk.freeBytes ?? "(unknown)"}`,
    `stagingDisk.meetsBudget: ${plan.stagingDisk.meetsBudget ?? "(unknown)"}`,
    `resumeCheckpointPresent: ${plan.resumeCheckpointPresent}`,
    `mappingLiveAuthorized (${RSP_MAPPING_LIVE_AUTH_ENV}): ${plan.authState.mappingLiveAuthorized}`,
    `networkRequestsIfLiveRun: ${plan.networkRequestsIfLiveRun} (plan performs 0)`,
    `pacing.minDelayMs: ${plan.pacing.minDelayMsBetweenRequests}`,
    `pacing.pageSafetyCap: ${plan.pacing.mappingLivePageSafetyCap}`,
    "",
    "oneRunRule:",
    `  ${plan.oneRunRule}`,
    "",
    "scopeNote:",
    `  ${plan.scopeNote}`,
    "",
    "preRunChecklist:",
    ...plan.preRunChecklist.map((item) => `  - ${item}`),
  ];

  if (plan.operatorBlockingBeforeLive.length > 0) {
    lines.push("", "operatorBlockingBeforeLive (expected during plan — resolve before HTTP):");
    for (const reason of plan.operatorBlockingBeforeLive) {
      lines.push(`  - ${reason}`);
    }
  } else {
    lines.push("", "operatorBlockingBeforeLive: (none — ready except explicit auth window)");
  }

  lines.push("", "postRunSuccessSequence:");
  for (const step of plan.postRunSuccessSequence) {
    lines.push(`  - ${step}`);
  }

  lines.push("", "failureBranchSummary:");
  for (const [key, value] of Object.entries(plan.failureBranchSummary)) {
    lines.push(`  ${key}: ${value}`);
  }

  return lines.join("\n");
}

export function formatMappingLiveOperatorPlanJson(plan: MappingLiveOperatorPlan): string {
  return JSON.stringify(plan, null, 2);
}
