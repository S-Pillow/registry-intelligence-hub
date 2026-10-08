import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, contentHash } from "../normalization/hashes";
import { sha256Hex } from "../pipeline/content-store";
import { parseApsContentionExportArtifact } from "./aps-contention-csv";
import {
  APS_CONTENTION_CSV_ARTIFACT_ROLE,
  APS_CONTENTION_CSV_MEDIA_TYPE,
  APS_CONTENTION_CSV_NORMALIZER_VERSION,
  APS_CONTENTION_CSV_PARSER_VERSION,
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  OFFICIAL_VS_EXACT_STRING_NOTE,
  REVEAL_DAY_EVIDENCE_BUNDLE_SCHEMA_VERSION,
  contentionSidecarHashInput,
  type ApplicationPublicationPinV1,
  type ContentionMembershipSnapshotV1,
  type RevealDayEvidenceBundleV1,
} from "./contention-membership-types";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026PublicationV2,
} from "./publication-v2-types";
import { contentionValidationFailed, validateContentionMembershipSnapshot } from "./validate-contention-membership";

export const CONTENTION_MEMBERSHIP_REVIEW_VERSION = "registry-2026-contention-membership-review/1.0.0";
export const LOCAL_CONTENTION_ADAPTER_ID = "local-artifact";
export const LOCAL_CONTENTION_ADAPTER_SCHEMA_VERSION = "local-artifact-adapter/1.0.0";

export const CONTENTION_CAPTURE_LIMITATIONS = [
  "NOT PROMOTED.",
  "Built offline from a local Reveal Day contention CSV. No network fetch was performed by this command.",
  "Official ICANN contention membership sidecar (registry-2026-contention-membership/1.0.0).",
  "Normalized sidecar content hash is semantic (sets/members/published fields + Application pin); sourceRowIndex and CSV row order are excluded. Raw source SHA-256 remains byte/order-sensitive.",
  OFFICIAL_VS_EXACT_STRING_NOTE,
  "publishedOrgName is the exact CSV Org Name text — not RIH resolved Organization.",
  "Does not mutate the pinned Application publication artifact; relationship is via evidence bundle pin.",
  "Join success does not change Application publication coverage from PARTIAL to COMPLETE.",
  "Reveal Day snapshot semantics only; later contention state may differ.",
  "Browser / claim-actuality activation is out of scope for this build.",
] as const;

export type ContentionMembershipBuildRequest = {
  bytes: Uint8Array;
  artifactId: string;
  sourceVersion: number;
  captureId: string;
  sourceUrl: string;
  finalUrl?: string;
  sourceName: string;
  retrievedAt: string;
  publishedAt: string;
  mediaType: string;
  artifactRole: string;
  evidenceClass: string;
  snapshotId: string;
  recordedHttpStatus: number;
  expectSourceHash: string;
  applicationPublication: Registry2026PublicationV2;
  expectApplicationGraphHash: string;
  redirectChain?: string[];
  limitations?: string[];
  bundleId?: string;
};

export type ContentionMembershipReviewDocument = {
  reviewVersion: typeof CONTENTION_MEMBERSHIP_REVIEW_VERSION;
  promoted: false;
  promotionStatus: "NOT_PROMOTED";
  networkFetchPerformed: false;
  browserDatasetChanged: false;
  claimActualityWritten: false;
  promotionHistoryWritten: false;
  applicationPublicationMutated: false;
  snapshotId: string | null;
  schemaVersion: typeof CONTENTION_MEMBERSHIP_SCHEMA_VERSION;
  sourceHash: string | null;
  sidecarContentHash: string | null;
  applicationPublicationPinHash: string | null;
  applicationGraphContentHash: string | null;
  sourceMembershipRowCount: number | null;
  officialContentionSetCount: number | null;
  joinedMemberCount: number | null;
  unjoinedMemberCount: number | null;
  replacementIdCount: number | null;
  minSetSize: number | null;
  maxSetSize: number | null;
  applicationsAppearingInMultipleSets: number | null;
  wdoPresentInContentionSource: boolean | null;
  validationStatus: "pass" | "fail";
  qualityLines: string[];
  warnings: string[];
  errors: string[];
};

