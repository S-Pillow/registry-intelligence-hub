import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import rehearsalFixture from "@/data/fixtures/registry-applications.json";
import { approvedApplicationActualityPromotionFixture } from "@/lib/claim-actuality-browser-wiring.test";
import {
  buildBrowserApplicationPayloadFromPublication,
  resolveActiveRegistryApplicationsDocument,
} from "@/lib/registry-application-payload";
import {
  APPLICATION_PAYLOAD_JSON_ENV,
  parseApplicationPayloadJson,
} from "@/lib/registry-application-payload-server";
import { loadPublicationSnapshotFromPath } from "@/reveal-day-2026/dry-run";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";

const DRILL_PUBLICATION = join(
  process.cwd(),
  "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json",
);

describe("2026 application payload wiring (acceptance)", () => {
  it("rehearsal path unchanged when payload absent or claim not promoted", () => {
    const rehearsal = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);
    expect(rehearsal.mode).toBe("rehearsal");
    expect(rehearsal.document?.applications).toHaveLength(rehearsalFixture.applications.length);
    expect(rehearsal.document?.applications[0]?.id).toBe("APP-26001");
  });

  it("drill fixture produces 100 application rows distinct from 12-app rehearsal", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    expect(payload.applications).toHaveLength(100);
    expect(payload.applications[0]?.id).toBe("APP-91000");
    expect(payload.snapshotId).toBe("snap-drill-2026-intake-v1");
    expect(payload.payloadMode).toBe("promoted-2026");
  });

  it("activates promoted payload only when claim state matches snapshot id and content hash", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    if (!payload.snapshotContentHash) throw new Error("expected snapshot content hash on drill payload");
    const promoted = {
      ...approvedApplicationActualityPromotionFixture(),
      snapshotId: payload.snapshotId,
      snapshotContentHash: payload.snapshotContentHash,
    };

    const active = resolveActiveRegistryApplicationsDocument(promoted, payload);
    expect(active.mode).toBe("promoted-2026");
    expect(active.selectionReason).toBe("promoted-active");
    expect(active.document?.applications).toHaveLength(100);

    const hashMismatch = resolveActiveRegistryApplicationsDocument(
      { ...promoted, snapshotContentHash: "wrong" },
      payload,
    );
    expect(hashMismatch.status).toBe("fail-closed");
    expect(hashMismatch.mode).toBe("unavailable");
    expect(hashMismatch.selectionReason).toBe("content-hash-mismatch");
    expect(hashMismatch.document).toBeNull();
  });

  it("parses env-injected application payload JSON", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    const previous = process.env[APPLICATION_PAYLOAD_JSON_ENV];
    process.env[APPLICATION_PAYLOAD_JSON_ENV] = JSON.stringify(payload);
    try {
      const parsed = parseApplicationPayloadJson(process.env[APPLICATION_PAYLOAD_JSON_ENV]!);
      expect(parsed.snapshotId).toBe(payload.snapshotId);
      expect(parsed.applications.length).toBe(100);
    } finally {
      if (previous === undefined) delete process.env[APPLICATION_PAYLOAD_JSON_ENV];
      else process.env[APPLICATION_PAYLOAD_JSON_ENV] = previous;
    }
  });

  it("writes committed drill browser payload fixture for operator drills", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    const outPath = join(process.cwd(), "src/data/fixtures/drill-2026-registry-applications.payload.json");
    const onDisk = JSON.parse(await readFile(outPath, "utf8")) as typeof payload;
    expect(onDisk.snapshotId).toBe(payload.snapshotId);
    expect(onDisk.snapshotContentHash).toBe(payload.snapshotContentHash);
    expect(onDisk.applications.length).toBe(100);
    if (onDisk.snapshotContentHash !== payload.snapshotContentHash) {
      await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    }
  });
});
