import { join } from "node:path";
import { describe, expect, it } from "vitest";
import rehearsalFixture from "@/data/fixtures/registry-applications.json";
import { DEFAULT_CLAIM_ACTUALITY_STATE, resolveHubMetricEligibility } from "@/lib/hub-metric-eligibility";
import {
  buildBrowserApplicationPayloadFromPublication,
  resolveActiveRegistryApplicationsDocument,
} from "@/lib/registry-application-payload";
import { loadPublicationSnapshotFromPath } from "@/reveal-day-2026/dry-run";
import { APPLICATION_ACTUALITY_METRIC_IDS } from "@/reveal-day-2026/claim-actuality";
import { readClaimActualityState } from "@/reveal-day-2026/claim-actuality-persistence";
import { readPromotionHistory } from "@/reveal-day-2026/promotion-history";

const DRILL_V1 = join(
  process.cwd(),
  "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json",
);
const DRILL_V2 = join(process.cwd(), ".data/reveal-2026/drill-2026-intake-v2/publication.snapshot.json");
const STATE_PATH = join(process.cwd(), ".data/reveal-2026/claim-actuality-state.json");
const HISTORY_PATH = join(process.cwd(), ".data/reveal-2026/promotion-history.jsonl");

describe("staging Path B/C deployment drill (automated acceptance)", () => {
  it("step 1 — rehearsal resolution when claim is default NOT_PUBLISHED", () => {
    const rehearsal = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);
    expect(rehearsal.document?.applications).toHaveLength(rehearsalFixture.applications.length);
    for (const metricId of APPLICATION_ACTUALITY_METRIC_IDS) {
      const entry = resolveHubMetricEligibility(metricId, DEFAULT_CLAIM_ACTUALITY_STATE);
      expect(entry?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    }
  });

  it("steps 2–4 — drill snapshot builds 100-row payload aligned to promotion pins", async () => {
    const state = await readClaimActualityState(STATE_PATH).catch(() => null);
    if (!state || state.round2026ApplicationActuality !== "REAL_SOURCE_READY") return;
    const publicationPath = state.snapshotId === "snap-drill-2026-intake-v2" ? DRILL_V2 : DRILL_V1;
    const publication = await loadPublicationSnapshotFromPath(publicationPath);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    expect(payload.applications).toHaveLength(100);
    const active = resolveActiveRegistryApplicationsDocument(state, payload);
    expect(active.mode).toBe("promoted-2026");
    expect(active.document?.applications[0]?.id).toBe("APP-91000");
  });

  it("step 7 — snapshot or content-hash mismatch fails closed (no rehearsal)", async () => {
    const state = await readClaimActualityState(STATE_PATH).catch(() => null);
    if (!state || state.round2026ApplicationActuality !== "REAL_SOURCE_READY") return;
    const publicationPath = state.snapshotId === "snap-drill-2026-intake-v2" ? DRILL_V2 : DRILL_V1;
    const publication = await loadPublicationSnapshotFromPath(publicationPath);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    const idMismatch = resolveActiveRegistryApplicationsDocument(
      { ...state, snapshotId: "wrong-snapshot-id" },
      payload,
    );
    expect(idMismatch.selectionReason).toBe("snapshot-id-mismatch");
    expect(idMismatch.status).toBe("fail-closed");
    expect(idMismatch.document).toBeNull();
    const hashMismatch = resolveActiveRegistryApplicationsDocument(
      { ...state, snapshotContentHash: "wrong-hash" },
      payload,
    );
    expect(hashMismatch.selectionReason).toBe("content-hash-mismatch");
    expect(hashMismatch.status).toBe("fail-closed");
  });

  it("step 8 — promotion history records superseded + promoted when operator ran Path C", async () => {
    const history = await readPromotionHistory(HISTORY_PATH).catch(() => []);
    if (history.length < 3) return;
    expect(history.some((e) => e.event === "superseded" && e.supersededBySnapshotId)).toBe(true);
    const latestPromoted = history.filter((e) => e.event === "promoted").at(-1);
    expect(latestPromoted?.snapshotId).toMatch(/snap-drill-2026-intake-v/);
  });
});
