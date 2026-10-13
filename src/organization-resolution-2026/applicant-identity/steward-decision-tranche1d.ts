/**
 * Explicit operator steward approval batch for ORG-RES-TRANCHE-1D.
 * Decision authority is the product steward / operator — not the Build Agent.
 * Approves exactly the seven ORG-RES-TRANCHE-1C CONFIRM recommendations.
 */

import TRANCHE1C_PACKAGE_JSON from "../fixtures/applicant-identity-evidence-package-tranche1c.json";
import type { Tranche1dStewardDecisionProvenance } from "../types";
import type { IdentityEvidencePackage } from "./types";

export const TRANCHE1D_STEWARD_DECISION_ID = "RIH-ORG-RES-TRANCHE-1D-ALL7-20261013";
export const TRANCHE1D_STEWARD_DECISION_AUTHORITY = "operator-product-steward";
export const TRANCHE1D_STEWARD_DECISION_DATE = "2026-10-13";
export const TRANCHE1D_STEWARD_DECISION_SCOPE =
  "2026-organization-resolution-tranche-1c-confirm-approvals-only";

/** Source evidence package commit (immutable 1C research record). */
export const TRANCHE1C_EVIDENCE_PACKAGE_COMMIT = "1de5f3d2bdd605e76b4acd0ab9f91479edd35397";

/** Pre-approval semantic hash (post TRANCHE-1B accepted production state). */
export const TRANCHE1D_EXPECT_PRE_SEMANTIC_HASH =
  "52aca2c47520e42da7773b546fff4996f307a677e2ec679546dc568d9a0b2ad8";

/** Post-approval semantic hash (deterministic; fail-closed pin). */
export const TRANCHE1D_EXPECT_POST_SEMANTIC_HASH =
  "06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c";

/** Expected coverage after exactly seven tranche approvals (recomputed; pinned for fail-closed). */
export const TRANCHE1D_EXPECTED_CONFIRMED_APPLICATIONS = 1129;
export const TRANCHE1D_EXPECTED_CONFIRMED_BRAND_APPLICATIONS = 160;
export const TRANCHE1D_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS = 724;
export const TRANCHE1D_EXPECTED_CONFIRMED_ORGANIZATIONS = 104;
export const TRANCHE1D_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES = 161;
export const TRANCHE1D_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES = 315;
export const TRANCHE1D_EXPECTED_CANDIDATE_MAPPINGS = 2;
export const TRANCHE1D_EXPECTED_AMBIGUOUS_MAPPINGS = 2;
export const TRANCHE1D_EXPECTED_UNRESOLVED_APPLICATIONS = 445;
export const TRANCHE1D_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS = 171;

/**
 * Exact steward-approved Applicant → Organization transitions.
 * Order is documentation order; runtime uses sorted names for provenance.
 * `alibaba-group` is an existing Confirmed Organization (reuse).
 */
export const TRANCHE1D_APPROVED_TRANSITIONS = [
  {
    applicantLegalName: "Amazon Registry Services, Inc.",
    organizationKey: "amazon-registry-services",
    canonicalName: "Amazon Registry Services",
    reuseExistingKey: false,
  },
  {
    applicantLegalName: "AT&T Services, Inc.",
    organizationKey: "att-services",
    canonicalName: "AT&T Services",
    reuseExistingKey: false,
  },
  {
    applicantLegalName: "Taisho Pharmaceutical Co., Ltd.",
    organizationKey: "taisho-pharmaceutical",
    canonicalName: "Taisho Pharmaceutical",
    reuseExistingKey: false,
  },
  {
    applicantLegalName: "Corporation Service Company",
    organizationKey: "corporation-service-company",
    canonicalName: "Corporation Service Company",
    reuseExistingKey: false,
  },
  {
    applicantLegalName: "Cam Connecting SARL",
    organizationKey: "cam-connecting",
    canonicalName: "Cam Connecting",
    reuseExistingKey: false,
  },
  {
    applicantLegalName: "ALIBABA INNOVATION PRIVATE LIMITED",
    organizationKey: "alibaba-group",
    canonicalName: "Alibaba Group",
    reuseExistingKey: true,
  },
  {
    applicantLegalName: "American Lebanese Syrian Associated Charities, Inc.",
    organizationKey: "alsac",
    canonicalName: "ALSAC",
    reuseExistingKey: false,
  },
] as const;

