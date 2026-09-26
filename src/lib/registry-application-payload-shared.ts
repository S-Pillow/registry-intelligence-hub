import rehearsalFixture from "@/data/fixtures/registry-applications.json";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION } from "@/reveal-day-2026/browser-payload-types";
import { PUBLICATION_SCHEMA_VERSION_V11, type Registry2026PublicationSnapshot } from "@/reveal-day-2026/types";
import type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";

export type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";
export { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION } from "@/reveal-day-2026/browser-payload-types";

export type HubRegistryPayloadMode = "rehearsal" | "promoted-2026";

export type HubRegistryDataResolution = {
  document: RegistryApplicationsDocument;
  mode: HubRegistryPayloadMode;
  selectionReason:
    | "rehearsal-default"
    | "claim-not-promoted"
    | "payload-not-configured"
    | "snapshot-id-mismatch"
    | "content-hash-mismatch"
    | "promoted-active";
};

/** Pin aligned with server-side `contentHash({ snapshotId, applications })` for the rehearsal fixture cohort. */
export const REHEARSAL_REGISTRY_SNAPSHOT_CONTENT_HASH =
  "ef19fb2993b9abd44a0768a24c0eb79ffdb85c8ce86ca21a2a18a65689b9ec2d";

/** Rehearsal document pinned for dev and fallback when promotion payload is inactive. */
export function rehearsalRegistryApplicationsDocument(): RegistryApplicationsDocument {
  return {
    ...rehearsalFixture,
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION,
    payloadMode: "rehearsal",
    snapshotContentHash: REHEARSAL_REGISTRY_SNAPSHOT_CONTENT_HASH,
  };
}

export function isBrowserApplicationPayloadDocument(
  value: unknown,
): value is RegistryApplicationsDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.payloadVersion === REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION
    && Array.isArray(record.applications)
    && typeof record.snapshotId === "string"
    && typeof record.snapshotContentHash === "string"
  );
}

export function isPublicationSnapshotDocument(value: unknown): value is Registry2026PublicationSnapshot {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === PUBLICATION_SCHEMA_VERSION_V11
    && record.publicationKind === "immutable-publication"
    && Array.isArray(record.applications)
  );
}

export function resolveActiveRegistryApplicationsDocument(
  claimActualityState: ClaimActualityState,
  configuredPayload: RegistryApplicationsDocument | null,
): HubRegistryDataResolution {
  const rehearsal = rehearsalRegistryApplicationsDocument();

  if (claimActualityState.round2026ApplicationActuality !== "REAL_SOURCE_READY") {
    return { document: rehearsal, mode: "rehearsal", selectionReason: "claim-not-promoted" };
  }
  if (!configuredPayload) {
    return { document: rehearsal, mode: "rehearsal", selectionReason: "payload-not-configured" };
  }
  if (configuredPayload.snapshotId !== claimActualityState.snapshotId) {
    return { document: rehearsal, mode: "rehearsal", selectionReason: "snapshot-id-mismatch" };
  }
  if (configuredPayload.snapshotContentHash !== claimActualityState.snapshotContentHash) {
    return { document: rehearsal, mode: "rehearsal", selectionReason: "content-hash-mismatch" };
  }
  return {
    document: { ...configuredPayload, payloadMode: "promoted-2026" },
    mode: "promoted-2026",
    selectionReason: "promoted-active",
  };
}

/**
 * Publication may be asserted only when the active snapshot is the
 * hash-matched promoted payload. A configured claim that does not pin
 * that payload stays NOT_PUBLISHED so rehearsal rows cannot look published.
 */
export function claimActualityAssertedForBrowser(
  configured: ClaimActualityState,
  resolution: Pick<HubRegistryDataResolution, "mode" | "selectionReason">,
): ClaimActualityState {
  if (resolution.mode === "promoted-2026" && resolution.selectionReason === "promoted-active") {
    return configured;
  }
  return DEFAULT_CLAIM_ACTUALITY_STATE;
}
