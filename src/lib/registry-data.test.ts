import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/data/fixtures/manifest.json";
import fixture from "@/data/fixtures/registry-applications.json";
import {
  buildApplicantsToWatch,
  buildBiggestChanges,
  buildCategoryMix,
  buildPortfolioRanking,
  buildRoundPulse,
} from "./registry-data";

describe("immutable registry fixture", () => {
  it("matches the declared snapshot hash and byte size", () => {
    const bytes = readFileSync(resolve("src/data/fixtures/registry-applications.json"));
    const declared = manifest.files[0];

    expect(bytes.byteLength).toBe(declared.size);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(declared.sha256);
    expect(manifest.immutable).toBe(true);
  });
});

describe("deterministic intelligence calculations", () => {
  it("produces stable Round Pulse values without converting missing fields to zero", () => {
    const metrics = Object.fromEntries(buildRoundPulse(fixture.applications).map((item) => [item.id, item.value]));

    expect(metrics).toEqual({
      applications: 12,
      strings: 10,
      organizations: 8,
      regions: 6,
      idn: 2,
      contention: 2,
    });
    expect(fixture.applications.filter((item) => item.replacement === null)).toHaveLength(10);
  });

  it("ranks equal portfolios by organization name for reproducibility", () => {
    const ranking = buildPortfolioRanking(fixture.applications);

    expect(ranking[0]).toMatchObject({ organization: "Atlas Digital", count: 3 });
    expect(ranking.slice(1, 3).map((item) => item.organization)).toEqual(["Kizuna Registry", "Northstar Group"]);
  });

  it("maintains complete category cohort coverage", () => {
    const mix = buildCategoryMix(fixture.applications);

    expect(mix.reduce((sum, item) => sum + item.count, 0)).toBe(fixture.applications.length);
    expect(mix[0]).toEqual({ category: "Technology", count: 4, percent: 33 });
  });

  it("ranks contextual changes by absolute movement against the fixture cohort", () => {
    const changes = buildBiggestChanges(fixture.applications);

    expect(changes[0]).toEqual({ category: "Identity", previous: 1, current: 3, change: 2 });
    expect(changes.map((item) => item.category)).toEqual([
      "Identity",
      "Technology",
      "Community",
      "Consumer",
      "Geographic",
      "Media",
    ]);
  });

  it("explains every applicant watch signal with transparent fixture rules", () => {
    const watched = buildApplicantsToWatch(fixture.applications);

    expect(watched.map((item) => item.organization)).toEqual(["Atlas Digital", "Kizuna Registry", "Northstar Group"]);
    expect(watched[0].reasons).toEqual(["3-application portfolio", "2 categories", "1 application in initial contention", "returning participant"]);
    expect(watched.every((item) => item.reasons.length > 0)).toBe(true);
  });
});
