/**
 * Explicit operator steward approval batch for ORG-RES-BRAND-1.
 * Decision authority is the product steward / operator — not the Build Agent.
 */

import BRAND1_PACKAGE_JSON from "../fixtures/applicant-identity-evidence-package-brand1.json";
import type { Brand1StewardDecisionProvenance } from "../types";
import type { IdentityEvidencePackage } from "./types";

export const BRAND1_STEWARD_DECISION_ID = "RIH-ORG-RES-BRAND-1-20261012";
export const BRAND1_STEWARD_DECISION_AUTHORITY = "operator-product-steward";
export const BRAND1_STEWARD_DECISION_DATE = "2026-10-12";
export const BRAND1_STEWARD_DECISION_SCOPE =
  "2026-organization-resolution-brand-applicant-self-identity-confirmations";

/** Prior post-WEB-1 semantic hash — BRAND-1 applies only after WEB-1 on this base. */
export const BRAND1_EXPECT_PRE_SEMANTIC_HASH =
  "6dbbe567816c0afb2091eb5fb6eb8b0da5c8a32dbf00d461806ae70e84851199";

/** Expected coverage after BRAND-1 steward confirmations (recomputed; pinned for fail-closed). */
export const BRAND1_EXPECTED_CONFIRMED_APPLICATIONS = 1036;
export const BRAND1_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS = 685;
export const BRAND1_EXPECTED_CONFIRMED_ORGANIZATIONS = 89;
export const BRAND1_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES = 145;

export type { Brand1StewardDecisionProvenance };

export const BRAND1_IDENTITY_EVIDENCE_PACKAGE = BRAND1_PACKAGE_JSON as IdentityEvidencePackage;

export function brand1ApprovedConfirmApplicantLegalNames(): string[] {
  return BRAND1_IDENTITY_EVIDENCE_PACKAGE.dossiers
    .filter((d) => d.reviewRecommendation === "CONFIRM")
    .map((d) => d.applicantLegalName)
    .sort((a, b) => a.localeCompare(b));
}

export function brand1StewardDecisionProvenance(
  sourceEvidencePackageSemanticHash: string,
): Brand1StewardDecisionProvenance {
  return {
    decisionId: BRAND1_STEWARD_DECISION_ID,
    authority: BRAND1_STEWARD_DECISION_AUTHORITY,
    decidedAt: BRAND1_STEWARD_DECISION_DATE,
    scope: BRAND1_STEWARD_DECISION_SCOPE,
    approvedApplicantLegalNames: brand1ApprovedConfirmApplicantLegalNames(),
    priorStewardDecisionId: "RIH-ORG-RES-WEB-1-20261012",
    sourceEvidencePackageSemanticHash,
    notes:
      "Operator explicit approval: ORG-RES-BRAND-1 Brand + Website + legal-name self-identity confirmations from first-party ICANN evidence. Brand-alone and website-alone never confirmed. Applied-for strings (e.g. slack/tableau) are not Organizations. Build Agent is not the steward.",
  };
}
