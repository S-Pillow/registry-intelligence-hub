import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { approvedApplicationActualityPromotionFixture } from "@/lib/claim-actuality-browser-wiring.test";
import {
  buildBrowserApplicationPayloadFromPublication,
  resolveActiveRegistryApplicationsDocument,
} from "@/lib/registry-application-payload";
import { loadPublicationSnapshotFromPath } from "@/reveal-day-2026/dry-run";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import {
  buildDataHealthSnapshot,
  humanizePayloadSelectionReason,
  OFFLINE_2012_TAXONOMY_CLASSIFIED,
} from "@/lib/data-health-report";

const DRILL_PUBLICATION = join(
  process.cwd(),
  "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json",
);

describe("data-health-report", () => {
  it("reflects approved 2012 aggregates, rehearsal browser payload, and NOT_PUBLISHED 2026", () => {
    const rehearsalResolution = resolveActiveRegistryApplicationsDocument(
      DEFAULT_CLAIM_ACTUALITY_STATE,
      null,
    );
    const snapshot = buildDataHealthSnapshot(DEFAULT_CLAIM_ACTUALITY_STATE, rehearsalResolution);

    expect(snapshot.browserDataState.approved2012Aggregates).toEqual({
      applications: 1930,
      uniqueStrings: 1409,
      idnApplications: 116,
    });
    expect(snapshot.browserDataState.entityLevel2012InBrowser).toBe(false);
    expect(snapshot.browserDataState.browserEntityDataset).toMatch(/withheld from the default product surface/i);
    expect(snapshot.publicationReadiness.round2026ApplicationActuality).toBe("NOT_PUBLISHED");
    expect(snapshot.browserDataState.real2026Publication).toMatch(/Not published/i);
    expect(snapshot.currentStateSummary.find((r) => r.id === "browser-mode")?.primary).toMatch(
      /Rehearsal payload/i,
    );
    const aggregates = snapshot.currentStateSummary.find((r) => r.id === "2012-aggregates");
    expect(aggregates?.badgeLabel).toBe("Ready");
    expect(aggregates?.tone).toBe("ready");
    expect(aggregates?.primary).toMatch(/1930/);

    const entityBrowser = snapshot.currentStateSummary.find((r) => r.id === "2012-entity-browser");
    expect(entityBrowser?.badgeLabel).toBe("Not loaded");
    expect(entityBrowser?.tone).not.toBe("blocked");

    const crossRound = snapshot.currentStateSummary.find((r) => r.id === "cross-round");
    expect(crossRound?.badgeLabel).toBe("Gated");
    expect(crossRound?.tone).not.toBe("partial");

    expect(snapshot.publicationReadiness.checklist.find((c) => c.id === "actuality")?.status).toBe("pending");
  });

  it("keeps blocked method and coverage metrics gated in intelligence readiness", () => {
    const rehearsalResolution = resolveActiveRegistryApplicationsDocument(
      DEFAULT_CLAIM_ACTUALITY_STATE,
      null,
    );
    const snapshot = buildDataHealthSnapshot(DEFAULT_CLAIM_ACTUALITY_STATE, rehearsalResolution);
    const contention = snapshot.intelligenceReadiness.find((r) => r.metricId === "contention-set-count");
    const categoryMix = snapshot.intelligenceReadiness.find((r) => r.metricId === "category-mix");
    const orgCount = snapshot.intelligenceReadiness.find((r) => r.metricId === "organization-round-count");

    expect(contention?.methodReadiness).toBe("BLOCKED_METHOD");
    expect(contention?.comparisonAllowed).toBe(false);
    expect(categoryMix?.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(orgCount?.methodReadiness).toBe("BLOCKED_SOURCE");

    const comparable = snapshot.intelligenceReadiness.filter((r) => r.methodReadiness === "COMPARABLE");
    expect(comparable.every((r) => r.comparisonAllowed === false)).toBe(true);
    expect(comparable.every((r) => r.round2026 === "NOT_PUBLISHED")).toBe(true);
  });

  it("documents Ticket B coverage facts in limitations", () => {
    const snapshot = buildDataHealthSnapshot(
      DEFAULT_CLAIM_ACTUALITY_STATE,
      resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null),
    );
    const joined = snapshot.coverageLimitations.join(" ");
    expect(joined).toContain("1930");
    expect(joined).toContain(`${OFFLINE_2012_TAXONOMY_CLASSIFIED}/1930`);
    expect(joined).toContain("754");
    expect(joined).toContain("234");
    expect(joined).toContain("232");
  });

  it("matches taxonomy fixture classified count", async () => {
    const taxonomyPath = join(
      import.meta.dirname,
      "../normalization/fixtures/icann2012-reveal-day-v1/application-taxonomy.json",
    );
    const raw = JSON.parse(await readFile(taxonomyPath, "utf8")) as {
      records: { reviewState: string }[];
    };
    const classified = raw.records.filter((a) => a.reviewState !== "unclassified").length;
    expect(classified).toBe(OFFLINE_2012_TAXONOMY_CLASSIFIED);
    expect(classified + (APPROVED_2012_BASELINE.applications - classified)).toBe(1930);
  });

  it("promoted claim with matching drill payload surfaces promoted browser mode and unlock checklist", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    if (!payload.snapshotContentHash) throw new Error("expected drill content hash");
    const promoted = {
      ...approvedApplicationActualityPromotionFixture(),
      snapshotId: payload.snapshotId,
      snapshotContentHash: payload.snapshotContentHash,
    };
    const resolution = resolveActiveRegistryApplicationsDocument(promoted, payload);
    expect(resolution.mode).toBe("promoted-2026");
    expect(resolution.selectionReason).toBe("promoted-active");

    const snapshot = buildDataHealthSnapshot(promoted, resolution);
    expect(snapshot.browserDataState.browserEntityDataset).toMatch(/100-record/);
    expect(snapshot.currentStateSummary.find((r) => r.id === "browser-mode")?.primary).toMatch(
      /Promoted 2026/i,
    );
    expect(snapshot.publicationReadiness.checklist.find((c) => c.id === "browser-payload")?.status).toBe(
      "complete",
    );

    const comparable = snapshot.intelligenceReadiness.filter((r) => r.methodReadiness === "COMPARABLE");
    expect(comparable.some((r) => r.comparisonAllowed)).toBe(true);
    expect(comparable.some((r) => r.round2026 === "REAL_SOURCE_READY")).toBe(true);

    const crossRound = snapshot.currentStateSummary.find((r) => r.id === "cross-round");
    expect(crossRound?.badgeLabel).toBeUndefined();
    expect(crossRound?.tone).toBe("ready");
  });

  it("mismatched promotion pins fail closed to rehearsal in snapshot resolution inputs", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    if (!payload.snapshotContentHash) throw new Error("expected drill content hash");
    const promoted = {
      ...approvedApplicationActualityPromotionFixture(),
      snapshotId: payload.snapshotId,
      snapshotContentHash: payload.snapshotContentHash,
    };

    const hashMismatch = resolveActiveRegistryApplicationsDocument(
      { ...promoted, snapshotContentHash: "wrong-hash" },
      payload,
    );
    expect(hashMismatch.status).toBe("fail-closed");
    expect(hashMismatch.mode).toBe("unavailable");
    expect(hashMismatch.selectionReason).toBe("content-hash-mismatch");
    expect(humanizePayloadSelectionReason(hashMismatch.selectionReason)).toMatch(/fail-closed \(no rehearsal\)/i);

    const snapshot = buildDataHealthSnapshot(promoted, hashMismatch);
    expect(snapshot.browserDataState.browserEntityDataset).toMatch(/fail-closed/i);
    expect(snapshot.publicationReadiness.checklist.find((c) => c.id === "browser-payload")?.status).toBe(
      "warning",
    );
    expect(snapshot.currentStateSummary.find((r) => r.id === "browser-mode")?.primary).toMatch(
      /unavailable|fail-closed/i,
    );
  });

  it("marks 2012 entity browser loaded when historical payload resolves", async () => {
    const text = await readFile(
      join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"),
      "utf8",
    );
    const document = parse2012ApplicationPayloadJson(text);
    const historical2012 = resolveHistorical2012BrowserPayload(
      document,
      APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    );
    expect(historical2012.status).toBe("loaded");

    const rehearsalResolution = resolveActiveRegistryApplicationsDocument(
      DEFAULT_CLAIM_ACTUALITY_STATE,
      null,
    );
    const snapshot = buildDataHealthSnapshot(
      DEFAULT_CLAIM_ACTUALITY_STATE,
      rehearsalResolution,
      historical2012,
    );
    expect(snapshot.browserDataState.entityLevel2012InBrowser).toBe(true);
    expect(snapshot.browserDataState.historical2012CorpusHash).toBe(APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
    expect(snapshot.currentStateSummary.find((r) => r.id === "2012-entity-browser")?.badgeLabel).toBe("Loaded");
    expect(snapshot.publicationReadiness.checklist.find((c) => c.id === "entity-2012")?.status).toBe("complete");
    expect(snapshot.browserDataState.browserEntityDataset).toMatch(/withheld from the default product surface/i);
  });
});
