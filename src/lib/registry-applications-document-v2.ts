/**
 * registry-browser-applications/2.0.0 — honest browser projection of Publication 2.0.0.
 * Separate from registry-browser-applications/1.0.0 (Application rows with org/category/returning).
 */

import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/reveal-day-2026/browser-payload-types";
import type {
  ApplicationDesignationsV2,
  ApplicationLabelsV2,
  ApplicationRecordCoverageV2,
  AppliedStringV2,
  KnownExcludedRecordV2,
  OfficialAggregatesV2,
  ReplacementStringV2,
} from "@/reveal-day-2026/publication-v2-types";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";

export { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 };

/** Optional official contention overlay fields — never written into authoritative Application source. */
export type BrowserOfficialContentionOverlayV2 =
  | {
      membershipPresent: true;
      /** Official Reveal Day contention set `#` values. Not exact-string competition. */
      officialContentionSetIds: string[];
      terminology: "official-initial-contention";
    }
  | {
      membershipPresent: false;
      officialContentionSetIds: [];
      terminology: "official-initial-contention";
    };

export type BrowserApplicationV2 = {
  applicationId: string;
  /** Published APS Applicant Name (legal name). Not RIH Organization. */
  applicant: string;
  country: string;
  region: string;
  applicationStatus: string;
  processingStage: string;
  /** APS Application Type as published. */
  applicationType: string;
  priority?: string;
  designations: ApplicationDesignationsV2;
  labels: ApplicationLabelsV2;
  appliedString: AppliedStringV2;
  replacementString?: ReplacementStringV2;
  /** Present only when a valid contention overlay was joined for this projection. */
  officialContention?: BrowserOfficialContentionOverlayV2;
};

export type BrowserContentionOverlayDocumentV2 = {
  status: "available" | "unavailable";
  schemaVersion: typeof CONTENTION_MEMBERSHIP_SCHEMA_VERSION;
  snapshotId: string | null;
  sidecarContentSha256: string | null;
  rawSha256: string | null;
  applicationPublicationPinHash: string | null;
  officialContentionSetCount: number | null;
  joinedMemberCount: number | null;
  reason?: string;
};

export type RegistryApplicationsDocumentV2 = {
  payloadVersion: typeof REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20;
  /**
   * This ticket only builds inactive projections.
   * Active promotion/selection remains a later authorization.
   */
  payloadMode: "inactive-2x";
  snapshotId: string;
  /** Application graph content hash (Publication 2.0 semantic pin). */
  snapshotContentHash: string;
  publicationSchemaVersion: typeof PUBLICATION_SCHEMA_VERSION_V20;
  publishedAt: string;
  retrievedAt: string;
  checkedAt: string;
  parserVersion: string;
  normalizerVersion: string;
  source: { name: string; url: string; evidenceClass: string };
  limitations: string[];
  /** Machine-readable disclosure keys for presentation. */
  disclosureKeys: readonly string[];
  officialAggregates: Pick<
    OfficialAggregatesV2,
    "officialApplicationCount" | "officialApplicantCount"
  > & {
    provenance: OfficialAggregatesV2["provenance"];
  };
  applicationRecordCoverage: ApplicationRecordCoverageV2;
  /** Convenience aliases — keep official vs observed distinct (no ambiguous applicationCount). */
  officialApplications: number;
  observedApplicationRecords: number;
  officialApplicants: number;
  knownExcludedRecords: KnownExcludedRecordV2[];
  bundleManifest: {
    officialAggregatesContentSha256: string;
    coverageDescriptorSha256: string;
    applicationGraphContentSha256: string;
  };
  rawSha256: string;
  contentionOverlay: BrowserContentionOverlayDocumentV2;
  applications: BrowserApplicationV2[];
};

export function isBrowserApplicationPayloadDocumentV2(
  value: unknown,
): value is RegistryApplicationsDocumentV2 {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.payloadVersion === REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20
    && Array.isArray(record.applications)
    && typeof record.snapshotId === "string"
    && typeof record.snapshotContentHash === "string"
    && typeof record.officialApplications === "number"
    && typeof record.observedApplicationRecords === "number"
  );
}

/** Forbidden 1.1-derived keys that must never appear on a 2.x Application record. */
export const FORBIDDEN_BROWSER_V2_APPLICATION_KEYS = [
  "organization",
  "category",
  "returning",
  "confidence",
  "contentionSet",
  "string",
  "aLabel",
  "replacement",
  "idn",
  "id",
] as const;
