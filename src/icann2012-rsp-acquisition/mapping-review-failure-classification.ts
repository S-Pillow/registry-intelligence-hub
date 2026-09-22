export const MAPPING_REVIEW_FAILURE_CLASSIFICATIONS = [
  "EXACT_COMPLETE",
  "PARTIAL_MAPPING",
  "HTML_STRUCTURE_DRIFT",
  "PAGINATION_DRIFT",
  "RATE_LIMITED",
  "ACCESS_METHOD_NOT_AVAILABLE",
  "SOURCE_TEMPORARILY_UNAVAILABLE",
  "INTEGRITY_FAILURE",
  "CANCELLED",
] as const;

export type MappingReviewFailureClassification =
  (typeof MAPPING_REVIEW_FAILURE_CLASSIFICATIONS)[number];

export interface MappingReviewClassificationInput {
  reconciliationExact: boolean;
  integrityFailure: boolean;
  paginationDrift: boolean;
  htmlStructureDrift: boolean;
  stopReason?: string;
  checkpointState?: string;
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
  if (input.paginationDrift || /pagination/i.test(stop)) return "PAGINATION_DRIFT";
  if (input.htmlStructureDrift || /quarantine|ambiguous|parse/i.test(stop)) {
    return "HTML_STRUCTURE_DRIFT";
  }
  return "PARTIAL_MAPPING";
}
