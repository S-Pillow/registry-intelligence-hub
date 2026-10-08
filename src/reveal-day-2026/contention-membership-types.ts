/**
 * registry-2026-contention-membership/1.0.0 — official Reveal Day contention CSV sidecar.
 * Separate from Application publication 2.0.0 and from RIH exact-string grouping.
 */

import { PUBLICATION_SCHEMA_VERSION_V20 } from "./publication-v2-types";

export const CONTENTION_MEMBERSHIP_SCHEMA_VERSION = "registry-2026-contention-membership/1.0.0";
export const APS_CONTENTION_CSV_PARSER_VERSION = "aps-2026-contention-csv-parser/1.0.0";
export const APS_CONTENTION_CSV_NORMALIZER_VERSION = "aps-2026-contention-csv-normalizer/1.0.0";
export const APS_CONTENTION_CSV_ARTIFACT_ROLE = "aps-2026-reveal-day-contention-export";
export const APS_CONTENTION_CSV_MEDIA_TYPE = "text/csv";
export const REVEAL_DAY_EVIDENCE_BUNDLE_SCHEMA_VERSION = "registry-2026-reveal-day-evidence-bundle/1.0.0";

export const APS_CONTENTION_CSV_REQUIRED_HEADERS = [
  "#",
  "Application ID",
  "Org Name",
  "Applied-for string(s)",
] as const;

export const OFFICIAL_VS_EXACT_STRING_NOTE =
  "OFFICIAL CONTENTION MEMBERSHIP != RIH EXACT-STRING GROUPING";

export type ContentionMemberV1 = {
  applicationId: string;
  /** Exact CSV `Org Name` text. NOT RIH resolved Organization. */
  publishedOrgName: string;
  /** Exact CSV `Applied-for string(s)` text as published. */
  appliedForStringsAsPublished: string;
  /** 1-based data row index in the contention CSV (after header). */
  sourceRowIndex: number;
};

export type ContentionSetV1 = {
  /** Exact source `#` value as published. Not an internal ICS-* id. */
  officialContentionSetId: string;
  members: ContentionMemberV1[];
};

export type ApplicationPublicationPinV1 = {
  schemaVersion: typeof PUBLICATION_SCHEMA_VERSION_V20;
  snapshotId: string;
  applicationGraphContentSha256: string;
  normalizedApplicationRecordsObserved: number;
  applicationRecordCoverageCompleteness: "partial" | "complete";
};

export type ContentionMembershipLineageV1 = {
  intakeAdapterVersion: typeof APS_CONTENTION_CSV_PARSER_VERSION;
  artifactRole: typeof APS_CONTENTION_CSV_ARTIFACT_ROLE;
  rawSha256: string;
  pipelineSourceId: string;
  pipelineSourceVersion: number;
  manifestAttemptId: string;
  fetchUrl: string;
  finalUrl?: string;
  retrievedAt: string;
  httpStatus: number;
  adapterId: string;
  adapterSchemaVersion: string;
  redirectChain: string[];
  responseHeaderDigest: string | null;
};

export type ContentionMembershipQualityV1 = {
  sourceMembershipRowCount: number;
  officialContentionSetCount: number;
  joinedMemberCount: number;
  unjoinedMemberCount: number;
  replacementIdCount: number;
  minSetSize: number;
  maxSetSize: number;
  applicationsAppearingInMultipleSets: number;
  wdoPresentInContentionSource: boolean;
  evidenceSeparationNote: typeof OFFICIAL_VS_EXACT_STRING_NOTE;
  /** Application publication coverage remains independent; join success does not complete it. */
  applicationCoverageUnchangedByContentionJoin: true;
};

export type ContentionMembershipSnapshotV1 = {
  schemaVersion: typeof CONTENTION_MEMBERSHIP_SCHEMA_VERSION;
  snapshotKind: "official-contention-membership-sidecar";
  snapshotId: string;
  publishedAt: string;
  retrievedAt: string;
  parserVersion: typeof APS_CONTENTION_CSV_PARSER_VERSION;
  normalizerVersion: typeof APS_CONTENTION_CSV_NORMALIZER_VERSION;
  source: { name: string; url: string; evidenceClass: string; finalUrl?: string };
  limitations: string[];
  lineage: ContentionMembershipLineageV1;
  applicationPublicationPin: ApplicationPublicationPinV1;
  quality: ContentionMembershipQualityV1;
  contentionSets: ContentionSetV1[];
  bundleManifest: {
    rawSourceSha256: string;
    sidecarContentSha256: string;
    applicationPublicationPinSha256: string;
  };
};

/** Stable hash boundary for normalized sidecar content (excludes retrievedAt / paths). */
export function contentionSidecarHashInput(snapshot: ContentionMembershipSnapshotV1): {
  snapshotId: string;
  applicationPublicationPin: ApplicationPublicationPinV1;
  contentionSets: ContentionSetV1[];
} {
  return {
    snapshotId: snapshot.snapshotId,
    applicationPublicationPin: snapshot.applicationPublicationPin,
    contentionSets: snapshot.contentionSets,
  };
}

export type RevealDayEvidenceBundleV1 = {
  schemaVersion: typeof REVEAL_DAY_EVIDENCE_BUNDLE_SCHEMA_VERSION;
  bundleId: string;
  promotionStatus: "NOT_PROMOTED";
  claimActualityWritten: false;
  relationship: "application-publication-exact-pin-to-contention-sidecar";
  note: string;
  applicationPublication: {
    schemaVersion: typeof PUBLICATION_SCHEMA_VERSION_V20;
    snapshotId: string;
    applicationGraphContentSha256: string;
    supplementalContentionPinOnPublication: null;
  };
  contentionMembership: {
    schemaVersion: typeof CONTENTION_MEMBERSHIP_SCHEMA_VERSION;
    snapshotId: string;
    sidecarContentSha256: string;
    rawSourceSha256: string;
  };
};
