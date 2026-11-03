/**
 * Approved historical RSP evidence derivative.
 * Distinct from candidate schema — approval does not normalize provider identity.
 */
import type { HistoricalRspEvidenceApprovalPacket } from "./historical-rsp-evidence-approval";
import type { HistoricalRspEvidenceCandidate } from "./historical-rsp-evidence-candidate";

export const HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION =
  "historical-rsp-approved-evidence/1.0.0" as const;

export const HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION =
  "historical-rsp-approved-evidence-row/1.0.0" as const;

export interface HistoricalRspApprovedEvidenceRow {
  schemaVersion: typeof HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION;
  applicationId: string;
  providerNameAsStated: string;
  sourceFieldPath: "Q23" | "Q24" | "Q25";
  evidenceClassification: "PUBLIC_ICANN";
  applicationVersionBasis: "current_public_portion";
  evidenceLocator: string;
  evidenceExcerpt?: string;
  roleAsStated?: string;
  approvalState: "APPROVED";
  approvalBasis: "STEWARD_REVIEW";
}

export interface HistoricalRspApprovedEvidenceArtifact {
  schemaVersion: typeof HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION;
  artifactPurpose: "EVIDENCE";
  approvalState: "APPROVED";
  sourceExtractionSha256: string;
  sourceExtractionDeterministicPayloadHash: string | null;
  sourceExtractionToolingSha: string | null;
  stewardReviewSha256: string;
  approvalPacketSha256: string;
  reviewer: string;
  reviewedAt: string;
  sourceApplicationCount: number;
  candidateBearingApplicationCount: number;
  approvedApplicationCount: number;
  approvedEvidenceRowCount: number;
  approvedEvidenceRows: HistoricalRspApprovedEvidenceRow[];
}

export function toApprovedEvidenceRow(
  candidate: HistoricalRspEvidenceCandidate,
): HistoricalRspApprovedEvidenceRow {
  const row: HistoricalRspApprovedEvidenceRow = {
    schemaVersion: HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION,
    applicationId: candidate.applicationId,
    providerNameAsStated: candidate.providerNameAsStated,
    sourceFieldPath: candidate.sourceFieldPath,
    evidenceClassification: "PUBLIC_ICANN",
    applicationVersionBasis: "current_public_portion",
    evidenceLocator: candidate.evidenceLocator,
    approvalState: "APPROVED",
    approvalBasis: "STEWARD_REVIEW",
  };
  if (candidate.evidenceExcerpt !== undefined) {
    row.evidenceExcerpt = candidate.evidenceExcerpt;
  }
  if (candidate.roleAsStated !== undefined && candidate.roleAsStated !== null) {
    row.roleAsStated = candidate.roleAsStated;
  }
  return row;
}

export function buildHistoricalRspApprovedEvidenceArtifact(input: {
  candidates: readonly HistoricalRspEvidenceCandidate[];
  sourceExtractionSha256: string;
  sourceExtractionDeterministicPayloadHash: string | null;
  sourceExtractionToolingSha: string | null;
  stewardReviewSha256: string;
  approvalPacketSha256: string;
  packet: HistoricalRspEvidenceApprovalPacket;
  sourceApplicationCount: number;
  candidateBearingApplicationCount: number;
}): HistoricalRspApprovedEvidenceArtifact {
  const approvedEvidenceRows = input.candidates.map(toApprovedEvidenceRow);
  const approvedApplicationIds = new Set(
    approvedEvidenceRows.map((r) => r.applicationId),
  );
  return {
    schemaVersion: HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION,
    artifactPurpose: "EVIDENCE",
    approvalState: "APPROVED",
    sourceExtractionSha256: input.sourceExtractionSha256.toLowerCase(),
    sourceExtractionDeterministicPayloadHash:
      input.sourceExtractionDeterministicPayloadHash?.toLowerCase() ?? null,
    sourceExtractionToolingSha: input.sourceExtractionToolingSha?.toLowerCase() ?? null,
    stewardReviewSha256: input.stewardReviewSha256.toLowerCase(),
    approvalPacketSha256: input.approvalPacketSha256.toLowerCase(),
    reviewer: input.packet.reviewer,
    reviewedAt: input.packet.reviewedAt,
    sourceApplicationCount: input.sourceApplicationCount,
    candidateBearingApplicationCount: input.candidateBearingApplicationCount,
    approvedApplicationCount: approvedApplicationIds.size,
    approvedEvidenceRowCount: approvedEvidenceRows.length,
    approvedEvidenceRows,
  };
}

export function serializeHistoricalRspApprovedEvidence(
  artifact: HistoricalRspApprovedEvidenceArtifact,
): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
