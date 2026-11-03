/**
 * External human decision packet for historical RSP evidence promotion.
 * Tooling never decides APPROVE itself — it only mechanically verifies this packet.
 */
export const HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION =
  "historical-rsp-evidence-approval/1.0.0" as const;

export type HistoricalRspEvidenceApprovalDecision = "APPROVE" | "HOLD" | "REJECT";

export interface HistoricalRspEvidenceApprovalPacket {
  schemaVersion: typeof HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION;
  sourceExtractionSha256: string;
  stewardReviewSha256: string;
  decision: HistoricalRspEvidenceApprovalDecision;
  reviewer: string;
  reviewedAt: string;
  expectedCandidateRowCount: number;
  expectedReadyApplicationCount: number;
  notes?: string;
}

const REQUIRED_KEYS = [
  "schemaVersion",
  "sourceExtractionSha256",
  "stewardReviewSha256",
  "decision",
  "reviewer",
  "reviewedAt",
  "expectedCandidateRowCount",
  "expectedReadyApplicationCount",
] as const;

const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, "notes"]);

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertHistoricalRspEvidenceApprovalPacket(
  doc: unknown,
): HistoricalRspEvidenceApprovalPacket {
  if (!isPlainObject(doc)) {
    throw new Error("Approval packet must be a JSON object");
  }

  const unknownKeys = Object.keys(doc).filter((k) => !ALLOWED_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw new Error(`Approval packet has unknown fields: ${unknownKeys.sort().join(", ")}`);
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in doc)) {
      throw new Error(`Approval packet missing required field: ${key}`);
    }
  }

  if (doc.schemaVersion !== HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION) {
    throw new Error(`Unexpected schemaVersion: ${String(doc.schemaVersion)}`);
  }
  if (
    typeof doc.sourceExtractionSha256 !== "string" ||
    !SHA256_HEX.test(doc.sourceExtractionSha256)
  ) {
    throw new Error("sourceExtractionSha256 must be a 64-char hex SHA-256");
  }
  if (
    typeof doc.stewardReviewSha256 !== "string" ||
    !SHA256_HEX.test(doc.stewardReviewSha256)
  ) {
    throw new Error("stewardReviewSha256 must be a 64-char hex SHA-256");
  }
  if (
    doc.decision !== "APPROVE" &&
    doc.decision !== "HOLD" &&
    doc.decision !== "REJECT"
  ) {
    throw new Error(`Invalid decision: ${String(doc.decision)}`);
  }
  if (typeof doc.reviewer !== "string" || !doc.reviewer.trim()) {
    throw new Error("reviewer is required");
  }
  if (typeof doc.reviewedAt !== "string" || !doc.reviewedAt.trim()) {
    throw new Error("reviewedAt is required");
  }
  if (
    typeof doc.expectedCandidateRowCount !== "number" ||
    !Number.isInteger(doc.expectedCandidateRowCount) ||
    doc.expectedCandidateRowCount < 0
  ) {
    throw new Error("expectedCandidateRowCount must be a non-negative integer");
  }
  if (
    typeof doc.expectedReadyApplicationCount !== "number" ||
    !Number.isInteger(doc.expectedReadyApplicationCount) ||
    doc.expectedReadyApplicationCount < 0
  ) {
    throw new Error("expectedReadyApplicationCount must be a non-negative integer");
  }
  if (doc.notes !== undefined && typeof doc.notes !== "string") {
    throw new Error("notes must be a string when present");
  }

  const packet: HistoricalRspEvidenceApprovalPacket = {
    schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
    sourceExtractionSha256: doc.sourceExtractionSha256.toLowerCase(),
    stewardReviewSha256: doc.stewardReviewSha256.toLowerCase(),
    decision: doc.decision,
    reviewer: doc.reviewer,
    reviewedAt: doc.reviewedAt,
    expectedCandidateRowCount: doc.expectedCandidateRowCount,
    expectedReadyApplicationCount: doc.expectedReadyApplicationCount,
  };
  if (typeof doc.notes === "string") {
    packet.notes = doc.notes;
  }
  return packet;
}
