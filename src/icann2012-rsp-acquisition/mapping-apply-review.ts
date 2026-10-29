/**
 * Offline mapping-apply-review operator.
 *
 * Applies an external human mapping-review decision packet
 * (`rsp-mapping-review/1.0.0`) against a freshly computed offline mapping
 * review. Zero HTTP. Does not itself decide APPROVE — it only mechanically
 * promotes when the existing approval contract passes.
 *
 * Never overwrites DRAFT `mapping.json`. APPROVE writes a sibling
 * `mapping.approved.json` (or an explicit --output path) exclusively after
 * pre-write collision / lifecycle / packet-binding checks.
 */
import { open, readFile, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { sha256Hex } from "@/normalization/hashes";
import {
  stagingEvidenceBundleManifestPath,
  stagingMappingApprovedArtifactPath,
  stagingMappingReviewReportPath,
} from "./bundle-paths";
import { loadRspMappingArtifact } from "./load-manifest";
import { mappingLiveCheckpointPath } from "./mapping-checkpoint";
import {
  applyMechanicalMappingApproval,
  assertRspMappingReviewPacket,
  validateMappingApprovalPacket,
  type MappingReviewDecision,
  type RspMappingReviewPacket,
} from "./mapping-review-approval";
import {
  resolveMappingRunLayout,
  runMappingReview,
  type MappingReviewReport,
} from "./mapping-review";
import type { Registry2012RspMappingArtifact } from "./types";

export type MappingApplyReviewOutcome =
  | "APPROVED"
  | "HOLD_NO_PROMOTION"
  | "REJECT_NO_PROMOTION"
  | "APPROVE_REJECTED";

export interface MappingApplyReviewReceipt {
  receiptVersion: "registry-hub-rsp-mapping-apply-review-receipt/1.0.0";
  runId: string;
  draftArtifactPath: string;
  draftArtifactSha256: string;
  reviewPacketPath: string;
  packetDecision: MappingReviewDecision;
  reviewer: string;
  reviewedAt: string;
  mappingReviewPass: boolean;
  reviewHold: boolean;
  integrityFailureCount: number;
  roundWideExact: boolean;
  failureClassification: string;
  mechanicalEligibility: boolean;
  outcome: MappingApplyReviewOutcome;
  approvedOutputPath: string | null;
  approvedOutputSha256: string | null;
  originalArtifactUnchanged: boolean;
  networkRequests: 0;
  rejectReasons: string[];
}

export interface MappingApplyReviewOptions {
  workspaceRoot: string;
  runDir: string;
  reviewPacketPath: string;
  /** Defaults to registry-2012-rsp-mapping/<run-id>/mapping.approved.json */
  outputPath?: string;
  /**
   * Test-only: inject a review report instead of running fresh review.
   * CLI never sets this.
   */
  reviewReportOverride?: MappingReviewReport;
}

export class MappingApplyReviewError extends Error {
  readonly receipt: MappingApplyReviewReceipt | null;

  constructor(message: string, receipt: MappingApplyReviewReceipt | null = null) {
    super(message);
    this.name = "MappingApplyReviewError";
    this.receipt = receipt;
  }
}

function serializeApprovedArtifact(artifact: Registry2012RspMappingArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

function baseReceipt(input: {
  runId: string;
  draftArtifactPath: string;
  draftArtifactSha256: string;
  reviewPacketPath: string;
  packet: RspMappingReviewPacket;
  report: MappingReviewReport;
  mechanicalEligibility: boolean;
  outcome: MappingApplyReviewOutcome;
  approvedOutputPath: string | null;
  approvedOutputSha256: string | null;
  originalArtifactUnchanged: boolean;
  rejectReasons: string[];
}): MappingApplyReviewReceipt {
  return {
    receiptVersion: "registry-hub-rsp-mapping-apply-review-receipt/1.0.0",
    runId: input.runId,
    draftArtifactPath: input.draftArtifactPath,
    draftArtifactSha256: input.draftArtifactSha256,
    reviewPacketPath: input.reviewPacketPath,
    packetDecision: input.packet.decision,
    reviewer: input.packet.reviewer,
    reviewedAt: input.packet.reviewedAt,
    mappingReviewPass: input.report.mappingReviewPass,
    reviewHold: input.report.reviewHold,
    integrityFailureCount: input.report.integrityFailures.length,
    roundWideExact: input.report.roundWideExact,
    failureClassification: input.report.failureClassification,
    mechanicalEligibility: input.mechanicalEligibility,
    outcome: input.outcome,
    approvedOutputPath: input.approvedOutputPath,
    approvedOutputSha256: input.approvedOutputSha256,
    originalArtifactUnchanged: input.originalArtifactUnchanged,
    networkRequests: 0,
    rejectReasons: input.rejectReasons,
  };
}

export function formatMappingApplyReviewReceipt(receipt: MappingApplyReviewReceipt): string {
  const lines = [
    "=== mapping-apply-review (zero HTTP; not a steward decision) ===",
    `runId: ${receipt.runId}`,
    `draftArtifactPath: ${receipt.draftArtifactPath}`,
    `draftArtifactSha256: ${receipt.draftArtifactSha256}`,
    `reviewPacketPath: ${receipt.reviewPacketPath}`,
    `packetDecision: ${receipt.packetDecision}`,
    `reviewer: ${receipt.reviewer}`,
    `reviewedAt: ${receipt.reviewedAt}`,
    `mappingReviewPass: ${receipt.mappingReviewPass}`,
    `reviewHold: ${receipt.reviewHold}`,
    `integrityFailureCount: ${receipt.integrityFailureCount}`,
    `roundWideExact: ${receipt.roundWideExact}`,
    `failureClassification: ${receipt.failureClassification}`,
    `mechanicalEligibility: ${receipt.mechanicalEligibility}`,
    `outcome: ${receipt.outcome}`,
    `approvedOutputPath: ${receipt.approvedOutputPath ?? "(none)"}`,
    `approvedOutputSha256: ${receipt.approvedOutputSha256 ?? "(none)"}`,
    `originalArtifactUnchanged: ${receipt.originalArtifactUnchanged ? "yes" : "no"}`,
    `networkRequests: ${receipt.networkRequests}`,
  ];
  if (receipt.outcome === "HOLD_NO_PROMOTION") {
    lines.push("HOLD — NO PROMOTION");
  } else if (receipt.outcome === "REJECT_NO_PROMOTION") {
    lines.push("REJECT — NO PROMOTION");
  } else if (receipt.outcome === "APPROVE_REJECTED") {
    lines.push("APPROVE — REJECTED (fail closed; no promotion)");
    for (const reason of receipt.rejectReasons) {
      lines.push(`  - ${reason}`);
    }
  } else if (receipt.outcome === "APPROVED") {
    lines.push("APPROVE — APPROVED derivative written");
  }
  return `${lines.join("\n")}\n`;
}

/** Canonicalize an existing path (must resolve on disk). */
export async function canonicalizeExistingPath(path: string): Promise<string> {
  return realpath(resolve(path));
}

/**
 * Canonicalize an output candidate. If the file does not exist yet, resolve
 * through the parent directory realpath when available.
 */
export async function canonicalizeOutputCandidate(path: string): Promise<string> {
  const abs = resolve(path);
  try {
    return await realpath(abs);
  } catch {
    try {
      const parentReal = await realpath(dirname(abs));
      return resolve(parentReal, basename(abs));
    } catch {
      return abs;
    }
  }
}

/**
 * Pre-write guard: output must not collide with any source/control path
 * consumed by the approval operation, and must not already exist.
 */
export async function assertSafeApprovalOutputPath(input: {
  outputPath: string;
  protectedPaths: ReadonlyArray<{ label: string; path: string }>;
}): Promise<string> {
  const canonicalOutput = await canonicalizeOutputCandidate(input.outputPath);

  for (const protectedEntry of input.protectedPaths) {
    let canonicalProtected: string;
    try {
      canonicalProtected = await canonicalizeExistingPath(protectedEntry.path);
    } catch {
      // Protected path may be absent (e.g. review report not persisted yet).
      canonicalProtected = resolve(protectedEntry.path);
    }
    if (canonicalOutput === canonicalProtected) {
      throw new MappingApplyReviewError(
        `Output path collision rejected (fail closed): output equals protected ${protectedEntry.label} (${canonicalProtected})`,
      );
    }
  }

  try {
    await realpath(canonicalOutput);
    throw new MappingApplyReviewError(
      `Output path already exists (fail closed; exclusive create only): ${canonicalOutput}`,
    );
  } catch (err) {
    if (err instanceof MappingApplyReviewError) throw err;
    // ENOENT — exclusive create may proceed.
  }

  return canonicalOutput;
}

/** Operator-level provenance: packet must name this reviewed artifact/run. */
export function assertPacketBindsToReviewedRun(
  packet: RspMappingReviewPacket,
  report: MappingReviewReport,
): void {
  if (packet.runId !== report.runId) {
    throw new MappingApplyReviewError(
      `Packet binding failed (fail closed): packet.runId=${packet.runId} !== report.runId=${report.runId}`,
    );
  }
  if (packet.mappingArtifactSha256.toLowerCase() !== report.mappingArtifactSha256.toLowerCase()) {
    throw new MappingApplyReviewError(
      `Packet binding failed (fail closed): packet.mappingArtifactSha256 does not match reviewed artifact SHA`,
    );
  }
}

/** APPROVE source must be exactly EVIDENCE + DRAFT. */
export function assertSourceLifecycleForApproval(
  artifact: Registry2012RspMappingArtifact,
): void {
  if (artifact.artifactPurpose !== "EVIDENCE" || artifact.approvalState !== "DRAFT") {
    throw new MappingApplyReviewError(
      `Source lifecycle rejected (fail closed): expected artifactPurpose=EVIDENCE and approvalState=DRAFT, got ${artifact.artifactPurpose}+${artifact.approvalState}`,
    );
  }
}

async function writeApprovedDerivativeExclusive(
  outputPath: string,
  contents: string,
): Promise<void> {
  // wx: fail if the path already exists — never overwrite.
  const handle = await open(outputPath, "wx");
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
}

function protectedControlPaths(input: {
  draftArtifactPath: string;
  reviewPacketPath: string;
  checkpointPath: string;
  stagingRoot: string;
  runId: string;
}): Array<{ label: string; path: string }> {
  return [
    { label: "DRAFT mapping.json", path: input.draftArtifactPath },
    { label: "review packet", path: input.reviewPacketPath },
    { label: "mapping-live checkpoint", path: input.checkpointPath },
    {
      label: "mapping-review report",
      path: stagingMappingReviewReportPath(input.stagingRoot, input.runId),
    },
    {
      label: "evidence-bundle manifest",
      path: stagingEvidenceBundleManifestPath(input.stagingRoot, input.runId),
    },
  ];
}

/**
 * Independently reviews the completed staging run, then applies the external
 * human decision packet under the existing approval contract.
 */
export async function runMappingApplyReview(
  options: MappingApplyReviewOptions,
): Promise<MappingApplyReviewReceipt> {
  const packetRaw = JSON.parse(await readFile(options.reviewPacketPath, "utf8")) as unknown;
  const packet = assertRspMappingReviewPacket(packetRaw);

  const layout = await resolveMappingRunLayout(options.runDir);
  const draftBytesBefore = await readFile(layout.artifactPath);
  const draftArtifactSha256 = sha256Hex(draftBytesBefore);
  const checkpointPath = mappingLiveCheckpointPath(layout.stagingRoot);

  const report =
    options.reviewReportOverride ??
    (await runMappingReview({
      workspaceRoot: options.workspaceRoot,
      runDir: options.runDir,
    }));

  // All decisions (APPROVE / HOLD / REJECT) must bind to this reviewed run.
  assertPacketBindsToReviewedRun(packet, report);

  if (packet.decision === "HOLD") {
    const draftBytesAfter = await readFile(layout.artifactPath);
    return baseReceipt({
      runId: layout.runId,
      draftArtifactPath: layout.artifactPath,
      draftArtifactSha256,
      reviewPacketPath: options.reviewPacketPath,
      packet,
      report,
      mechanicalEligibility: false,
      outcome: "HOLD_NO_PROMOTION",
      approvedOutputPath: null,
      approvedOutputSha256: null,
      originalArtifactUnchanged: Buffer.compare(draftBytesBefore, draftBytesAfter) === 0,
      rejectReasons: [],
    });
  }

  if (packet.decision === "REJECT") {
    const draftBytesAfter = await readFile(layout.artifactPath);
    return baseReceipt({
      runId: layout.runId,
      draftArtifactPath: layout.artifactPath,
      draftArtifactSha256,
      reviewPacketPath: options.reviewPacketPath,
      packet,
      report,
      mechanicalEligibility: false,
      outcome: "REJECT_NO_PROMOTION",
      approvedOutputPath: null,
      approvedOutputSha256: null,
      originalArtifactUnchanged: Buffer.compare(draftBytesBefore, draftBytesAfter) === 0,
      rejectReasons: [],
    });
  }

  // APPROVE path — fail closed unless mechanical contract passes.
  const validation = validateMappingApprovalPacket(report, packet);
  if (!validation.mechanicalApproveEligible) {
    const draftBytesAfter = await readFile(layout.artifactPath);
    const receipt = baseReceipt({
      runId: layout.runId,
      draftArtifactPath: layout.artifactPath,
      draftArtifactSha256,
      reviewPacketPath: options.reviewPacketPath,
      packet,
      report,
      mechanicalEligibility: false,
      outcome: "APPROVE_REJECTED",
      approvedOutputPath: null,
      approvedOutputSha256: null,
      originalArtifactUnchanged: Buffer.compare(draftBytesBefore, draftBytesAfter) === 0,
      rejectReasons: validation.errors,
    });
    throw new MappingApplyReviewError(
      `APPROVE rejected (fail closed): ${validation.errors.join("; ")}`,
      receipt,
    );
  }

  const draftArtifact = await loadRspMappingArtifact(layout.artifactPath);
  assertSourceLifecycleForApproval(draftArtifact);

  const approved = applyMechanicalMappingApproval(draftArtifact, report, packet);
  const requestedOutput =
    options.outputPath ?? stagingMappingApprovedArtifactPath(layout.stagingRoot, layout.runId);

  const safeOutputPath = await assertSafeApprovalOutputPath({
    outputPath: requestedOutput,
    protectedPaths: protectedControlPaths({
      draftArtifactPath: layout.artifactPath,
      reviewPacketPath: options.reviewPacketPath,
      checkpointPath,
      stagingRoot: layout.stagingRoot,
      runId: layout.runId,
    }),
  });

  // Re-check DRAFT bytes immediately before any write (prevention, not rollback).
  const draftBytesPreWrite = await readFile(layout.artifactPath);
  if (Buffer.compare(draftBytesBefore, draftBytesPreWrite) !== 0) {
    throw new MappingApplyReviewError(
      "Invariant violated before write: DRAFT mapping.json changed during apply-review",
    );
  }

  const approvedText = serializeApprovedArtifact(approved);
  await writeApprovedDerivativeExclusive(safeOutputPath, approvedText);

  const draftBytesAfter = await readFile(layout.artifactPath);
  const originalUnchanged = Buffer.compare(draftBytesBefore, draftBytesAfter) === 0;
  if (!originalUnchanged) {
    throw new MappingApplyReviewError(
      "Invariant violated: DRAFT mapping.json changed during apply-review",
    );
  }

  return baseReceipt({
    runId: layout.runId,
    draftArtifactPath: layout.artifactPath,
    draftArtifactSha256,
    reviewPacketPath: options.reviewPacketPath,
    packet,
    report,
    mechanicalEligibility: true,
    outcome: "APPROVED",
    approvedOutputPath: safeOutputPath,
    approvedOutputSha256: sha256Hex(Buffer.from(approvedText, "utf8")),
    originalArtifactUnchanged: true,
    rejectReasons: [],
  });
}
