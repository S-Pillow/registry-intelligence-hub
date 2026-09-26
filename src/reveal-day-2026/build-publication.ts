import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256Hex } from "../pipeline/content-store";
import { canonicalJson, contentHash } from "../normalization/hashes";
import { assertNoFixtureContaminationInRealBuild } from "./contamination";
import { runDryRunIngestion } from "./dry-run";
import {
  capturedArtifactParserForMediaType,
  NDJSON_WIRE_MEDIA_TYPE,
} from "./intake-adapter";
import { normalizeApplications } from "./normalize";
import type { Registry2026PublicationSnapshot } from "./types";
import {
  INTAKE_ADAPTER_VERSION,
  INTAKE_WIRE_SCHEMA_VERSION,
  NORMALIZER_VERSION,
  PARSER_VERSION,
  PUBLICATION_SCHEMA_VERSION_V11,
} from "./types";
import { validatePublicationSnapshot, validationFailed } from "./validate";

export const PUBLICATION_REVIEW_VERSION = "registry-2026-publication-review/1.0.0";
export const LOCAL_ARTIFACT_ADAPTER_ID = "local-artifact";
export const LOCAL_ARTIFACT_ADAPTER_SCHEMA_VERSION = "local-artifact-adapter/1.0.0";

/**
 * Facts stamped on every bundle from this command.
 * Retrieval time is stored on the publication and is not an input to contentHash.
 * contentHash covers snapshotId + applications only (see runDryRunIngestion).
 */
export const LOCAL_CAPTURE_LIMITATIONS = [
  "NOT PROMOTED.",
  "Built offline from a local artifact. No network fetch was performed.",
  "Source URL is operator-supplied provenance metadata. It is not a determination that the URL is the final 2026 publication endpoint.",
  "lineage.httpStatus copies the operator-recorded capture status. This command did not perform an HTTP request.",
  "A passing validation result is not approval, not REAL_SOURCE_READY, and not an active browser dataset.",
] as const;

const CONTENT_HASH_INPUTS = ["snapshotId", "applications"] as const;

export type LocalArtifactBuildRequest = {
  bytes: Uint8Array;
  artifactId: string;
  sourceVersion: string;
  captureId: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  publishedAt: string;
  mediaType: string;
  round: string;
  evidenceClass: string;
  snapshotId: string;
  fixtureId?: string;
  expectedRowCount: string;
  expectSourceHash: string;
  recordedHttpStatus: string;
  parserVersion: string;
  normalizerVersion: string;
  schemaVersion: string;
  limitations?: string[];
};

export type PublicationReviewDocument = {
  reviewVersion: typeof PUBLICATION_REVIEW_VERSION;
  promoted: false;
  promotionStatus: "NOT_PROMOTED";
  realSourceReady: false;
  networkFetchPerformed: false;
  browserDatasetChanged: false;
  claimActualityWritten: false;
  promotionHistoryWritten: false;
  snapshotId: string | null;
  artifactId: string | null;
  sourceUrl: string | null;
  retrievalTimestamp: string | null;
  retrievalTimestampInsideContentHash: false;
  contentHashInputs: typeof CONTENT_HASH_INPUTS;
  sourceHashAlgorithm: "sha256";
  contentHashAlgorithm: "sha256-canonical-json";
  sourceHash: string | null;
  contentHash: string | null;
  rowCount: number | null;
  distinctExactStrings: number | null;
  idnCount: number | null;
  validationStatus: "pass" | "fail";
  contaminationGuardStatus: "clear" | "blocked" | "not-run";
  parserVersion: string | null;
  normalizerVersion: string | null;
  round: string | null;
  mediaType: string | null;
  warnings: string[];
  errors: string[];
};

export type BuildPublicationResult = {
  ok: boolean;
  review: PublicationReviewDocument;
  publication?: Registry2026PublicationSnapshot;
};

function blankReview(request: LocalArtifactBuildRequest, sourceHash: string | null): PublicationReviewDocument {
  return {
    reviewVersion: PUBLICATION_REVIEW_VERSION,
    promoted: false,
    promotionStatus: "NOT_PROMOTED",
    realSourceReady: false,
    networkFetchPerformed: false,
    browserDatasetChanged: false,
    claimActualityWritten: false,
    promotionHistoryWritten: false,
    snapshotId: request.snapshotId.length > 0 ? request.snapshotId : null,
    artifactId: request.artifactId.length > 0 ? request.artifactId : null,
    sourceUrl: request.sourceUrl.length > 0 ? request.sourceUrl : null,
    retrievalTimestamp: request.retrievedAt.length > 0 ? request.retrievedAt : null,
    retrievalTimestampInsideContentHash: false,
    contentHashInputs: CONTENT_HASH_INPUTS,
    sourceHashAlgorithm: "sha256",
    contentHashAlgorithm: "sha256-canonical-json",
    sourceHash,
    contentHash: null,
    rowCount: null,
    distinctExactStrings: null,
    idnCount: null,
    validationStatus: "fail",
    contaminationGuardStatus: "not-run",
    parserVersion: PARSER_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    round: request.round.length > 0 ? request.round : null,
    mediaType: request.mediaType.length > 0 ? request.mediaType : null,
    warnings: [],
    errors: [],
  };
}

