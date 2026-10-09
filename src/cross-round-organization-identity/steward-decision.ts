/**
 * Explicit operator steward approval for CROSS-ROUND-ID-1A.
 * Decision authority is the product steward / operator — not the Build Agent.
 */

export const CROSS_ROUND_STEWARD_DECISION_ID = "RIH-CROSS-ROUND-ID-1-BOTH-20261009";
export const CROSS_ROUND_STEWARD_DECISION_AUTHORITY = "operator-product-steward";
export const CROSS_ROUND_STEWARD_DECISION_DATE = "2026-10-09";
export const CROSS_ROUND_STEWARD_DECISION_SCOPE = "cross-round-organization-identity-only";

/** Exact approved pairs (Organization IDs are canonical). */
export const APPROVED_CROSS_ROUND_PAIRS = [
  {
    organization2026Id: "organization:resolved-2026:hist-2012-microsoft",
    organization2012Id: "organization:promoted:microsoft",
    relationshipType: "SAME_ORGANIZATION",
  },
  {
    organization2026Id: "organization:resolved-2026:hist-2012-google-charleston-road",
    organization2012Id: "organization:promoted:google-charleston-road",
    relationshipType: "SAME_ORGANIZATION",
  },
] as const;

export const EXPECTED_CONFIRMED_CROSS_ROUND_MAPPINGS = 2;
export const EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026 = 41;
export const EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012 = 112;

/** Accepted CROSS-ROUND-ID-1 pre-steward semantic hash. */
export const PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH =
  "2d66e19aaabf5323293cf0aced79b2223ca7d497f91e6ff70c09e28d75179bb2";

/** Deterministic hash after applying RIH-CROSS-ROUND-ID-1-BOTH-20261009. */
export const POST_STEWARD_CROSS_ROUND_SEMANTIC_HASH =
  "87f5aad91fb1c59a0082ae046c4d3017408f18c79253f78ef162ba3f9c4b9621";

export type CrossRoundStewardDecisionProvenance = {
  decisionId: typeof CROSS_ROUND_STEWARD_DECISION_ID;
  authority: typeof CROSS_ROUND_STEWARD_DECISION_AUTHORITY;
  decidedAt: typeof CROSS_ROUND_STEWARD_DECISION_DATE;
  scope: typeof CROSS_ROUND_STEWARD_DECISION_SCOPE;
  approvedPairs: readonly {
    organization2026Id: string;
    organization2012Id: string;
    relationshipType: "SAME_ORGANIZATION";
  }[];
  sourceEvidencePackageCommit: "9c05725c8c92687b5e6b7926182e6559dc06b6c7";
  sourceEvidencePackageSemanticHash: typeof PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH;
  notes: string;
};

export type CrossRoundMappingStewardDecision = {
  decision: "APPROVE";
  decisionId: typeof CROSS_ROUND_STEWARD_DECISION_ID;
  authority: typeof CROSS_ROUND_STEWARD_DECISION_AUTHORITY;
  decidedAt: typeof CROSS_ROUND_STEWARD_DECISION_DATE;
  priorState: "CANDIDATE";
};

export function crossRoundStewardDecisionProvenance(): CrossRoundStewardDecisionProvenance {
  return {
    decisionId: CROSS_ROUND_STEWARD_DECISION_ID,
    authority: CROSS_ROUND_STEWARD_DECISION_AUTHORITY,
    decidedAt: CROSS_ROUND_STEWARD_DECISION_DATE,
    scope: CROSS_ROUND_STEWARD_DECISION_SCOPE,
    approvedPairs: APPROVED_CROSS_ROUND_PAIRS.map((p) => ({
      organization2026Id: p.organization2026Id,
      organization2012Id: p.organization2012Id,
      relationshipType: p.relationshipType,
    })),
    sourceEvidencePackageCommit: "9c05725c8c92687b5e6b7926182e6559dc06b6c7",
    sourceEvidencePackageSemanticHash: PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH,
    notes:
      "Operator explicit approval: Approve both recommendation=CONFIRM cross-round mappings from CROSS-ROUND-ID-1. Build Agent is not the steward. Returning/new remain separate (RETURNING-NEW-1).",
  };
}
