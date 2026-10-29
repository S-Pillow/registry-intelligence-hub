/**
 * Offline mapping-apply-review operator.
 *
 * Applies an external human mapping-review decision packet
 * (`rsp-mapping-review/1.0.0`) against a freshly computed offline mapping
 * review. Zero HTTP. Does not itself decide APPROVE — it only mechanically
 * promotes when the existing approval contract passes.
 *
 * Never overwrites DRAFT `mapping.json`. APPROVE writes a sibling
 * `mapping.approved.json` (or an explicit --output path).
 */
import { readFile, writeFile } from "node:fs/promises";
import { sha256Hex } from "@/normalization/hashes";
import { stagingMappingApprovedArtifactPath } from "./bundle-paths";
import { loadRspMappingArtifact } from "./load-manifest";
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

  const report =
    options.reviewReportOverride ??
    (await runMappingReview({
      workspaceRoot: options.workspaceRoot,
      runDir: options.runDir,
    }));

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
  const approved = applyMechanicalMappingApproval(draftArtifact, report, packet);
  const outputPath =
    options.outputPath ?? stagingMappingApprovedArtifactPath(layout.stagingRoot, layout.runId);
  const approvedText = serializeApprovedArtifact(approved);
  await writeFile(outputPath, approvedText, "utf8");

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
    approvedOutputPath: outputPath,
    approvedOutputSha256: sha256Hex(Buffer.from(approvedText, "utf8")),
    originalArtifactUnchanged: true,
    rejectReasons: [],
  });
}
