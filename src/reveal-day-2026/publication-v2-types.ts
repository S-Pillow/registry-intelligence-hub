/**
 * registry-2026-publication/2.0.0 — APS Application CSV logical Application grain.
 * Parallel to 1.0/1.1 flat rehearsal/drill snapshots. Not activated in the browser by this ticket.
 */

export const PUBLICATION_SCHEMA_VERSION_V20 = "registry-2026-publication/2.0.0";
export const APS_APPLICATION_CSV_PARSER_VERSION = "aps-2026-application-csv-parser/1.0.0";
export const APS_APPLICATION_CSV_NORMALIZER_VERSION = "aps-2026-application-csv-normalizer/1.0.0";
export const APS_APPLICATION_CSV_ARTIFACT_ROLE = "aps-2026-application-export";
/** Media type of the official export response; dispatch requires artifact role + header signature. */
export const APS_APPLICATION_CSV_MEDIA_TYPE = "text/csv";
export const CONTENTION_MEMBERSHIP_SCHEMA_PLACEHOLDER = "registry-2026-contention-membership/1.0.0";

export const APS_APPLICATION_CSV_REQUIRED_HEADERS = [
  "Priority",
  "Primary String",
  "Primary String Unicode Label",
  "TLD Variants",
  "TLD Type: Brand",
  "TLD Type: Community",
  "TLD Type: Geo (Self-Designated)",
  "TLD Type: Geo (String Review Confirmed)",
  "TLD Type: IDN",
  "Application ID",
  "Applicant Name",
  "Application Type",
  "Application Status",
  "Application Processing Stage",
  "Label: GAC Early Warning",
  "Label: GAC Advice",
  "Label: High Risk String",
  "Label: Objection",
  "Label: Safeguard",
  "Label: In Contention",
  "Label: Clarifying Questions",
  "Label: Change Request",
  "Label: Open Comment Period",
  "Label: Comments",
  "Label: RVC",
  "Label: Applicant Support",
  "Label: Variant Only (Existing TLD)",
  "Label: Variant Included",
  "Label: CoC Exemption",
  "Label: Reserved Name",
  "Label: CPE",
  "Label: Singular/Plural",
  "Location",
  "Region",
] as const;

export type ApsBooleanFlag = boolean;

export type AppliedStringV2 = {
  sourceRowId: string;
  label: string;
  unicodeLabel?: string;
  tldVariants?: string;
};

export type ReplacementStringV2 = {
  sourceRowId: string;
  label: string;
  unicodeLabel?: string;
  tldVariants?: string;
  applicationStatus: string;
  processingStage: string;
  applicationType: string;
};

export type ApplicationDesignationsV2 = {
  brand: ApsBooleanFlag;
  community: ApsBooleanFlag;
  geoSelfDesignated: ApsBooleanFlag;
  geoStringReviewConfirmed: ApsBooleanFlag;
  idn: ApsBooleanFlag;
};

export type ApplicationLabelsV2 = {
  gacEarlyWarning: ApsBooleanFlag;
  gacAdvice: ApsBooleanFlag;
  highRiskString: ApsBooleanFlag;
  objection: ApsBooleanFlag;
  safeguard: ApsBooleanFlag;
  /** Raw APS export value — NOT official contention membership. */
  inContentionExportLabel: ApsBooleanFlag;
  clarifyingQuestions: ApsBooleanFlag;
  changeRequest: ApsBooleanFlag;
  openCommentPeriod: ApsBooleanFlag;
  comments: ApsBooleanFlag;
  rvc: ApsBooleanFlag;
  applicantSupport: ApsBooleanFlag;
  variantOnlyExistingTld: ApsBooleanFlag;
  variantIncluded: ApsBooleanFlag;
  cocExemption: ApsBooleanFlag;
  reservedName: ApsBooleanFlag;
  cpe: ApsBooleanFlag;
  singularPlural: ApsBooleanFlag;
};

export type Registry2026ApplicationV2 = {
  applicationId: string;
  applicant: string;
  country: string;
  region: string;
  applicationStatus: string;
  processingStage: string;
  applicationType: string;
  priority?: string;
  designations: ApplicationDesignationsV2;
  labels: ApplicationLabelsV2;
  appliedString: AppliedStringV2;
  replacementString?: ReplacementStringV2;
};

export type OfficialAggregateProvenanceV2 = {
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  contentSha256: string;
  lastPublishedAt?: string;
};

export type OfficialAggregatesV2 = {
  officialApplicationCount: number;
  officialApplicantCount: number;
  provenance: OfficialAggregateProvenanceV2;
};

export type KnownExcludedRecordV2 = {
  applicationId: string;
  primaryString: string;
  applicant: string;
  location: string;
  region: string;
  applicationStatus: string;
  applicationType?: string;
  processingStage?: string;
  sourceUrl: string;
  retrievedAt: string;
  evidenceSha256?: string;
  notes: string;
};

export type ApplicationRecordCoverageV2 = {
  observed: number;
  official: number;
  completeness: "partial" | "complete";
  knownExcludedRecords: KnownExcludedRecordV2[];
};

export type PublicationCoverageV2 = {
  sourceRowCount: number;
  normalizedApplicationRecordsObserved: number;
  applicationRecordCoverage: ApplicationRecordCoverageV2;
};

export type SupplementalArtifactPinsV2 = {
  /** Reserved for APS-CONTENTION-CSV-1 — not populated by this ticket. */
  contentionMembershipSchema: typeof CONTENTION_MEMBERSHIP_SCHEMA_PLACEHOLDER;
  contentionMembershipPin: null;
};

export type PublicationLineageV2 = {
  intakeAdapterVersion: string;
  artifactRole: typeof APS_APPLICATION_CSV_ARTIFACT_ROLE;
  rawSha256: string;
  pipelineSourceId: string;
  pipelineSourceVersion: number;
  manifestAttemptId: string;
  fetchUrl: string;
  retrievedAt: string;
  httpStatus: number;
  adapterId: string;
  adapterSchemaVersion: string;
  redirectChain: string[];
  responseHeaderDigest: string | null;
};

export type Registry2026PublicationV2 = {
  schemaVersion: typeof PUBLICATION_SCHEMA_VERSION_V20;
  publicationKind: "immutable-publication";
  snapshotId: string;
  publishedAt: string;
  retrievedAt: string;
  parserVersion: typeof APS_APPLICATION_CSV_PARSER_VERSION;
  normalizerVersion: typeof APS_APPLICATION_CSV_NORMALIZER_VERSION;
  source: { name: string; url: string; evidenceClass: string };
  limitations: string[];
  officialAggregates: OfficialAggregatesV2;
  coverage: PublicationCoverageV2;
  lineage: PublicationLineageV2;
  supplementalArtifactPins: SupplementalArtifactPinsV2;
  /** Bundle pin for aggregates/coverage outside the application graph hash. */
  bundleManifest: {
    officialAggregatesContentSha256: string;
    coverageDescriptorSha256: string;
    applicationGraphContentSha256: string;
  };
  applications: Registry2026ApplicationV2[];
};

/** Inputs to application-graph content hash (excludes aggregates, coverage, retrieval time). */
export function applicationGraphHashInput(publication: Registry2026PublicationV2): {
  snapshotId: string;
  applications: Registry2026ApplicationV2[];
} {
  return {
    snapshotId: publication.snapshotId,
    applications: publication.applications,
  };
}
