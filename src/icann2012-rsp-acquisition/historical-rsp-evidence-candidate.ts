import type { EvidenceSourceClassification } from "./evidence-source-classification";
import type { PublicPortionVersionBasis } from "./public-portion-validation";
import { PUBLIC_PORTION_VERSION_BASIS } from "./public-portion-validation";

/**
 * Intermediate offline extraction result for historical RSP evidence.
 * Deliberately omits `rspKey` / confirmed relationship fields — steward review
 * and identity mapping are later governed actions (RIH-2012-RSP-VISIBILITY-1A).
 */
export const HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION =
  "historical-rsp-evidence-candidate/1.0.0" as const;

export const HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION =
  "historical-rsp-evidence-extraction/1.0.0" as const;

export type HistoricalRspEvidenceSourceFieldPath = "Q23" | "Q24" | "Q25";

export type HistoricalRspEvidenceDisposition =
  | "EXPLICIT_PROVIDER_CANDIDATE"
  | "EXPLICIT_SELF_OPERATED"
  | "NO_QUALIFYING_PROVIDER_ASSERTION"
  | "AMBIGUOUS_PROVIDER_RELATIONSHIP"
  | "MALFORMED_OR_UNUSABLE_SECTION"
  | "UNSUPPORTED_OR_MISSING_Q23_BASIS";

/** Positive candidate only — never CONFIRMED; never carries rspKey. */
export interface HistoricalRspEvidenceCandidate {
  schemaVersion: typeof HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION;
  applicationId: string;
  /** Provider wording preserved exactly as stated in evidence (after whitespace normalize). */
  providerNameAsStated: string;
  sourceFieldPath: HistoricalRspEvidenceSourceFieldPath;
  evidenceClassification: Extract<EvidenceSourceClassification, "PUBLIC_ICANN">;
  applicationVersionBasis: PublicPortionVersionBasis;
  reviewState: "REQUIRES_STEWARD_REVIEW";
  /** Deterministic locator back to the source section (not a full document dump). */
  evidenceLocator: string;
  /** Optional bounded excerpt; never a full public-portion body. */
  evidenceExcerpt?: string;
  /**
   * Literal role/service wording from the evidence when present.
   * Not a closed enum — do not invent roles without text support.
   */
  roleAsStated?: string;
}

export interface HistoricalRspEvidenceExtractionResult {
  schemaVersion: typeof HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION;
  disposition: HistoricalRspEvidenceDisposition;
  applicationId: string | null;
  applicationVersionBasis: PublicPortionVersionBasis;
  candidates: HistoricalRspEvidenceCandidate[];
  /** Deterministic diagnostic notes (stable order). */
  notes: string[];
}

export function emptyHistoricalRspEvidenceExtractionResult(
  disposition: HistoricalRspEvidenceDisposition,
  applicationId: string | null = null,
  notes: readonly string[] = [],
): HistoricalRspEvidenceExtractionResult {
  return {
    schemaVersion: HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
    disposition,
    applicationId,
    applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
    candidates: [],
    notes: [...notes],
  };
}
