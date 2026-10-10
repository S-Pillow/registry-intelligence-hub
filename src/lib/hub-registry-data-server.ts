import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClaimActualityState } from "@/reveal-day-2026/claim-actuality";
import {
  resolveActiveRegistryApplicationsDocument,
  type HubRegistryDataResolution,
} from "@/lib/registry-application-payload-shared";
import { loadConfiguredApplicationPayloadAny } from "@/lib/registry-application-payload-server";
import {
  CONTENTION_MEMBERSHIP_PATH_ENV,
  loadPromotedContentionActualityState,
} from "@/lib/contention-actuality-server";
import { bindContentionOverlayForActiveBrowserV2 } from "@/lib/registry-application-payload-v2";
import { validateContentionMembershipSnapshot } from "@/reveal-day-2026/validate-contention-membership";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";

async function loadConfiguredContentionSidecar(): Promise<ContentionMembershipSnapshotV1 | null> {
  const configuredPath = process.env[CONTENTION_MEMBERSHIP_PATH_ENV]?.trim();
  if (!configuredPath) return null;
  const absolute = configuredPath.startsWith("/")
    ? configuredPath
    : join(process.cwd(), configuredPath);
  const text = await readFile(absolute, "utf8");
  const { snapshot, issues } = validateContentionMembershipSnapshot(JSON.parse(text) as unknown);
  if (!snapshot || issues.some((i) => i.severity === "error")) {
    throw new Error(
      `${CONTENTION_MEMBERSHIP_PATH_ENV} contention sidecar invalid: ${
        issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ") || "unknown"
      }`,
    );
  }
  return snapshot;
}

/**
 * Load configured payload and resolve active document.
 * REAL + missing/unreadable path → fail-closed resolution (no rehearsal).
 * Contention overlay binds independently and never invalidates Application.
 */
export async function loadHubRegistryData(
  claimActualityState: ClaimActualityState,
): Promise<HubRegistryDataResolution> {
  const claimIsReal =
    claimActualityState.round2026ApplicationActuality === "REAL_SOURCE_READY";

  let resolution: HubRegistryDataResolution;
  try {
    const loaded = await loadConfiguredApplicationPayloadAny();
    const configuredPayload = loaded ? loaded.document : null;
    resolution = resolveActiveRegistryApplicationsDocument(claimActualityState, configuredPayload);
  } catch (error) {
    if (!claimIsReal) {
      return resolveActiveRegistryApplicationsDocument(claimActualityState, null);
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "fail-closed",
      document: null,
      documentV2: null,
      documentVersion: null,
      mode: "unavailable",
      selectionReason: message.includes("could not be read")
        ? "payload-not-configured"
        : "payload-malformed",
      activeSourceError: {
        code: message.includes("could not be read")
          ? "payload-not-configured"
          : "payload-malformed",
        message: `REAL_SOURCE_READY active source failed closed: ${message}`,
      },
    };
  }

  if (resolution.status !== "ok" || !resolution.documentV2) {
    return resolution;
  }

  try {
    const contentionActuality = await loadPromotedContentionActualityState();
    let sidecar: ContentionMembershipSnapshotV1 | null = null;
    try {
      sidecar = await loadConfiguredContentionSidecar();
    } catch {
      // Sidecar load failure disables overlay only — Application stays active.
      sidecar = null;
    }
    const documentV2 = bindContentionOverlayForActiveBrowserV2(resolution.documentV2, {
      contentionActuality,
      sidecar,
      applicationGraphContentSha256: resolution.documentV2.snapshotContentHash,
    });
    return { ...resolution, documentV2 };
  } catch {
    return {
      ...resolution,
      documentV2: bindContentionOverlayForActiveBrowserV2(resolution.documentV2, {
        contentionActuality: {
          round2026ContentionActuality: "NOT_PUBLISHED",
          snapshotId: null,
          sidecarContentHash: null,
          rawSha256: null,
          applicationPublicationPinHash: null,
        },
        sidecar: null,
        applicationGraphContentSha256: resolution.documentV2.snapshotContentHash,
      }),
    };
  }
}
