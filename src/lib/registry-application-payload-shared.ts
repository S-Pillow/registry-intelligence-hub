import rehearsalFixture from "@/data/fixtures/registry-applications.json";
import { REHEARSAL_BROWSER_SOURCE } from "@/lib/presentation-mode";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION } from "@/reveal-day-2026/browser-payload-types";
import { PUBLICATION_SCHEMA_VERSION_V11, type Registry2026PublicationSnapshot } from "@/reveal-day-2026/types";
import { PUBLICATION_SCHEMA_VERSION_V20 } from "@/reveal-day-2026/publication-v2-types";
import type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";
import {
  isBrowserApplicationPayloadDocumentV2,
  type RegistryApplicationsDocumentV2,
} from "@/lib/registry-applications-document-v2";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/reveal-day-2026/browser-payload-types";

export type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";
export { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION } from "@/reveal-day-2026/browser-payload-types";

export type HubRegistryPayloadMode =
  | "rehearsal"
  | "promoted-2026"
  | "promoted-2026-v2"
  | "unavailable";

export type HubRegistrySelectionReason =
  | "rehearsal-default"
  | "claim-not-promoted"
  | "payload-not-configured"
  | "snapshot-id-mismatch"
  | "content-hash-mismatch"
  | "payload-version-unsupported-for-active"
  | "payload-malformed"
  | "pin-mismatch"
  | "promoted-active"
  | "promoted-active-v2"
  | "active-source-fail-closed";

export type ActiveSourceError = {
  code: HubRegistrySelectionReason;
  message: string;
};

export type HubRegistryDataResolution = {
  status: "ok" | "fail-closed";
  document: RegistryApplicationsDocument | null;
  documentV2: RegistryApplicationsDocumentV2 | null;
  documentVersion: "1.0.0" | "2.0.0" | null;
  mode: HubRegistryPayloadMode;
  selectionReason: HubRegistrySelectionReason;
  activeSourceError: ActiveSourceError | null;
};

/** Legacy/test fixture shape accepted by HubRegistryDataProvider (coerced to full resolution). */
export type HubRegistryDataResolutionInput =
  | HubRegistryDataResolution
  | {
      document: RegistryApplicationsDocument;
      mode: HubRegistryPayloadMode | "rehearsal" | "promoted-2026";
      selectionReason: HubRegistrySelectionReason | string;
    };

export function coerceHubRegistryDataResolution(
  resolution: HubRegistryDataResolutionInput,
): HubRegistryDataResolution {
  if (
    "status" in resolution
    && resolution.status
    && "documentV2" in resolution
    && "documentVersion" in resolution
    && "activeSourceError" in resolution
  ) {
    return resolution;
  }
  const legacy = resolution as {
    document: RegistryApplicationsDocument;
    mode?: HubRegistryPayloadMode;
    selectionReason?: HubRegistrySelectionReason;
  };
  return {
    status: "ok",
    document: legacy.document,
    documentV2: null,
    documentVersion: "1.0.0",
    mode: legacy.mode ?? "rehearsal",
    selectionReason: legacy.selectionReason ?? "rehearsal-default",
    activeSourceError: null,
  };
}

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
    source: { ...REHEARSAL_BROWSER_SOURCE },
    limitations: [
      "Synthetic rehearsal fixture — not an ICANN publication and not a promoted 2026 application list.",
      ...rehearsalFixture.limitations.filter((line) => !/official 2026 publication/i.test(line)),
    ],
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

export function isPublicationV2SnapshotDocument(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === PUBLICATION_SCHEMA_VERSION_V20
    && record.publicationKind === "immutable-publication"
    && Array.isArray(record.applications)
  );
}

function okRehearsal(reason: HubRegistrySelectionReason): HubRegistryDataResolution {
  return {
    status: "ok",
    document: rehearsalRegistryApplicationsDocument(),
    documentV2: null,
    documentVersion: "1.0.0",
    mode: "rehearsal",
    selectionReason: reason,
    activeSourceError: null,
  };
}

function failClosed(reason: HubRegistrySelectionReason, message: string): HubRegistryDataResolution {
  return {
    status: "fail-closed",
    document: null,
    documentV2: null,
    documentVersion: null,
    mode: "unavailable",
    selectionReason: reason,
    activeSourceError: { code: reason, message },
  };
}

