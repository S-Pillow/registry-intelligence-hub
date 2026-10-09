/**
 * Explicit operator steward approval for ORG-RES-2026-2A.
 * Decision authority is the product steward / operator — not the Build Agent.
 */

export const STEWARD_DECISION_ID = "RIH-ORG-RES-2026-2-ALL14-20261009";
export const STEWARD_DECISION_AUTHORITY = "operator-product-steward";
export const STEWARD_DECISION_DATE = "2026-10-09";
export const STEWARD_DECISION_SCOPE = "2026-organization-resolution-confirmations-only";

/** Exact Applicant legal names approved for CANDIDATE → CONFIRMED (order stable for tests). */
export const APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES = [
  "Aruba PEC S.P.A.",
  "Charleston Road Registry Inc.",
  "ECHO Domain Co L.L.C.",
  "Intercap Registry Inc.",
  "Knock Knock WHOIS There, LLC",
  "Link Freedom Group Ltd",
  "Meta Registry Holdings LLC",
  "Microsoft Corporation",
  "OPENAI OPCO, LLC",
  "Radix Technologies Inc SEZC",
  "Registry Services, LLC",
  "ShortDot (Ireland) Limited",
  "Squarespace Registry LLC",
  "XYZ.COM LLC",
] as const;

export type ApprovedConfirmApplicantLegalName = (typeof APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES)[number];

/** Expected recomputed coverage after applying all 14 approvals (acceptance check). */
export const EXPECTED_CONFIRMED_APPLICATIONS = 669;
export const EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS = 483;
export const EXPECTED_CONFIRMED_ORGANIZATIONS = 14;
export const EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES = 14;

export const PRE_STEWARD_SEMANTIC_HASH =
  "04316e1c52c94970f9f7a9c2afd83374ad3a6c4ceadd42b975f10d03f5f0b49b";

/** Deterministic hash after applying RIH-ORG-RES-2026-2-ALL14-20261009. */
export const POST_STEWARD_SEMANTIC_HASH =
  "d19b5773dc72a95ba624441b1961762a15e76624ca3dff37bc4646ec4c1d0cdd";

export type StewardDecisionProvenance = {
  decisionId: typeof STEWARD_DECISION_ID;
  authority: typeof STEWARD_DECISION_AUTHORITY;
  decidedAt: typeof STEWARD_DECISION_DATE;
  scope: typeof STEWARD_DECISION_SCOPE;
  approvedApplicantLegalNames: readonly string[];
  sourceEvidencePackageCommit: "c80d4041d38c8579cd85fcaf53c737121a90cc2e";
  sourceEvidencePackageSemanticHash: typeof PRE_STEWARD_SEMANTIC_HASH;
  notes: string;
};

export function stewardDecisionProvenance(): StewardDecisionProvenance {
  return {
    decisionId: STEWARD_DECISION_ID,
    authority: STEWARD_DECISION_AUTHORITY,
    decidedAt: STEWARD_DECISION_DATE,
    scope: STEWARD_DECISION_SCOPE,
    approvedApplicantLegalNames: [...APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES],
    sourceEvidencePackageCommit: "c80d4041d38c8579cd85fcaf53c737121a90cc2e",
    sourceEvidencePackageSemanticHash: PRE_STEWARD_SEMANTIC_HASH,
    notes:
      "Operator explicit approval: Approve all 14 recommendation=CONFIRM dossiers from ORG-RES-2026-2. Build Agent is not the steward.",
  };
}