export type BuildContentionMembershipResult = {
  ok: boolean;
  review: ContentionMembershipReviewDocument;
  snapshot?: ContentionMembershipSnapshotV1;
  evidenceBundle?: RevealDayEvidenceBundleV1;
};

function blankReview(
  request: ContentionMembershipBuildRequest,
  sourceHash: string | null,
): ContentionMembershipReviewDocument {
  return {
    reviewVersion: CONTENTION_MEMBERSHIP_REVIEW_VERSION,
    promoted: false,
    promotionStatus: "NOT_PROMOTED",
    networkFetchPerformed: false,
    browserDatasetChanged: false,
    claimActualityWritten: false,
    promotionHistoryWritten: false,
    applicationPublicationMutated: false,
    snapshotId: request.snapshotId || null,
    schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
    sourceHash,
    sidecarContentHash: null,
    applicationPublicationPinHash: null,
    applicationGraphContentHash: null,
    sourceMembershipRowCount: null,
    officialContentionSetCount: null,
    joinedMemberCount: null,
    unjoinedMemberCount: null,
    replacementIdCount: null,
    minSetSize: null,
    maxSetSize: null,
    applicationsAppearingInMultipleSets: null,
    wdoPresentInContentionSource: null,
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

function pinFromPublication(publication: Registry2026PublicationV2): ApplicationPublicationPinV1 {
  return {
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    snapshotId: publication.snapshotId,
    applicationGraphContentSha256: publication.bundleManifest.applicationGraphContentSha256,
    normalizedApplicationRecordsObserved: publication.coverage.normalizedApplicationRecordsObserved,
    applicationRecordCoverageCompleteness: publication.coverage.applicationRecordCoverage.completeness,
  };
}

/**
 * Build registry-2026-contention-membership/1.0.0 from local contention CSV + pinned Application 2.0.0 publication.
 * Does not fetch, promote, mutate claim actuality, or rewrite the Application publication artifact.
 */
export function buildContentionMembershipFromLocalArtifact(
  request: ContentionMembershipBuildRequest,
): BuildContentionMembershipResult {
  const sourceHash = sha256Hex(request.bytes);
  const review = blankReview(request, sourceHash);
  const errors = review.errors;

  if (request.artifactRole !== APS_CONTENTION_CSV_ARTIFACT_ROLE) {
    errors.push(`artifactRole must be ${APS_CONTENTION_CSV_ARTIFACT_ROLE}`);
  }
  if (
    request.mediaType !== APS_CONTENTION_CSV_MEDIA_TYPE
    && request.mediaType !== "text/csv;charset=UTF-8"
  ) {
    errors.push("mediaType must be text/csv for Reveal Day contention export");
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

  const publication = request.applicationPublication;
  if (publication.schemaVersion !== PUBLICATION_SCHEMA_VERSION_V20) {
    errors.push(`application publication schema must be ${PUBLICATION_SCHEMA_VERSION_V20}`);
  }
  const computedAppGraphHash = contentHash(applicationGraphHashInput(publication));
  if (publication.bundleManifest.applicationGraphContentSha256 !== computedAppGraphHash) {
    errors.push("application publication bundleManifest.applicationGraphContentSha256 does not match content");
  }
  if (!/^[0-9a-f]{64}$/.test(request.expectApplicationGraphHash)) {
    errors.push("expectApplicationGraphHash must be 64 lowercase hex characters");
  } else if (request.expectApplicationGraphHash !== computedAppGraphHash) {
    errors.push("Application publication pin mismatch: expectApplicationGraphHash does not match publication");
  }
  if (publication.coverage.normalizedApplicationRecordsObserved !== publication.applications.length) {
    errors.push("application publication coverage count does not match applications.length");
  }

  if (errors.length > 0) return { ok: false, review };

  let parsed;
  try {
    parsed = parseApsContentionExportArtifact({
      artifactRole: request.artifactRole,
      mediaType: request.mediaType,
      bytes: request.bytes,
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "APS Contention CSV parse failed");
    return { ok: false, review };
  }

  const applicationIds = new Set(publication.applications.map((a) => a.applicationId));
  let joined = 0;
  let unjoined = 0;
  const unjoinedIds: string[] = [];
  for (const set of parsed.contentionSets) {
    for (const member of set.members) {
      if (applicationIds.has(member.applicationId)) {
        joined += 1;
      } else {
        unjoined += 1;
        unjoinedIds.push(member.applicationId);
      }
    }
  }
  if (unjoined > 0) {
    errors.push(
      `Unknown Application ID(s) not present in pinned publication (${unjoined}): ${unjoinedIds.slice(0, 5).join(", ")}`,
    );
  }
  if (parsed.replacementIdCount > 0) {
    errors.push(`Replacement -R IDs present in contention source: ${parsed.replacementIdCount}`);
  }

  const setSizes = parsed.contentionSets.map((s) => s.members.length);
  const minSetSize = setSizes.length ? Math.min(...setSizes) : 0;
  const maxSetSize = setSizes.length ? Math.max(...setSizes) : 0;
  if (setSizes.some((n) => n < 2)) {
    errors.push("Official Reveal Day contention sets must not include singleton sets in this capture expectation path");
  }

  const pin = pinFromPublication(publication);
  const applicationPublicationPinSha256 = contentHash(pin);
  const limitations = [...CONTENTION_CAPTURE_LIMITATIONS, ...(request.limitations ?? [])];

  const draft: ContentionMembershipSnapshotV1 = {
    schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
    snapshotKind: "official-contention-membership-sidecar",
    snapshotId: request.snapshotId,
    publishedAt: request.publishedAt,
    retrievedAt: request.retrievedAt,
    parserVersion: APS_CONTENTION_CSV_PARSER_VERSION,
    normalizerVersion: APS_CONTENTION_CSV_NORMALIZER_VERSION,
    source: {
      name: request.sourceName,
      url: request.sourceUrl,
      evidenceClass: request.evidenceClass,
      ...(request.finalUrl ? { finalUrl: request.finalUrl } : {}),
    },
    limitations,
    lineage: {
      intakeAdapterVersion: APS_CONTENTION_CSV_PARSER_VERSION,
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      rawSha256: sourceHash,
      pipelineSourceId: request.artifactId,
      pipelineSourceVersion: request.sourceVersion,
      manifestAttemptId: request.captureId,
      fetchUrl: request.sourceUrl,
      ...(request.finalUrl ? { finalUrl: request.finalUrl } : {}),
      retrievedAt: request.retrievedAt,
      httpStatus: request.recordedHttpStatus,
      adapterId: LOCAL_CONTENTION_ADAPTER_ID,
      adapterSchemaVersion: LOCAL_CONTENTION_ADAPTER_SCHEMA_VERSION,
      redirectChain: request.redirectChain ?? [],
      responseHeaderDigest: null,
    },
    applicationPublicationPin: pin,
    quality: {
      sourceMembershipRowCount: parsed.sourceMembershipRowCount,
      officialContentionSetCount: parsed.contentionSets.length,
      joinedMemberCount: joined,
      unjoinedMemberCount: unjoined,
      replacementIdCount: parsed.replacementIdCount,
      minSetSize,
      maxSetSize,
      applicationsAppearingInMultipleSets: parsed.applicationsAppearingInMultipleSets,
      wdoPresentInContentionSource: parsed.wdoPresentInContentionSource,
      evidenceSeparationNote: OFFICIAL_VS_EXACT_STRING_NOTE,
      applicationCoverageUnchangedByContentionJoin: true,
    },
    contentionSets: parsed.contentionSets,
    bundleManifest: {
      rawSourceSha256: sourceHash,
      sidecarContentSha256: "",
      applicationPublicationPinSha256,
    },
  };

  const sidecarContentSha256 = contentHash(contentionSidecarHashInput(draft));
  draft.bundleManifest.sidecarContentSha256 = sidecarContentSha256;

  const again = contentHash(
    contentionSidecarHashInput({ ...draft, retrievedAt: "2099-01-01T00:00:00Z" }),
  );
  if (again !== sidecarContentSha256) {
    errors.push("sidecar content hash must ignore retrievedAt");
  }

  const validation = validateContentionMembershipSnapshot(draft);
  if (contentionValidationFailed(validation.issues)) {
    errors.push(...validation.issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`));
  }

  review.sourceMembershipRowCount = parsed.sourceMembershipRowCount;
  review.officialContentionSetCount = parsed.contentionSets.length;
  review.joinedMemberCount = joined;
  review.unjoinedMemberCount = unjoined;
  review.replacementIdCount = parsed.replacementIdCount;
  review.minSetSize = minSetSize;
  review.maxSetSize = maxSetSize;
  review.applicationsAppearingInMultipleSets = parsed.applicationsAppearingInMultipleSets;
  review.wdoPresentInContentionSource = parsed.wdoPresentInContentionSource;
  review.sidecarContentHash = sidecarContentSha256;
  review.applicationPublicationPinHash = applicationPublicationPinSha256;
  review.applicationGraphContentHash = computedAppGraphHash;

  review.qualityLines = [
    `SOURCE MEMBERSHIP ROWS: ${parsed.sourceMembershipRowCount}`,
    `OFFICIAL CONTENTION SETS OBSERVED: ${parsed.contentionSets.length}`,
    `JOINED MEMBERS: ${joined}`,
    `UNJOINED MEMBERS: ${unjoined}`,
    `REPLACEMENT IDS: ${parsed.replacementIdCount}`,
    `MIN SET SIZE: ${minSetSize}`,
    `MAX SET SIZE: ${maxSetSize}`,
    `APPLICATION PUBLICATION PIN: ${computedAppGraphHash}`,
    `CONTENTION SOURCE SHA-256: ${sourceHash}`,
    "PROMOTION STATUS: NOT PROMOTED",
    OFFICIAL_VS_EXACT_STRING_NOTE,
    `APPLICATIONS IN MULTIPLE SETS: ${parsed.applicationsAppearingInMultipleSets}`,
    `WDO IN CONTENTION SOURCE: ${parsed.wdoPresentInContentionSource ? "yes" : "no"}`,
    `APPLICATION COVERAGE (PINNED, UNCHANGED): ${pin.applicationRecordCoverageCompleteness.toUpperCase()} ${pin.normalizedApplicationRecordsObserved}`,
  ];

  if (canonicalJson(draft) !== canonicalJson(structuredClone(draft))) {
    errors.push("deterministic canonicalization mismatch");
  }

  if (errors.length > 0) {
    review.validationStatus = "fail";
    return { ok: false, review };
  }

  const evidenceBundle: RevealDayEvidenceBundleV1 = {
    schemaVersion: REVEAL_DAY_EVIDENCE_BUNDLE_SCHEMA_VERSION,
    bundleId: request.bundleId ?? `${publication.snapshotId}__${request.snapshotId}`,
    promotionStatus: "NOT_PROMOTED",
    claimActualityWritten: false,
    relationship: "application-publication-exact-pin-to-contention-sidecar",
    note:
      "Links Application 2.0.0 publication to contention sidecar by exact content hashes without rewriting the immutable Application publication (supplementalArtifactPins.contentionMembershipPin remains null on the publication artifact).",
    applicationPublication: {
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
      snapshotId: publication.snapshotId,
      applicationGraphContentSha256: computedAppGraphHash,
      supplementalContentionPinOnPublication: null,
    },
    contentionMembership: {
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: request.snapshotId,
      sidecarContentSha256,
      rawSourceSha256: sourceHash,
    },
  };

  review.validationStatus = "pass";
  return { ok: true, review, snapshot: draft, evidenceBundle };
}

export async function writeContentionMembershipArtifacts(args: {
  snapshotPath: string;
  reviewPath: string;
  bundlePath: string;
  snapshot: ContentionMembershipSnapshotV1;
  review: ContentionMembershipReviewDocument;
  evidenceBundle: RevealDayEvidenceBundleV1;
}): Promise<void> {
  await mkdir(dirname(args.snapshotPath), { recursive: true });
  await mkdir(dirname(args.reviewPath), { recursive: true });
  await mkdir(dirname(args.bundlePath), { recursive: true });
  await writeFile(args.snapshotPath, `${JSON.stringify(args.snapshot, null, 2)}\n`, "utf8");
  await writeFile(args.reviewPath, `${JSON.stringify(args.review, null, 2)}\n`, "utf8");
  await writeFile(args.bundlePath, `${JSON.stringify(args.evidenceBundle, null, 2)}\n`, "utf8");
}
