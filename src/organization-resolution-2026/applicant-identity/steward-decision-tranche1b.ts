/**
 * Explicit operator steward approval batch for ORG-RES-TRANCHE-1B.
 * Decision authority is the product steward / operator — not the Build Agent.
 * Approves exactly the nine ORG-RES-TRANCHE-1A CONFIRM recommendations.
 */

import TRANCHE1_PACKAGE_JSON from "../fixtures/applicant-identity-evidence-package-tranche1.json";
import type { Tranche1bStewardDecisionProvenance } from "../types";
import type { IdentityEvidencePackage } from "./types";

export const TRANCHE1B_STEWARD_DECISION_ID = "RIH-ORG-RES-TRANCHE-1B-ALL9-20261013";
export const TRANCHE1B_STEWARD_DECISION_AUTHORITY = "operator-product-steward";
export const TRANCHE1B_STEWARD_DECISION_DATE = "2026-10-13";
export const TRANCHE1B_STEWARD_DECISION_SCOPE =
  "2026-organization-resolution-tranche-1a-confirm-approvals-only";

/** Source evidence package commit (immutable 1A research record). */
export const TRANCHE1A_EVIDENCE_PACKAGE_COMMIT = "35b1ff868e6e2c37dff454ea81f3d026af20909e";

/** Pre-approval semantic hash (post BRAND-1 accepted production state). */
export const TRANCHE1B_EXPECT_PRE_SEMANTIC_HASH =
  "4837173224fc89ae617de3620396950e18c8da99a5333459a8782e032ce3bb87";

/** Expected coverage after exactly nine tranche approvals (recomputed; pinned for fail-closed). */
export const TRANCHE1B_EXPECTED_CONFIRMED_APPLICATIONS = 1099;
export const TRANCHE1B_EXPECTED_CONFIRMED_BRAND_APPLICATIONS = 141;
export const TRANCHE1B_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS = 714;
export const TRANCHE1B_EXPECTED_CONFIRMED_ORGANIZATIONS = 98;
export const TRANCHE1B_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES = 154;
export const TRANCHE1B_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES = 322;
export const TRANCHE1B_EXPECTED_CANDIDATE_MAPPINGS = 2;
export const TRANCHE1B_EXPECTED_AMBIGUOUS_MAPPINGS = 2;
export const TRANCHE1B_EXPECTED_UNRESOLVED_APPLICATIONS = 475;
export const TRANCHE1B_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS = 190;

/**
 * Exact steward-approved Applicant → Organization transitions.
 * Order is documentation order; runtime uses sorted names for provenance.
 */
export const TRANCHE1B_APPROVED_TRANSITIONS = [
  {
    applicantLegalName: "Suffix Inc.",
    organizationKey: "suffix",
    canonicalName: "Suffix",
  },
  {
    applicantLegalName: "Endpoint Domains, Inc.",
    organizationKey: "endpoint-domains",
    canonicalName: "Endpoint Domains",
  },
  {
    applicantLegalName: "Public Interest Registry",
    organizationKey: "public-interest-registry",
    canonicalName: "Public Interest Registry",
  },
  {
    applicantLegalName: "Dine Brands Global, Inc.",
    organizationKey: "dine-brands-global",
    canonicalName: "Dine Brands Global",
  },
  {
    applicantLegalName: "Axon Enterprise, Inc.",
    organizationKey: "axon-enterprise",
    canonicalName: "Axon Enterprise",
  },
  {
    applicantLegalName: "Canadian Imperial Bank of Commerce",
    organizationKey: "canadian-imperial-bank-of-commerce",
    canonicalName: "Canadian Imperial Bank of Commerce",
  },
  {
    applicantLegalName: "Epic systems corporation",
    organizationKey: "epic-systems",
    canonicalName: "Epic Systems",
  },
  {
    applicantLegalName: "Industria de Diseño Textil S.A.",
    organizationKey: "inditex",
    canonicalName: "Inditex",
  },
  {
    applicantLegalName: "Hostinger UAB",
    organizationKey: "hostinger",
    canonicalName: "Hostinger",
  },
] as const;

export type { Tranche1bStewardDecisionProvenance };

export const TRANCHE1_IDENTITY_EVIDENCE_PACKAGE = TRANCHE1_PACKAGE_JSON as IdentityEvidencePackage;

export function tranche1bApprovedApplicantLegalNames(): string[] {
  return TRANCHE1B_APPROVED_TRANSITIONS.map((t) => t.applicantLegalName).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function tranche1bApprovedOrganizationKeys(): string[] {
  return TRANCHE1B_APPROVED_TRANSITIONS.map((t) => t.organizationKey).sort((a, b) =>
    a.localeCompare(b),
  );
}

/** CONFIRM-only slice of the immutable 1A package used for steward attach (not a rewrite of 1A). */
export function tranche1bConfirmEvidencePackage(): IdentityEvidencePackage {
  const approved = new Set(tranche1bApprovedApplicantLegalNames());
  const dossiers = TRANCHE1_IDENTITY_EVIDENCE_PACKAGE.dossiers.filter((d) =>
    approved.has(d.applicantLegalName),
  );
  if (dossiers.length !== TRANCHE1B_APPROVED_TRANSITIONS.length) {
    throw new Error(
      `TRANCHE-1B confirm package size ${dossiers.length} != ${TRANCHE1B_APPROVED_TRANSITIONS.length}`,
    );
  }
  return {
    ...TRANCHE1_IDENTITY_EVIDENCE_PACKAGE,
    methodNote: `${TRANCHE1_IDENTITY_EVIDENCE_PACKAGE.methodNote} | TRANCHE-1B steward attach uses CONFIRM dossiers only (research package unchanged on disk).`,
    dossiers,
  };
}

export function tranche1bStewardDecisionProvenance(
  sourceEvidencePackageSemanticHash: string,
): Tranche1bStewardDecisionProvenance {
  return {
    decisionId: TRANCHE1B_STEWARD_DECISION_ID,
    authority: TRANCHE1B_STEWARD_DECISION_AUTHORITY,
    decidedAt: TRANCHE1B_STEWARD_DECISION_DATE,
    scope: TRANCHE1B_STEWARD_DECISION_SCOPE,
    approvedApplicantLegalNames: tranche1bApprovedApplicantLegalNames(),
    priorStewardDecisionId: "RIH-ORG-RES-BRAND-1-20261012",
    sourceEvidencePackageSemanticHash,
    sourceEvidencePackageCommit: TRANCHE1A_EVIDENCE_PACKAGE_COMMIT,
    notes:
      "Operator explicit approval: Approve all 9 ORG-RES-TRANCHE-1A CONFIRM recommendations (RIH-ORG-RES-TRANCHE-1B-ALL9-20261013). KEEP_CANDIDATE / MARK_AMBIGUOUS / NO_EVIDENCE not approved. Build Agent is not the steward. 1A evidence package remains the pre-approval research record.",
  };
}
