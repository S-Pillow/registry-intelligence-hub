import type { ResearchEvidenceItem, ReviewRecommendation } from "../review-types";
import type { OrganizationResolutionState } from "../types";

export type IdentityRelationshipType =
  | "APPLICANT_WEBSITE"
  | "AFFILIATE_OF"
  | "DIRECT_PARENT"
  | "ULTIMATE_PARENT"
  | "ULTIMATE_CONTROL"
  | "BUSINESS_EMAIL_DOMAIN";

export type ApplicantIdentityContext = {
  representativeApplicationId: string;
  applicantWebsiteHost: string | null;
  applicantWebsiteUrl: string | null;
  directParentLegalName: string | null;
  ultimateParentLegalName: string | null;
  ultimateControlLegalName: string | null;
  evidenceExplanationLines: string[];
  relationshipTypes: IdentityRelationshipType[];
};

export type IdentityEvidenceDossier = {
  applicantLegalName: string;
  representativeApplicationId: string;
  candidateOrganizationKey: string | null;
  candidateCanonicalName: string | null;
  resolutionState: Exclude<OrganizationResolutionState, "CONFIRMED">;
  reviewRecommendation: ReviewRecommendation;
  recommendationReason: string;
  requiredStewardAction: string;
  temporalNote: string;
  applicantWebsiteHost: string | null;
  applicantWebsiteUrl: string | null;
  directParentLegalName: string | null;
  ultimateParentLegalName: string | null;
  ultimateControlLegalName: string | null;
  evidenceExplanationLines: string[];
  evidence: ResearchEvidenceItem[];
};

export type IdentityEvidencePackage = {
  packageVersion: "applicant-identity-evidence-package/1.0.0";
  methodNote: string;
  researchedAt: string;
  decisionId: string;
  dossiers: IdentityEvidenceDossier[];
};
