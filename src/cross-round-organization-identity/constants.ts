/** Cross-round organization identity — pins and schema versions. */

export const CROSS_ROUND_ORG_IDENTITY_SCHEMA_VERSION =
  "cross-round-organization-identity-snapshot/1.0.0" as const;
export const CROSS_ROUND_ORG_IDENTITY_METHOD_VERSION =
  "cross-round-organization-identity/1.0.0" as const;
export const CROSS_ROUND_ORG_IDENTITY_REGISTRY_VERSION =
  "cross-round-organization-identity-registry/1.0.0" as const;

/** Deterministic contentHash of accepted 2012 organization-promotions.json (CONFIRMED+CANDIDATE+AMBIGUOUS ops). */
export const PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256 =
  "f024f75d5283f46244578ace6a8b3eb5a56c16589a5a0f8daff6592a36f5a69b";

export const PINNED_2012_ORG_PROMOTION_REGISTRY_VERSION =
  "organization-promotion-registry/1.0.0" as const;
export const PINNED_2012_ORG_PROMOTION_METHOD_VERSION = "organization-promotion/1.0.0" as const;

/** Accepted ORG-RES-2026-2A post-steward semantic hash. */
export const PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256 =
  "d19b5773dc72a95ba624441b1961762a15e76624ca3dff37bc4646ec4c1d0cdd";

/** Underlying 2026 Application graph pin (unchanged by this ticket). */
export const PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256 =
  "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2";

export const EXPECTED_2026_CONFIRMED_ORGANIZATIONS = 14;
export const EXPECTED_2026_CONFIRMED_APPLICATIONS = 669;
export const EXPECTED_2012_CONFIRMED_ORGANIZATIONS = 17;
export const EXPECTED_2012_CONFIRMED_APPLICATIONS = 467;

export const ORGANIZATION_2012_ENTITY_PREFIX = "organization:promoted:";
export const ORGANIZATION_2026_ENTITY_PREFIX = "organization:resolved-2026:";

export const DEFAULT_2012_PROMOTION_REGISTRY_RELATIVE =
  "src/normalization/fixtures/icann2012-reveal-day-v1/organization-promotions.json";
export const DEFAULT_OUTPUT_DIR_RELATIVE = ".data/reveal-2026/cross-round-organization-identity";