/** 1C KEEP_CANDIDATE dossiers explicitly not approved in this unit. */
export const TRANCHE1D_NON_APPROVED_KEEP = [
  "Registered Agents Inc",
  "NAME SPACE LLC",
  "TechEdge Limited",
] as const;

export type { Tranche1dStewardDecisionProvenance };

export const TRANCHE1C_IDENTITY_EVIDENCE_PACKAGE = TRANCHE1C_PACKAGE_JSON as IdentityEvidencePackage;

export function tranche1dApprovedApplicantLegalNames(): string[] {
  return TRANCHE1D_APPROVED_TRANSITIONS.map((t) => t.applicantLegalName).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function tranche1dApprovedOrganizationKeys(): string[] {
  return [...new Set(TRANCHE1D_APPROVED_TRANSITIONS.map((t) => t.organizationKey))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function tranche1dNewOrganizationKeys(): string[] {
  return TRANCHE1D_APPROVED_TRANSITIONS.filter((t) => !t.reuseExistingKey)
    .map((t) => t.organizationKey)
    .sort((a, b) => a.localeCompare(b));
}

export function tranche1dReuseOrganizationKeys(): string[] {
  return TRANCHE1D_APPROVED_TRANSITIONS.filter((t) => t.reuseExistingKey)
    .map((t) => t.organizationKey)
    .sort((a, b) => a.localeCompare(b));
}

/** CONFIRM-only slice of the immutable 1C package used for steward attach (not a rewrite of 1C). */
export function tranche1dConfirmEvidencePackage(): IdentityEvidencePackage {
  const approved = new Set(tranche1dApprovedApplicantLegalNames());
  const dossiers = TRANCHE1C_IDENTITY_EVIDENCE_PACKAGE.dossiers.filter((d) =>
    approved.has(d.applicantLegalName),
  );
  if (dossiers.length !== TRANCHE1D_APPROVED_TRANSITIONS.length) {
    throw new Error(
      `TRANCHE-1D confirm package size ${dossiers.length} != ${TRANCHE1D_APPROVED_TRANSITIONS.length}`,
    );
  }
  return {
    ...TRANCHE1C_IDENTITY_EVIDENCE_PACKAGE,
    methodNote: `${TRANCHE1C_IDENTITY_EVIDENCE_PACKAGE.methodNote} | TRANCHE-1D steward attach uses CONFIRM dossiers only (research package unchanged on disk).`,
    dossiers,
  };
}

export function tranche1dStewardDecisionProvenance(
  sourceEvidencePackageSemanticHash: string,
): Tranche1dStewardDecisionProvenance {
  return {
    decisionId: TRANCHE1D_STEWARD_DECISION_ID,
    authority: TRANCHE1D_STEWARD_DECISION_AUTHORITY,
    decidedAt: TRANCHE1D_STEWARD_DECISION_DATE,
    scope: TRANCHE1D_STEWARD_DECISION_SCOPE,
    approvedApplicantLegalNames: tranche1dApprovedApplicantLegalNames(),
    priorStewardDecisionId: "RIH-ORG-RES-TRANCHE-1B-ALL9-20261013",
    sourceEvidencePackageSemanticHash,
    sourceEvidencePackageCommit: TRANCHE1C_EVIDENCE_PACKAGE_COMMIT,
    notes:
      "Operator explicit approval: Approve all 7 ORG-RES-TRANCHE-1C CONFIRM recommendations (RIH-ORG-RES-TRANCHE-1D-ALL7-20261013). KEEP_CANDIDATE (Registered Agents Inc, NAME SPACE LLC, TechEdge Limited) not approved. Alibaba Group reuses existing Confirmed Organization key alibaba-group. Build Agent is not the steward. 1C evidence package remains the pre-approval research record.",
  };
}
