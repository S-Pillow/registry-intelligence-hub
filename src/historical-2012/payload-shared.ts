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
        "2012 historical application payload is not configured. Set REGISTRY_HUB_2012_APPLICATION_PAYLOAD_PATH or REGISTRY_HUB_2012_APPLICATION_PAYLOAD_JSON.",
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
  };
}
