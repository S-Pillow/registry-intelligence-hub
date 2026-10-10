import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { REGISTRY_BROWSER_2012_APPLICATION_PAYLOAD_VERSION } from "@/historical-2012/browser-payload-types";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";

export type Historical2012PayloadSelectionReason =
  | "not-configured"
  | "invalid-document"
  | "round-mismatch"
  | "corpus-hash-mismatch"
  | "record-count-mismatch"
  | "loaded-active";

export type Historical2012PayloadResolution =
  | {
      status: "not-loaded";
      reason: Historical2012PayloadSelectionReason;
      errorMessage: string;
    }
  | {
      status: "loaded";
      reason: "loaded-active";
      document: Registry2012ApplicationsDocument;
      /** Corpus size. Stays set when application rows are omitted from a shared layout transfer. */
      applicationCount: number;
    };

export function isRegistry2012BrowserPayloadDocument(
  value: unknown,
): value is Registry2012ApplicationsDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.payloadVersion === REGISTRY_BROWSER_2012_APPLICATION_PAYLOAD_VERSION
    && record.roundProgramYear === 2012
    && record.payloadMode === "historical-2012"
    && typeof record.corpusContentHash === "string"
    && typeof record.snapshotId === "string"
    && Array.isArray(record.applications)
    && record.provenance != null
    && typeof record.provenance === "object"
  );
}

export function resolveHistorical2012BrowserPayload(
  configured: Registry2012ApplicationsDocument | null,
  expectedCorpusHash?: string,
): Historical2012PayloadResolution {
  if (!configured) {
    return {
      status: "not-loaded",
      reason: "not-configured",
      errorMessage:
        "No 2012 historical application document was supplied. An explicit override that fails is not replaced with another corpus.",
    };
  }

  if (!isRegistry2012BrowserPayloadDocument(configured)) {
    return {
      status: "not-loaded",
      reason: "invalid-document",
      errorMessage: `Unsupported 2012 payload document (expected ${REGISTRY_BROWSER_2012_APPLICATION_PAYLOAD_VERSION}).`,
    };
  }

  if (configured.roundProgramYear !== 2012) {
    return {
      status: "not-loaded",
      reason: "round-mismatch",
      errorMessage: "Payload roundProgramYear is not 2012 — refusing to load.",
    };
  }

  if (configured.applications.length !== APPROVED_2012_BASELINE.applications) {
    return {
      status: "not-loaded",
      reason: "record-count-mismatch",
      errorMessage: `Expected ${APPROVED_2012_BASELINE.applications} applications, got ${configured.applications.length}.`,
    };
  }

  if (expectedCorpusHash && configured.corpusContentHash !== expectedCorpusHash) {
    return {
      status: "not-loaded",
      reason: "corpus-hash-mismatch",
      errorMessage: "Configured 2012 payload corpusContentHash does not match the approved generated artifact.",
    };
  }

  return {
    status: "loaded",
    reason: "loaded-active",
    document: configured,
    applicationCount: configured.applications.length,
  };
}

/** Corpus size for labels. Uses the pinned count when application rows were omitted from a shared layout transfer. */
export function historical2012CorpusApplicationCount(resolution: Historical2012PayloadResolution): number {
  return resolution.status === "loaded" ? resolution.applicationCount : 0;
}

/**
 * Shared layout transfer: keep provenance and the corpus count, drop the 1,930 rows.
 * Historical Explore loads the full document on that route only.
 */
export function omitHistoricalApplicationsForSharedLayout(
  resolution: Historical2012PayloadResolution,
): Historical2012PayloadResolution {
  if (resolution.status !== "loaded") return resolution;
  return {
    ...resolution,
    applicationCount: resolution.applicationCount,
    document: { ...resolution.document, applications: [] },
  };
}
