export const PUBLICATION_SCHEMA_VERSION = "registry-2026-publication/1.0.0";
export const PARSER_VERSION = "registry-2026-parser/1.0.0";
export const NORMALIZER_VERSION = "registry-2026-normalizer/1.0.0";
export const VALIDATION_METHOD_VERSION = "registry-2026-validation/1.0.0";
export const CLAIM_ACTUALITY_STATE_VERSION = "claim-actuality-state/1.0.0";
export const ORGANIZATION_RESOLUTION_METHOD = "organization-resolution-2026/1.0.0";
export const CROSS_ROUND_IDENTITY_METHOD = "cross-round-identity/1.0.0";

export type PublicationKind = "immutable-publication" | "rehearsal-for-pipeline-only";

export const ALLOWED_PUBLICATION_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "publicationKind",
  "snapshotId",
  "fixtureId",
  "publishedAt",
  "retrievedAt",
  "parserVersion",
  "normalizerVersion",
  "source",
  "limitations",
  "applications",
] as const;

export const ALLOWED_APPLICATION_KEYS = [
  "id",
  "string",
  "aLabel",
  "applicant",
  "organization",
  "country",
  "region",
  "category",
  "type",
  "returning",
  "idn",
  "replacement",
  "contentionSet",
  "confidence",
] as const;

export type Registry2026ApplicationRow = {
  id: string;
  string: string;
  aLabel?: string;
  applicant: string;
  organization: string;
  country: string;
  region: string;
  category: string;
  type: string;
  returning: boolean;
  idn: boolean;
  replacement: string | null;
  contentionSet: string | null;
  confidence: number;
};

export type Registry2026PublicationSnapshot = {
  schemaVersion: typeof PUBLICATION_SCHEMA_VERSION;
  publicationKind: PublicationKind;
  snapshotId: string;
  fixtureId?: string;
  publishedAt: string;
  retrievedAt: string;
  parserVersion: string;
  normalizerVersion: string;
  source: { name: string; url: string; evidenceClass: string };
  limitations: string[];
  applications: Registry2026ApplicationRow[];
};

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string;
};

export type Normalized2026Observation = {
  applicationId: string;
  stringUlabel: string;
  aLabel: string | null;
  isIdn: boolean;
  applicantLegalName: string;
  organizationLabel: string;
  jurisdiction: string;
  region: string;
  contentionSetId: string | null;
};

export type DryRunDiagnostics = {
  methodVersions: {
    parser: string;
    normalizer: string;
    validation: string;
  };
  publicationKind: PublicationKind;
  snapshotId: string;
  snapshotContentHash: string;
  recordCounts: {
    applications: number;
    uniqueStrings: number;
    idnApplications: number;
    distinctOrganizations: number;
  };
  normalization: {
    observationCount: number;
    unresolvedFieldCount: number;
    unresolvedFields: string[];
  };
  validation: {
    ok: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  };
  provenance: {
    publishedAt: string;
    retrievedAt: string;
    sourceName: string;
    sourceUrl: string;
  };
  contaminationCheck: {
    rehearsalMarkersPresent: boolean;
    blockedForRealPromotion: boolean;
  };
};
