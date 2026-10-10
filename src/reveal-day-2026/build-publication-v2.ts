import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256Hex } from "../pipeline/content-store";
import { canonicalJson, contentHash } from "../normalization/hashes";
import { parseApsApplicationExportArtifact } from "./aps-application-csv";
import {
  applicationGraphHashInput,
  APS_APPLICATION_CSV_ARTIFACT_ROLE,
  APS_APPLICATION_CSV_MEDIA_TYPE,
  APS_APPLICATION_CSV_NORMALIZER_VERSION,
  APS_APPLICATION_CSV_PARSER_VERSION,
  CONTENTION_MEMBERSHIP_SCHEMA_PLACEHOLDER,
  PUBLICATION_SCHEMA_VERSION_V20,
  type KnownExcludedRecordV2,
  type OfficialAggregatesV2,
  type Registry2026PublicationV2,
} from "./publication-v2-types";
import { validatePublicationV2, validationV2Failed } from "./validate-v2";

export const PUBLICATION_V2_REVIEW_VERSION = "registry-2026-publication-v2-review/1.0.0";
export const LOCAL_ARTIFACT_ADAPTER_ID = "local-artifact";
export const LOCAL_ARTIFACT_ADAPTER_SCHEMA_VERSION = "local-artifact-adapter/1.0.0";

export const APS_V2_CAPTURE_LIMITATIONS = [
  "NOT PROMOTED.",
  "Built offline from a local APS Application CSV artifact. No network fetch was performed by this command.",
  "Logical Application grain (registry-2026-publication/2.0.0): non-R Application IDs only; ReplacementString is relationship evidence.",
  "application_record_coverage is partial while knownExcludedRecords is non-empty or observed < official.",
  "Promotion != complete metric eligibility. Row-derived round-wide metrics requiring complete coverage remain blocked/partial.",
  "Official aggregates are metadata pins, not len(applications).",
  "Label: In Contention on the export is NOT official contention membership.",
  "organization / category / returning / confidence are not fabricated.",
  "Contention membership sidecar deferred (APS-CONTENTION-CSV-1).",
  "Browser / claim-actuality activation is out of scope for this build.",
] as const;

export type ApsApplicationCsvBuildRequest = {
  bytes: Uint8Array;
  artifactId: string;
  sourceVersion: number;
  captureId: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  publishedAt: string;
  mediaType: string;
  artifactRole: string;
  evidenceClass: string;
  snapshotId: string;
  recordedHttpStatus: number;
  expectSourceHash: string;
  officialAggregates: OfficialAggregatesV2;
  knownExcludedRecords: KnownExcludedRecordV2[];
  limitations?: string[];
};

export type PublicationV2ReviewDocument = {
  reviewVersion: typeof PUBLICATION_V2_REVIEW_VERSION;
  promoted: false;
  promotionStatus: "NOT_PROMOTED";
  realSourceReady: false;
  networkFetchPerformed: false;
  browserDatasetChanged: false;
  claimActualityWritten: false;
  promotionHistoryWritten: false;
  snapshotId: string | null;
  schemaVersion: typeof PUBLICATION_SCHEMA_VERSION_V20;
  sourceHash: string | null;
  applicationGraphContentHash: string | null;
  officialAggregatesContentSha256: string | null;
  coverageDescriptorSha256: string | null;
  sourceRowCount: number | null;
  normalizedApplicationRecordsObserved: number | null;
  officialApplicationCount: number | null;
  officialApplicantCount: number | null;
  replacementCount: number | null;
  observedDistinctApplicantNames: number | null;
  applicationCoverageCompleteness: "partial" | "complete" | null;
  validationStatus: "pass" | "fail";
  qualityLines: string[];
  warnings: string[];
  errors: string[];
};

export type BuildPublicationV2Result = {
  ok: boolean;
  review: PublicationV2ReviewDocument;
  publication?: Registry2026PublicationV2;
};

function blankReview(request: ApsApplicationCsvBuildRequest, sourceHash: string | null): PublicationV2ReviewDocument {
  return {
    reviewVersion: PUBLICATION_V2_REVIEW_VERSION,
    promoted: false,
    promotionStatus: "NOT_PROMOTED",
    realSourceReady: false,
    networkFetchPerformed: false,
    browserDatasetChanged: false,
    claimActualityWritten: false,
    promotionHistoryWritten: false,
    snapshotId: request.snapshotId || null,
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    sourceHash,
    applicationGraphContentHash: null,
    officialAggregatesContentSha256: null,
    coverageDescriptorSha256: null,
    sourceRowCount: null,
    normalizedApplicationRecordsObserved: null,
    officialApplicationCount: request.officialAggregates.officialApplicationCount,
    officialApplicantCount: request.officialAggregates.officialApplicantCount,
    replacementCount: null,
    observedDistinctApplicantNames: null,
    applicationCoverageCompleteness: null,
    validationStatus: "fail",
    qualityLines: [],
    warnings: [],
    errors: [],
  };
}

function isUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isSourceIdentifier(value: string): boolean {
  if (value.length === 0 || value.length > 500 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Build registry-2026-publication/2.0.0 from local APS Application CSV bytes + official aggregate evidence.
 * Does not fetch, promote, or mutate claim actuality.
 */
export function buildPublicationFromApsApplicationCsv(
  request: ApsApplicationCsvBuildRequest,
): BuildPublicationV2Result {
  const sourceHash = sha256Hex(request.bytes);
  const review = blankReview(request, sourceHash);
  const errors = review.errors;

  if (request.artifactRole !== APS_APPLICATION_CSV_ARTIFACT_ROLE) {
    errors.push(`artifactRole must be ${APS_APPLICATION_CSV_ARTIFACT_ROLE}`);
  }
  if (
    request.mediaType !== APS_APPLICATION_CSV_MEDIA_TYPE
    && request.mediaType !== "text/csv;charset=UTF-8"
  ) {
    errors.push(`mediaType must be text/csv for APS Application export`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(request.snapshotId)) {
    errors.push("snapshotId must be a single operator-supplied token");
  }
  if (!isSourceIdentifier(request.sourceUrl)) errors.push("sourceUrl must be http(s)");
  if (!isUtcTimestamp(request.retrievedAt) || !isUtcTimestamp(request.publishedAt)) {
    errors.push("retrievedAt/publishedAt must be UTC timestamps");
  }
  if (!/^[0-9a-f]{64}$/.test(request.expectSourceHash)) {
    errors.push("expectSourceHash must be 64 lowercase hex characters");
  } else if (request.expectSourceHash !== sourceHash) {
    errors.push("expectSourceHash does not match local artifact bytes (SOURCE_CHANGED or wrong file)");
  }
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(request.artifactId)) errors.push("artifactId invalid");
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(request.captureId)) errors.push("captureId invalid");
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(request.evidenceClass)) errors.push("evidenceClass invalid");
  if (request.sourceName.length === 0 || /[\r\n]/.test(request.sourceName)) {
    errors.push("sourceName must be a single non-empty line");
  }
  if (
    !Number.isSafeInteger(request.officialAggregates.officialApplicationCount)
    || !Number.isSafeInteger(request.officialAggregates.officialApplicantCount)
  ) {
    errors.push("officialAggregates counts must be safe integers");
  }
  if (!/^[0-9a-f]{64}$/.test(request.officialAggregates.provenance.contentSha256)) {
    errors.push("officialAggregates.provenance.contentSha256 invalid");
  }

  if (errors.length > 0) return { ok: false, review };

  let parsed;
  try {
    parsed = parseApsApplicationExportArtifact({
      artifactRole: request.artifactRole,
      mediaType: request.mediaType,
      bytes: request.bytes,
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "APS Application CSV parse failed");
    return { ok: false, review };
  }

  const observed = parsed.applications.length;
  const officialApps = request.officialAggregates.officialApplicationCount;
  const completeness: "partial" | "complete" =
    observed < officialApps || request.knownExcludedRecords.length > 0
      ? "partial"
      : observed === officialApps
      ? "complete"
      : "partial";

  // Option A / partial coverage: exclusions imply observed must stay below official.
  if (request.knownExcludedRecords.length > 0 && observed >= officialApps) {
    errors.push("knownExcludedRecords present but observed applications are not below official count");
  }
  // Never copy official into applications[] length as a silent write — already separate fields.
  if (completeness === "partial" && observed === officialApps) {
    errors.push("partial coverage claimed but observed equals official application count");
  }

  const coverageDescriptor = {
    sourceRowCount: parsed.sourceRowCount,
    normalizedApplicationRecordsObserved: observed,
    applicationRecordCoverage: {
      observed,
      official: officialApps,
      completeness,
      knownExcludedRecords: request.knownExcludedRecords,
    },
  };
  const officialAggregatesContentSha256 = contentHash(request.officialAggregates);
  const coverageDescriptorSha256 = contentHash(coverageDescriptor);

  const limitations = [...APS_V2_CAPTURE_LIMITATIONS, ...(request.limitations ?? [])];

  const draft: Registry2026PublicationV2 = {
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publicationKind: "immutable-publication",
    snapshotId: request.snapshotId,
    publishedAt: request.publishedAt,
    retrievedAt: request.retrievedAt,
    parserVersion: APS_APPLICATION_CSV_PARSER_VERSION,
    normalizerVersion: APS_APPLICATION_CSV_NORMALIZER_VERSION,
    source: {
      name: request.sourceName,
      url: request.sourceUrl,
      evidenceClass: request.evidenceClass,
    },
    limitations,
    officialAggregates: request.officialAggregates,
    coverage: coverageDescriptor,
    lineage: {
      intakeAdapterVersion: APS_APPLICATION_CSV_PARSER_VERSION,
      artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
      rawSha256: sourceHash,
      pipelineSourceId: request.artifactId,
      pipelineSourceVersion: request.sourceVersion,
      manifestAttemptId: request.captureId,
      fetchUrl: request.sourceUrl,
      retrievedAt: request.retrievedAt,
      httpStatus: request.recordedHttpStatus,
      adapterId: LOCAL_ARTIFACT_ADAPTER_ID,
      adapterSchemaVersion: LOCAL_ARTIFACT_ADAPTER_SCHEMA_VERSION,
      redirectChain: [],
      responseHeaderDigest: null,
    },
    supplementalArtifactPins: {
      contentionMembershipSchema: CONTENTION_MEMBERSHIP_SCHEMA_PLACEHOLDER,
      contentionMembershipPin: null,
    },
    bundleManifest: {
      officialAggregatesContentSha256,
      coverageDescriptorSha256,
      applicationGraphContentSha256: "", // filled after graph hash
    },
    applications: parsed.applications,
  };

  const applicationGraphContentSha256 = contentHash(applicationGraphHashInput(draft));
  draft.bundleManifest.applicationGraphContentSha256 = applicationGraphContentSha256;

  // Determinism: rebuild
  const again = contentHash(applicationGraphHashInput({ ...draft, retrievedAt: "2099-01-01T00:00:00Z" }));
  if (again !== applicationGraphContentSha256) {
    errors.push("application graph hash must ignore retrievedAt");
  }

  const validation = validatePublicationV2(draft);
  if (validationV2Failed(validation.issues)) {
    errors.push(...validation.issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`));
  }

  review.sourceRowCount = parsed.sourceRowCount;
  review.normalizedApplicationRecordsObserved = observed;
  review.replacementCount = parsed.replacementCount;
  review.observedDistinctApplicantNames = parsed.observedDistinctApplicantNames;
  review.applicationCoverageCompleteness = completeness;
  review.applicationGraphContentHash = applicationGraphContentSha256;
  review.officialAggregatesContentSha256 = officialAggregatesContentSha256;
  review.coverageDescriptorSha256 = coverageDescriptorSha256;

  review.qualityLines = [
    `SOURCE ROWS: ${parsed.sourceRowCount}`,
    `NORMALIZED APPLICATIONS OBSERVED: ${observed}`,
    `OFFICIAL APPLICATIONS: ${officialApps}`,
    `OFFICIAL APPLICANTS: ${request.officialAggregates.officialApplicantCount}`,
    `REPLACEMENTS: ${parsed.replacementCount}`,
    `APPLICATION COVERAGE: ${completeness.toUpperCase()} ${observed}/${officialApps}`,
    `KNOWN EXCLUDED: ${
      request.knownExcludedRecords.map((r) => `${r.applicationId} / ${r.primaryString} / administrative-check coverage gap`).join("; ")
      || "(none)"
    }`,
    "PROMOTION STATUS: NOT PROMOTED",
    `OBSERVED APPLICANT NAMES (coverage): ${parsed.observedDistinctApplicantNames} (≠ official applicants)`,
  ];

  if (canonicalJson(draft) !== canonicalJson(structuredClone(draft))) {
    errors.push("deterministic canonicalization mismatch");
  }

  if (errors.length > 0) {
    review.validationStatus = "fail";
    return { ok: false, review };
  }

  review.validationStatus = "pass";
  return { ok: true, review, publication: draft };
}

export async function writePublicationV2Artifacts(args: {
  publicationPath: string;
  reviewPath: string;
  publication: Registry2026PublicationV2;
  review: PublicationV2ReviewDocument;
}): Promise<void> {
  await mkdir(dirname(args.publicationPath), { recursive: true });
  await mkdir(dirname(args.reviewPath), { recursive: true });
  await writeFile(args.publicationPath, `${JSON.stringify(args.publication, null, 2)}\n`, "utf8");
  await writeFile(args.reviewPath, `${JSON.stringify(args.review, null, 2)}\n`, "utf8");
}
