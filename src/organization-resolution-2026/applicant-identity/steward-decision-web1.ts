/**
 * Explicit operator steward approval batch for ORG-RES-WEB-1.
 * Decision authority is the product steward / operator — not the Build Agent.
 */

import WEB1_PACKAGE_JSON from "../fixtures/applicant-identity-evidence-package-web1.json";
import type { Web1StewardDecisionProvenance } from "../types";
import type { IdentityEvidencePackage } from "./types";

export const WEB1_STEWARD_DECISION_ID = "RIH-ORG-RES-WEB-1-20261012";
export const WEB1_STEWARD_DECISION_AUTHORITY = "operator-product-steward";
export const WEB1_STEWARD_DECISION_DATE = "2026-10-12";
export const WEB1_STEWARD_DECISION_SCOPE =
  "2026-organization-resolution-applicant-website-identity-confirmations";

/** Prior post-ALL14 semantic hash — WEB-1 applies only after ALL14 on this base. */
export const WEB1_EXPECT_PRE_SEMANTIC_HASH =
  "d19b5773dc72a95ba624441b1961762a15e76624ca3dff37bc4646ec4c1d0cdd";

/** Expected coverage after WEB-1 steward confirmations (recomputed; pinned for fail-closed). */
export const WEB1_EXPECTED_CONFIRMED_APPLICATIONS = 958;
export const WEB1_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS = 683;
export const WEB1_EXPECTED_CONFIRMED_ORGANIZATIONS = 19;
export const WEB1_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES = 75;

export type { Web1StewardDecisionProvenance };

export const WEB1_IDENTITY_EVIDENCE_PACKAGE = WEB1_PACKAGE_JSON as IdentityEvidencePackage;

export function web1ApprovedConfirmApplicantLegalNames(): string[] {
  return WEB1_IDENTITY_EVIDENCE_PACKAGE.dossiers
    .filter((d) => d.reviewRecommendation === "CONFIRM")
    .map((d) => d.applicantLegalName)
    .sort((a, b) => a.localeCompare(b));
}

export function web1StewardDecisionProvenance(
  sourceEvidencePackageSemanticHash: string,
): Web1StewardDecisionProvenance {
  return {
    decisionId: WEB1_STEWARD_DECISION_ID,
    authority: WEB1_STEWARD_DECISION_AUTHORITY,
    decidedAt: WEB1_STEWARD_DECISION_DATE,
    scope: WEB1_STEWARD_DECISION_SCOPE,
    approvedApplicantLegalNames: web1ApprovedConfirmApplicantLegalNames(),
    priorStewardDecisionId: "RIH-ORG-RES-2026-2-ALL14-20261009",
    sourceEvidencePackageSemanticHash,
    notes:
      "Operator explicit approval: ORG-RES-WEB-1 first-party ICANN Applicant Website + affiliate/parent/control evidence. Website-only never confirmed. Build Agent is not the steward.",
  };
}
