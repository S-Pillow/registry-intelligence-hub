import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isBrowserApplicationPayloadDocumentV2,
  type BrowserApplicationV2,
  type RegistryApplicationsDocumentV2,
} from "@/lib/registry-applications-document-v2";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import {
  loadContentionMembershipFromPath,
  loadPublicationV2FromPath,
} from "@/reveal-day-2026/promotion-contract-2x-io";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import { CONTENTION_MEMBERSHIP_SCHEMA_VERSION } from "@/reveal-day-2026/contention-membership-types";
import { buildObservationFromBrowserDocument } from "@/change-intel/observation";
import { persistBootstrap, readIndex } from "@/change-intel/state-io";
import type { ChangeIntelFeed, ChangeIntelIndex, ChangeIntelObservation } from "@/change-intel/types";

export type BootstrapResult =
  | { status: "initialized"; observation: ChangeIntelObservation; index: ChangeIntelIndex; feed: ChangeIntelFeed }
  | { status: "already-initialized"; index: ChangeIntelIndex };

function joinContentionOntoBrowser(
  document: RegistryApplicationsDocumentV2,
  sidecar: ContentionMembershipSnapshotV1,
): RegistryApplicationsDocumentV2 {
  const byApp = new Map<string, string[]>();
  for (const set of sidecar.contentionSets) {
    for (const member of set.members) {
      const list = byApp.get(member.applicationId) ?? [];
      list.push(set.officialContentionSetId);
      byApp.set(member.applicationId, list);
    }
  }
  const applications: BrowserApplicationV2[] = document.applications.map((app) => {
    const sets = byApp.get(app.applicationId) ?? [];
    return {
      ...app,
      officialContention: sets.length
        ? {
            membershipPresent: true,
            officialContentionSetIds: [...sets].sort((a, b) => a.localeCompare(b)),
            terminology: "official-initial-contention",
          }
        : {
            membershipPresent: false,
            officialContentionSetIds: [],
            terminology: "official-initial-contention",
          },
    };
  });
  const memberships = sidecar.quality.joinedMemberCount;
  return {
    ...document,
    applications,
    contentionOverlay: {
      status: "available",
      schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
      snapshotId: sidecar.snapshotId,
      sidecarContentSha256: sidecar.bundleManifest.sidecarContentSha256,
      rawSha256: sidecar.lineage.rawSha256,
      applicationPublicationPinHash: sidecar.applicationPublicationPin.applicationGraphContentSha256,
      officialContentionSetCount: sidecar.quality.officialContentionSetCount,
      joinedMemberCount: memberships,
    },
  };
}

export async function bootstrapChangeIntel(input?: {
  cwd?: string;
  browserPayloadPath?: string;
  publicationPath?: string;
  contentionPath?: string;
  observedAt?: string;
}): Promise<BootstrapResult> {
  const cwd = input?.cwd ?? process.cwd();
  const existing = await readIndex(cwd);
  if (existing?.currentObservationId) {
    return { status: "already-initialized", index: existing };
  }

  const browserPath =
    input?.browserPayloadPath
    ?? join(cwd, ".data/reveal-2026/browser/applications-browser-v2.json");
  const publicationPath =
    input?.publicationPath
    ?? join(cwd, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
  const contentionPath =
    input?.contentionPath
    ?? join(cwd, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json");

  let document: RegistryApplicationsDocumentV2 | undefined;
  try {
    const raw = JSON.parse(await readFile(browserPath, "utf8")) as unknown;
    if (isBrowserApplicationPayloadDocumentV2(raw) && raw.applications.length > 0) {
      document = raw;
    }
  } catch {
    document = undefined;
  }

  if (!document) {
    const publication = await loadPublicationV2FromPath(publicationPath);
    document = buildBrowserApplicationPayloadFromPublicationV2(publication);
  }

  if (document.contentionOverlay.status !== "available") {
    try {
      const contention = await loadContentionMembershipFromPath(contentionPath);
      document = joinContentionOntoBrowser(document, contention);
    } catch {
      // Application baseline can still initialize without contention overlay.
    }
  }

  const observation = buildObservationFromBrowserDocument({
    document,
    observedAt: input?.observedAt,
    previousObservationId: null,
    bootstrap: true,
  });
  const { index, feed } = await persistBootstrap({ observation, cwd });
  return { status: "initialized", observation, index, feed };
}
