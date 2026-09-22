/** Filename in Project Store / docs root — see registry-operator-vs-rsp-relationship-contract.md */
export const RO_RSP_RELATIONSHIP_CONTRACT_DOC = "registry-operator-vs-rsp-relationship-contract.md" as const;

/** Contract revision marker linked by doc-contract tests (D2.5A-P0.2B). */
export const RO_RSP_CONTRACT_REVISION = "D2.5A-P0.2B" as const;

/** Registry Operator — contractual ICANN role, not merely back-end runner. */
export const RO_DEFINITION_ANCHOR =
  "contractually responsible" as const;

/** RSP may differ from contractual RO. */
export const RSP_VS_RO_ANCHOR = "may differ" as const;

/** IANA TLD Manager must not be silently equated to RO. */
export const IANA_TLD_MANAGER_RECONCILIATION_ANCHOR =
  "Do not equate" as const;

/** TLD graph root listing (ASCII sketch in contract). */
export const TLD_GRAPH_ROOT_ANCHOR = "Contracted Registry Operator" as const;

/** Applicant → RO requires evidence. */
export const APPLICANT_RO_TRANSITION_ANCHOR =
  "Applicant ≠ Registry Operator automatically" as const;

/** Future RO evidence tier 1 (document only). */
export const RO_EVIDENCE_TIER_1_ANCHOR = "ICANN Registry Agreement" as const;

/**
 * Mapping-review: PARTIAL_MAPPING + pilotOnlyExactCandidate is an alternate steward path,
 * not a dead end (mirrors mapping-review-approval ROUND_WIDE_EXACT rejection copy).
 */
export const PARTIAL_MAPPING_PILOT_ALTERNATE_PATH_ANCHOR =
  "not a dead end" as const;

export const MAPPING_APPROVE_ROUND_WIDE_REJECTION =
  "APPROVE rejected: ROUND_WIDE_EXACT is false — incomplete round-wide stays DRAFT (use PILOT_ONLY_EXACT candidate separately)" as const;
