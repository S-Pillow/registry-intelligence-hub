import type { MappingReviewReport } from "./mapping-review";

export const RSP_MAPPING_REVIEW_SCHEMA_VERSION = "rsp-mapping-review/1.0.0" as const;

export type MappingReviewDecision = "APPROVE" | "REJECT" | "HOLD";

export interface RspMappingReviewPacket {
  reviewVersion: typeof RSP_MAPPING_REVIEW_SCHEMA_VERSION;
  mappingArtifactSha256: string;
  runId: string;
  reviewer: string;
  reviewedAt: string;
  decision: MappingReviewDecision;
  notes?: string;
}

export interface MappingApprovalValidationResult {
  valid: boolean;
  errors: string[];
  /** When valid and decision APPROVE, artifact may move DRAFT → APPROVED mechanically. */
  mechanicalApproveEligible: boolean;
}

export function assertRspMappingReviewPacket(doc: unknown): RspMappingReviewPacket {
  const packet = doc as RspMappingReviewPacket;
  if (packet.reviewVersion !== RSP_MAPPING_REVIEW_SCHEMA_VERSION) {
    throw new Error(`Unexpected reviewVersion: ${(doc as { reviewVersion?: string }).reviewVersion}`);
  }
  if (!packet.mappingArtifactSha256?.match(/^[a-f0-9]{64}$/i)) {
    throw new Error("mappingArtifactSha256 must be a 64-char hex SHA-256");
  }
  if (!packet.runId?.trim()) {
    throw new Error("runId is required");
  }
  if (!packet.reviewer?.trim()) {
    throw new Error("reviewer is required");
  }
  if (!packet.reviewedAt?.trim()) {
    throw new Error("reviewedAt is required");
  }
  if (packet.decision !== "APPROVE" && packet.decision !== "REJECT" && packet.decision !== "HOLD") {
    throw new Error(`Invalid decision: ${packet.decision}`);
  }
  return packet;
}

export function validateMappingApprovalPacket(
  report: MappingReviewReport,
  packet: RspMappingReviewPacket,
): MappingApprovalValidationResult {
  const errors: string[] = [];

  if (packet.decision === "APPROVE") {
    if (packet.mappingArtifactSha256.toLowerCase() !== report.mappingArtifactSha256.toLowerCase()) {
      errors.push("mappingArtifactSha256 does not match reviewed artifact");
    }
    if (packet.runId !== report.runId) {
      errors.push("runId does not match reviewed mapping run");
    }
    if (!report.mappingReviewPass) {
      errors.push("APPROVE rejected: mapping-review did not pass");
    }
    if (report.reviewHold) {
      errors.push("APPROVE rejected: review hold is active");
    }
    if (report.integrityFailures.length > 0) {
      errors.push("APPROVE rejected: integrity failures present");
    }
    if (!report.roundWideExact) {
      errors.push(
        "APPROVE rejected: ROUND_WIDE_EXACT is false — incomplete round-wide stays DRAFT (use PILOT_ONLY_EXACT candidate separately)",
      );
    }
  }

  const mechanicalApproveEligible =
    packet.decision === "APPROVE" &&
    errors.length === 0 &&
    report.mappingReviewPass &&
    report.roundWideExact;

  return {
    valid: packet.decision === "APPROVE" ? mechanicalApproveEligible : true,
    errors,
    mechanicalApproveEligible,
  };
}

/** Mechanical DRAFT→APPROVED — only after explicit human APPROVE + full review pass. */
export function applyMechanicalMappingApproval(
  artifact: import("./types").Registry2012RspMappingArtifact,
  report: MappingReviewReport,
  packet: RspMappingReviewPacket,
): import("./types").Registry2012RspMappingArtifact {
  const validation = validateMappingApprovalPacket(report, packet);
  if (!validation.mechanicalApproveEligible) {
    throw new Error(validation.errors.join("; ") || "Mechanical approval rejected");
  }
  return { ...artifact, approvalState: "APPROVED" };
}
