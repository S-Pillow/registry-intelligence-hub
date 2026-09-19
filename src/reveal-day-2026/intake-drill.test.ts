import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fetchOne } from "../pipeline/pipeline";
import { evaluateApplicationActualityPromotion, readClaimActualityState } from "./claim-actuality";
import { loadPublicationSnapshotFromPath, runDryRunIngestion } from "./dry-run";
import { evaluateHumanApprovals } from "./human-approval";
import {
  buildCanonicalPublicationFromHandoff,
  DRILL_2026_SOURCE_ID,
  fetchDrillHandoff,
  resolveLatestManifestForHandoff,
} from "./intake";
import { PUBLICATION_SCHEMA_VERSION_V11 } from "./types";
import { validatePublicationSnapshot, validationFailed } from "./validate";

describe("2026 production intake drill (pipeline → canonical snapshot)", () => {
  const tempDirs: string[] = [];
  afterEach(async () => {
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
  });

  it("derives registry-2026-publication/1.1.0 from immutable raw bytes only", async () => {
    const pipelineRoot = await mkdtemp(join(tmpdir(), "pipeline-drill-"));
    tempDirs.push(pipelineRoot);
    const { entry } = await fetchOne(DRILL_2026_SOURCE_ID, { root: pipelineRoot, mode: "fixture" });
    expect(entry.outcome === "success" || entry.outcome === "duplicate-skip").toBe(true);

    const handoff = await fetchDrillHandoff(pipelineRoot);
    const manifest = await resolveLatestManifestForHandoff(pipelineRoot, handoff);
    const snapshot = await buildCanonicalPublicationFromHandoff(pipelineRoot, handoff, manifest, {
      publicationKind: "immutable-publication",
      snapshotId: "snap-drill-test",
      publishedAt: "2026-09-19T08:00:00Z",
      sourceName: "Drill",
      sourceUrl: manifest.url,
      evidenceClass: "synthetic-drill",
      limitations: ["test"],
      redirectChain: [],
    });

    expect(snapshot.schemaVersion).toBe(PUBLICATION_SCHEMA_VERSION_V11);
    expect(snapshot.lineage?.rawSha256).toBe(handoff.sha256);
    expect(snapshot.applications.length).toBe(100);
    const { issues } = validatePublicationSnapshot(snapshot, { enforceProductionRowBounds: true });
    expect(validationFailed(issues)).toBe(false);

    const diagnostics = runDryRunIngestion(snapshot);
    const promotion = evaluateApplicationActualityPromotion(
      snapshot,
      diagnostics,
      await readClaimActualityState(join(pipelineRoot, "missing-state.json")),
      evaluateHumanApprovals({ stewardApprovalId: "drill-steward", productApprovalId: "drill-product" }),
    );
    expect(promotion.ok).toBe(true);
  });

  it("loads committed drill fixture with lineage", async () => {
    const fixturePath = join(process.cwd(), "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json");
    const snapshot = await loadPublicationSnapshotFromPath(fixturePath);
    expect(snapshot.lineage?.rawSha256).toBeTruthy();
    expect(snapshot.publicationKind).toBe("immutable-publication");
    expect(snapshot.fixtureId).toBe("drill-2026-intake-v1");
  });
});
