export const MAPPING_REVIEW_FAILURE_CLASSIFICATIONS = [
  "EXACT_COMPLETE",
  "PARTIAL_MAPPING",
  "HTML_STRUCTURE_DRIFT",
  "PAGINATION_DRIFT",
  "ICANN_ERROR_PAGE",
  "RATE_LIMITED",
  "ACCESS_METHOD_NOT_AVAILABLE",
  "SOURCE_TEMPORARILY_UNAVAILABLE",
  "INTEGRITY_FAILURE",
  "CANCELLED",
] as const;

export const MAPPING_REVIEW_SECONDARY_FAILURE_FLAGS = [
  "PILOT_INCOMPLETE",
  "CHECKPOINT_ARTIFACT_MISMATCH",
  "PAGINATION_DIAGNOSTICS_INCONSISTENT",
  "QUARANTINED_GRID_BLOCKS",
  "NON_GRID_PAGE_PRESENT",
  "VALIDATION_LEAD_MISMATCH",
  "CORPUS_PIN_MISMATCH",
] as const;

export type MappingReviewSecondaryFailureFlag =
  (typeof MAPPING_REVIEW_SECONDARY_FAILURE_FLAGS)[number];

export type MappingReviewFailureClassification =
  (typeof MAPPING_REVIEW_FAILURE_CLASSIFICATIONS)[number];

export interface MappingReviewClassificationInput {
  reconciliationExact: boolean;
  integrityFailure: boolean;
  paginationDrift: boolean;
  htmlStructureDrift: boolean;
  icannErrorPagePresent?: boolean;
  stopReason?: string;
  checkpointState?: string;
}

export interface MappingReviewSecondaryFlagInput {
  reconciliationExact: boolean;
  pilotResolvedCount: number;
  pilotExpectedCount: number;
  checkpointConsistentWithArtifact: boolean;
  paginationDiagnosticsConsistent: boolean;
  quarantinedPageOrdinals: number[];
  nonGridPageOrdinals: number[];
  validationLeadsMatched: boolean;
  corpusPinValid: boolean;
}

export function collectMappingReviewSecondaryFailureFlags(
  input: MappingReviewSecondaryFlagInput,
): MappingReviewSecondaryFailureFlag[] {
  const flags: MappingReviewSecondaryFailureFlag[] = [];
  if (input.pilotResolvedCount < input.pilotExpectedCount) flags.push("PILOT_INCOMPLETE");
  if (!input.checkpointConsistentWithArtifact) flags.push("CHECKPOINT_ARTIFACT_MISMATCH");
  if (!input.paginationDiagnosticsConsistent) flags.push("PAGINATION_DIAGNOSTICS_INCONSISTENT");
  if (input.quarantinedPageOrdinals.length > 0) flags.push("QUARANTINED_GRID_BLOCKS");
  if (input.nonGridPageOrdinals.length > 0) flags.push("NON_GRID_PAGE_PRESENT");
  if (!input.validationLeadsMatched) flags.push("VALIDATION_LEAD_MISMATCH");
  if (!input.corpusPinValid) flags.push("CORPUS_PIN_MISMATCH");
  if (input.reconciliationExact && flags.length > 0) {
    return flags;
  }
  return flags;
}

export function classifyMappingReviewFailure(
  input: MappingReviewClassificationInput,
): MappingReviewFailureClassification {
  if (input.integrityFailure) return "INTEGRITY_FAILURE";
  if (input.reconciliationExact) return "EXACT_COMPLETE";

  const stop = (input.stopReason ?? "").toLowerCase();
  if (input.checkpointState === "failed" && /interrupt|cancel|operator/i.test(stop)) {
    return "CANCELLED";
  }
  if (/429|rate.?limit/i.test(stop)) return "RATE_LIMITED";
  if (/403|access method|not available/i.test(stop)) return "ACCESS_METHOD_NOT_AVAILABLE";
  if (/503|502|temporarily unavailable|timeout/i.test(stop)) {
    return "SOURCE_TEMPORARILY_UNAVAILABLE";
  }
  if (input.icannErrorPagePresent || /icann error page/i.test(stop)) {
    return "ICANN_ERROR_PAGE";
  }
  if (input.paginationDrift || /pagination/i.test(stop)) return "PAGINATION_DRIFT";
  if (input.htmlStructureDrift || /quarantine|ambiguous|parse/i.test(stop)) {
    return "HTML_STRUCTURE_DRIFT";
  }
  return "PARTIAL_MAPPING";
}