function isToken(value: string, max: number): boolean {
  return value.length > 0 && value.length <= max && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isSourceIdentifier(value: string): boolean {
  if (value.length === 0 || value.length > 500 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return url.hostname.length > 0;
  } catch {
    return false;
  }
}

function readBoundedInt(value: string, label: string, min: number, max: number, errors: string[]): number | null {
  if (!/^\d+$/.test(value)) {
    errors.push(`${label} must be an integer`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${label} is out of range`);
    return null;
  }
  return parsed;
}

function assemblePublication(
  request: LocalArtifactBuildRequest,
  applications: Registry2026PublicationSnapshot["applications"],
  sourceHash: string,
  recordedHttpStatus: number,
  sourceVersion: number,
): Registry2026PublicationSnapshot {
  const limitations = [...LOCAL_CAPTURE_LIMITATIONS, ...(request.limitations ?? [])];
  return {
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V11,
    publicationKind: "immutable-publication",
    snapshotId: request.snapshotId,
    ...(request.fixtureId ? { fixtureId: request.fixtureId } : {}),
    publishedAt: request.publishedAt,
    retrievedAt: request.retrievedAt,
    parserVersion: PARSER_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    source: {
      name: request.sourceName,
      url: request.sourceUrl,
      evidenceClass: request.evidenceClass,
    },
    limitations,
    lineage: {
      intakeAdapterVersion: INTAKE_ADAPTER_VERSION,
      wireSchemaVersion: INTAKE_WIRE_SCHEMA_VERSION,
      rawSha256: sourceHash,
      pipelineSourceId: request.artifactId,
      pipelineSourceVersion: sourceVersion,
      manifestAttemptId: request.captureId,
      fetchUrl: request.sourceUrl,
      retrievedAt: request.retrievedAt,
      httpStatus: recordedHttpStatus,
      adapterId: LOCAL_ARTIFACT_ADAPTER_ID,
      adapterSchemaVersion: LOCAL_ARTIFACT_ADAPTER_SCHEMA_VERSION,
      redirectChain: [],
      responseHeaderDigest: null,
    },
    applications,
  };
}

/**
 * Builds a registry-2026-publication/1.1.0 snapshot from local bytes.
 * Does not fetch, promote, or write claim, history, or browser state.
 * The raw bytes are not modified. Snapshot id is the operator value or the build fails.
 */
export function buildPublicationFromLocalArtifact(request: LocalArtifactBuildRequest): BuildPublicationResult {
  const sourceHash = sha256Hex(request.bytes);
  const review = blankReview(request, sourceHash);
  const errors = review.errors;

  if (request.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V11) {
    errors.push(`schema version must be ${PUBLICATION_SCHEMA_VERSION_V11}`);
  }
  if (request.parserVersion !== PARSER_VERSION) {
    errors.push(`parser version must be ${PARSER_VERSION}`);
  }
  if (request.normalizerVersion !== NORMALIZER_VERSION) {
    errors.push(`normalizer version must be ${NORMALIZER_VERSION}`);
  }
  if (request.round !== "2026") {
    errors.push("round must be 2026");
  }
  if (request.mediaType !== NDJSON_WIRE_MEDIA_TYPE) {
    errors.push(`media type ${request.mediaType || "(empty)"} has no captured-artifact parser. Accepted media type: ${NDJSON_WIRE_MEDIA_TYPE}`);
  }
  if (!isToken(request.artifactId, 80)) errors.push("artifact id must be a lowercase identifier");
  if (!isToken(request.captureId, 80)) errors.push("capture id must be a lowercase identifier");
  if (!isToken(request.evidenceClass, 80)) errors.push("evidence class must be a lowercase identifier");
  if (request.fixtureId !== undefined && !isToken(request.fixtureId, 80)) {
    errors.push("fixture id must be a lowercase identifier");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(request.snapshotId)) {
    errors.push("snapshot id must be a single token supplied by the operator");
  }
  if (request.sourceName.length === 0 || request.sourceName.length > 200 || /[\r\n]/.test(request.sourceName)) {
    errors.push("source name must be a single line");
  }
  if (!isSourceIdentifier(request.sourceUrl)) errors.push("source url must be an http(s) provenance identifier");
  if (!isUtcTimestamp(request.retrievedAt)) errors.push("retrieved-at must be a UTC timestamp");
  if (!isUtcTimestamp(request.publishedAt)) errors.push("published-at must be a UTC timestamp");
  if (!/^[0-9a-f]{64}$/.test(request.expectSourceHash)) {
    errors.push("expect-source-hash must be 64 lowercase hex characters");
  } else if (request.expectSourceHash !== sourceHash) {
    errors.push("expect-source-hash does not match the sha256 of the local artifact bytes");
  }

  const sourceVersion = readBoundedInt(request.sourceVersion, "source version", 1, 1_000_000, errors);
  const recordedHttpStatus = readBoundedInt(request.recordedHttpStatus, "recorded http status", 100, 599, errors);
  const expectedRowCount = readBoundedInt(request.expectedRowCount, "expected row count", 0, 50_000, errors);

  const extraLimitations = request.limitations ?? [];
  if (extraLimitations.length > 20) errors.push("too many limitations");
  for (const limitation of extraLimitations) {
    if (limitation.length === 0 || limitation.length > 500 || /[\r\n]/.test(limitation)) {
      errors.push("limitation text must be a single non-empty line");
      break;
    }
  }

  if (errors.length > 0 || sourceVersion === null || recordedHttpStatus === null || expectedRowCount === null) {
    return { ok: false, review };
  }

  const parser = capturedArtifactParserForMediaType(request.mediaType);
  if (!parser) {
    errors.push(`media type ${request.mediaType} has no captured-artifact parser. Accepted media type: ${NDJSON_WIRE_MEDIA_TYPE}`);
    return { ok: false, review };
  }

  let applications: Registry2026PublicationSnapshot["applications"];
  try {
    const parsed = parser.parse(request.bytes);
    if (parsed.intakeAdapterVersion !== INTAKE_ADAPTER_VERSION || parsed.wireSchemaVersion !== INTAKE_WIRE_SCHEMA_VERSION) {
      errors.push("parser returned an unexpected intake adapter version");
      return { ok: false, review };
    }
    applications = parsed.applications;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "captured artifact parse failed");
    return { ok: false, review };
  }

  review.rowCount = applications.length;
  review.distinctExactStrings = new Set(applications.map((row) => row.string)).size;
  review.idnCount = applications.filter((row) => row.idn).length;

  if (applications.length !== expectedRowCount) {
    errors.push(`expected row count ${expectedRowCount}, parsed row count ${applications.length}`);
  }

  const first = assemblePublication(request, applications, sourceHash, recordedHttpStatus, sourceVersion);
  const second = assemblePublication(request, applications, sourceHash, recordedHttpStatus, sourceVersion);
  if (canonicalJson(first) !== canonicalJson(second) || first.snapshotId !== request.snapshotId) {
    errors.push("deterministic rebuild mismatch");
    return { ok: false, review };
  }

  const validation = validatePublicationSnapshot(first, { enforceProductionRowBounds: true });
  const validationErrors = validation.issues.filter((issue) => issue.severity === "error");
  const validationWarnings = validation.issues.filter((issue) => issue.severity === "warning");
  review.warnings.push(...validationWarnings.map((issue) => `${issue.code}: ${issue.message}`));
  if (validationFailed(validation.issues)) {
    errors.push(...validationErrors.map((issue) => `${issue.code}: ${issue.message}`));
  }

  const diagnostics = runDryRunIngestion(first);
  const hashed = contentHash({ snapshotId: first.snapshotId, applications: first.applications });
  if (hashed !== diagnostics.snapshotContentHash) {
    errors.push("content hash mismatch between publication builder and dry-run");
  }

  const normalization = normalizeApplications(first.applications);
  if (normalization.unresolvedFields.length > 0) {
    errors.push(`normalization unresolved fields: ${normalization.unresolvedFields.join(", ")}`);
  }

  const contamination = assertNoFixtureContaminationInRealBuild(first, "verify");
  const blocked = !contamination.ok || diagnostics.contaminationCheck.blockedForRealPromotion;
  review.contaminationGuardStatus = blocked ? "blocked" : "clear";
  if (blocked) errors.push(contamination.message);

  const schemaOk = !validationFailed(validation.issues)
    && applications.length === expectedRowCount
    && normalization.unresolvedFields.length === 0
    && hashed === diagnostics.snapshotContentHash;
  review.validationStatus = schemaOk ? "pass" : "fail";

  if (!schemaOk || blocked || errors.length > 0) {
    return { ok: false, review };
  }

  review.contentHash = diagnostics.snapshotContentHash;
  review.distinctExactStrings = diagnostics.recordCounts.uniqueStrings;
  review.idnCount = diagnostics.recordCounts.idnApplications;
  return { ok: true, review, publication: first };
}

export async function writePublicationReview(reviewPath: string, review: PublicationReviewDocument): Promise<void> {
  await mkdir(dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
}
