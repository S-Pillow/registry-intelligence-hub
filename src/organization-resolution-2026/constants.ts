/** Pinned Reveal Day Application graph — fail closed if used against another publication. */
export const PINNED_APPLICATION_GRAPH_CONTENT_SHA256 =
  "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2";

export const PINNED_APPLICATION_SNAPSHOT_ID = "snap-aps-2026-applications-reveal-day-v1";

export const ORGANIZATION_RESOLUTION_SCHEMA_VERSION =
  "organization-resolution-snapshot/1.0.0" as const;
export const ORGANIZATION_RESOLUTION_METHOD_VERSION =
  "organization-resolution-2026/1.0.0" as const;
export const ORGANIZATION_RESOLUTION_REGISTRY_VERSION =
  "organization-resolution-registry/1.0.0" as const;

export const OBSERVED_APPLICATION_COUNT = 1614;
export const OFFICIAL_APPLICATION_COUNT = 1615;
export const OBSERVED_APPLICANT_LEGAL_NAME_COUNT = 480;
export const OFFICIAL_APPLICANT_COUNT = 481;

/** Entity id prefix — never raw Applicant Name. */
export const RESOLVED_2026_ORG_ENTITY_PREFIX = "organization:resolved-2026:";
