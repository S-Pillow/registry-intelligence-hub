import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { rehearsalRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import {
  buildDataHealthSnapshot,
  OFFLINE_2012_TAXONOMY_CLASSIFIED,
} from "@/lib/data-health-report";

describe("data-health-report", () => {
  const defaultResolution = {
    document: rehearsalRegistryApplicationsDocument(),
    mode: "rehearsal" as const,
    selectionReason: "rehearsal-default" as const,
  };

  it("reflects approved 2012 aggregates, rehearsal browser payload, and NOT_PUBLISHED 2026", () => {
    const snapshot = buildDataHealthSnapshot(DEFAULT_CLAIM_ACTUALITY_STATE, defaultResolution);

    expect(snapshot.browserDataState.approved2012Aggregates).toEqual({
      applications: 1930,
      uniqueStrings: 1409,
      idnApplications: 116,
    });
    expect(snapshot.browserDataState.entityLevel2012InBrowser).toBe(false);
    expect(snapshot.browserDataState.browserEntityDataset).toMatch(/12-record/);
    expect(snapshot.publicationReadiness.round2026ApplicationActuality).toBe("NOT_PUBLISHED");
    expect(snapshot.browserDataState.real2026Publication).toMatch(/Not published/i);
  });

  it("keeps blocked method and coverage metrics gated in intelligence readiness", () => {
    const snapshot = buildDataHealthSnapshot(DEFAULT_CLAIM_ACTUALITY_STATE, defaultResolution);
    const contention = snapshot.intelligenceReadiness.find((r) => r.metricId === "contention-set-count");
    const categoryMix = snapshot.intelligenceReadiness.find((r) => r.metricId === "category-mix");
    const orgCount = snapshot.intelligenceReadiness.find((r) => r.metricId === "organization-round-count");

    expect(contention?.methodReadiness).toBe("BLOCKED_METHOD");
    expect(contention?.comparisonAllowed).toBe(false);
    expect(categoryMix?.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(orgCount?.methodReadiness).toBe("BLOCKED_COVERAGE");

    const comparable = snapshot.intelligenceReadiness.filter((r) => r.methodReadiness === "COMPARABLE");
    expect(comparable.every((r) => r.comparisonAllowed === false)).toBe(true);
    expect(comparable.every((r) => r.round2026 === "NOT_PUBLISHED")).toBe(true);
  });

  it("documents Ticket B coverage facts in limitations", () => {
    const snapshot = buildDataHealthSnapshot(DEFAULT_CLAIM_ACTUALITY_STATE, defaultResolution);
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
});