function v2PinsMatchClaim(
  document: RegistryApplicationsDocumentV2,
  claim: ClaimActualityState,
): { ok: true } | { ok: false; reason: HubRegistrySelectionReason; message: string } {
  if (document.payloadVersion !== REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20) {
    return {
      ok: false,
      reason: "payload-malformed",
      message: `Active 2.x payload requires ${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20}`,
    };
  }
  if (document.publicationSchemaVersion !== PUBLICATION_SCHEMA_VERSION_V20) {
    return {
      ok: false,
      reason: "payload-malformed",
      message: `Active 2.x payload publicationSchemaVersion must be ${PUBLICATION_SCHEMA_VERSION_V20}`,
    };
  }
  if (document.snapshotId !== claim.snapshotId) {
    return {
      ok: false,
      reason: "snapshot-id-mismatch",
      message: `Active 2.x snapshotId mismatch: payload=${document.snapshotId} claim=${claim.snapshotId}`,
    };
  }
  if (document.snapshotContentHash !== claim.snapshotContentHash) {
    return {
      ok: false,
      reason: "content-hash-mismatch",
      message: `Active 2.x content hash mismatch: payload=${document.snapshotContentHash} claim=${claim.snapshotContentHash}`,
    };
  }
  if (claim.rawSha256 && document.rawSha256 !== claim.rawSha256) {
    return {
      ok: false,
      reason: "pin-mismatch",
      message: `Active 2.x rawSha256 mismatch: payload=${document.rawSha256} claim=${claim.rawSha256}`,
    };
  }
  if (
    document.bundleManifest.applicationGraphContentSha256 !== document.snapshotContentHash
  ) {
    return {
      ok: false,
      reason: "pin-mismatch",
      message: "Active 2.x bundleManifest.applicationGraphContentSha256 must equal snapshotContentHash",
    };
  }
  if (
    document.observedApplicationRecords !== document.applications.length
    || document.applicationRecordCoverage.observed !== document.applications.length
  ) {
    return {
      ok: false,
      reason: "payload-malformed",
      message: "Active 2.x observedApplicationRecords must equal applications.length",
    };
  }
  if (document.officialApplications !== document.applicationRecordCoverage.official) {
    return {
      ok: false,
      reason: "payload-malformed",
      message: "Active 2.x officialApplications must match coverage.official",
    };
  }
  if (
    document.applicationRecordCoverage.completeness === "partial"
    && document.observedApplicationRecords >= document.officialApplications
    && document.knownExcludedRecords.length === 0
  ) {
    return {
      ok: false,
      reason: "payload-malformed",
      message: "Active 2.x partial coverage semantics invalid",
    };
  }
  return { ok: true };
}

/**
 * Resolve the active browser document.
 *
 * NOT_PUBLISHED → rehearsal (2.x configured payloads are ignored, not activated).
 * REAL_SOURCE_READY + matching 1.x or 2.x → promoted active.
 * REAL_SOURCE_READY + missing/mismatch/malformed → FAIL CLOSED (never rehearsal).
 */
export function resolveActiveRegistryApplicationsDocument(
  claimActualityState: ClaimActualityState,
  configuredPayload: RegistryApplicationsDocument | RegistryApplicationsDocumentV2 | null | unknown,
): HubRegistryDataResolution {
  const claimIsReal =
    claimActualityState.round2026ApplicationActuality === "REAL_SOURCE_READY";

  if (!claimIsReal) {
    // Configured 2.x while not promoted must not become active; stay on rehearsal.
    if (isBrowserApplicationPayloadDocumentV2(configuredPayload)) {
      return okRehearsal("claim-not-promoted");
    }
    if (!configuredPayload) {
      return okRehearsal("claim-not-promoted");
    }
    if (isBrowserApplicationPayloadDocument(configuredPayload)) {
      return okRehearsal("claim-not-promoted");
    }
    return okRehearsal("claim-not-promoted");
  }

  if (configuredPayload == null) {
    return failClosed(
      "payload-not-configured",
      "REAL_SOURCE_READY requires a configured browser payload — fail closed (no rehearsal fallback)",
    );
  }

  if (isBrowserApplicationPayloadDocumentV2(configuredPayload)) {
    const pins = v2PinsMatchClaim(configuredPayload, claimActualityState);
    if (!pins.ok) {
      return failClosed(pins.reason, pins.message);
    }
    const active: RegistryApplicationsDocumentV2 = {
      ...configuredPayload,
      payloadMode: "promoted-2026",
      limitations: configuredPayload.limitations.filter(
        (line) => !/Inactive 2\.x browser projection/i.test(line),
      ).concat([
        "Active 2.x browser projection — official application total is the official aggregate, not observedApplicationRecords.",
      ]),
    };
    return {
      status: "ok",
      document: null,
      documentV2: active,
      documentVersion: "2.0.0",
      mode: "promoted-2026-v2",
      selectionReason: "promoted-active-v2",
      activeSourceError: null,
    };
  }

  if (!isBrowserApplicationPayloadDocument(configuredPayload)) {
    return failClosed(
      "payload-malformed",
      "REAL_SOURCE_READY configured payload is neither registry-browser-applications/1.0.0 nor 2.0.0 — fail closed",
    );
  }

  if (configuredPayload.snapshotId !== claimActualityState.snapshotId) {
    return failClosed(
      "snapshot-id-mismatch",
      `REAL_SOURCE_READY snapshotId mismatch: payload=${configuredPayload.snapshotId} claim=${claimActualityState.snapshotId}`,
    );
  }
  if (configuredPayload.snapshotContentHash !== claimActualityState.snapshotContentHash) {
    return failClosed(
      "content-hash-mismatch",
      `REAL_SOURCE_READY content hash mismatch: payload=${configuredPayload.snapshotContentHash} claim=${claimActualityState.snapshotContentHash}`,
    );
  }

  return {
    status: "ok",
    document: { ...configuredPayload, payloadMode: "promoted-2026" },
    documentV2: null,
    documentVersion: "1.0.0",
    mode: "promoted-2026",
    selectionReason: "promoted-active",
    activeSourceError: null,
  };
}

/**
 * Publication may be asserted only when the active snapshot is the
 * hash-matched promoted payload. Fail-closed / rehearsal must not look published.
 */
export function claimActualityAssertedForBrowser(
  configured: ClaimActualityState,
  resolution: Pick<HubRegistryDataResolution, "mode" | "selectionReason" | "status">,
): ClaimActualityState {
  if (
    resolution.status === "ok"
    && (
      (resolution.mode === "promoted-2026" && resolution.selectionReason === "promoted-active")
      || (resolution.mode === "promoted-2026-v2" && resolution.selectionReason === "promoted-active-v2")
    )
  ) {
    return configured;
  }
  return DEFAULT_CLAIM_ACTUALITY_STATE;
}
