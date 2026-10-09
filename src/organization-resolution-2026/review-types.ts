import type { EvidenceStrength, OrganizationResolutionState } from "./types";

/** Agent/steward-review recommendation — never itself a confirmation. */
export type ReviewRecommendation =
  | "CONFIRM"
  | "KEEP_CANDIDATE"
  | "MARK_AMBIGUOUS"
  | "REJECT_RELATIONSHIP"
  | "NO_EVIDENCE";

export type ResearchQueueReason = "existing-candidate" | "top-app-count" | "top-contention";

export type ResearchQueueEntry = {
  applicantLegalName: string;
  queueReasons: ResearchQueueReason[];
  observedApplicationCount: number;
  officialContentionMemberships: number;
};

export type ResearchEvidenceItem = {
  evidenceId: string;
  strength: EvidenceStrength;
  sourceType:
    | "aps-publication"
    | "icann-public-summary"
    | "first-party-corporate"
    | "regulatory-registry"
    | "sec-filing"
    | "steward-note"
    | "2012-promotion-alias";
  sourceIdentifier: string;
  title: string;
  asOf: string;
  retrievedAt: string;
  summary: string;
  supportsClaim: string;
  temporalRelevance: string;
  limitations: string;
};

export type StewardReviewDossier = {
  dossierId: string;
  applicantLegalName: string;
  observedApplicationCount: number;
  officialContentionMemberships: number;
  queueReasons: ResearchQueueReason[];
  /** Mapping state after research attach — never auto-CONFIRMED by research. */
  resolutionState: OrganizationResolutionState;
  candidateOrganizationKey: string | null;
  candidateOrganizationId: string | null;
  candidateCanonicalName: string | null;
  possible2012OrganizationKey: string | null;
  reviewRecommendation: ReviewRecommendation;
  recommendationReason: string;
  requiredStewardAction: string;
  strongestEvidenceStrength: EvidenceStrength | null;
  evidenceIds: string[];
  temporalNote: string;
  stewardDecision: "" | "APPROVE" | "REJECT" | "KEEP_CANDIDATE" | "DEFER";
  /** Present after steward application — durable history: recommendation → approval → CONFIRMED. */
  stewardDecisionId?: string;
  stewardDecisionAuthority?: string;
  stewardDecidedAt?: string;
  priorResolutionState?: OrganizationResolutionState;
};

export type ResearchPackage = {
  packageVersion: "organization-research-package/1.0.0";
  methodNote: string;
  researchedAt: string;
  dossiers: Array<{
    applicantLegalName: string;
    candidateOrganizationKey: string | null;
    candidateCanonicalName: string | null;
    /** Desired mapping state after research — CONFIRMED forbidden for new research. */
    resolutionState: Exclude<OrganizationResolutionState, "CONFIRMED">;
    reviewRecommendation: ReviewRecommendation;
    recommendationReason: string;
    requiredStewardAction: string;
    possible2012OrganizationKey?: string | null;
    temporalNote: string;
    evidence: ResearchEvidenceItem[];
  }>;
};
