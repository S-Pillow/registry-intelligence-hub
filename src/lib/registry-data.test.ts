import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/data/fixtures/manifest.json";
import fixture from "@/data/fixtures/registry-applications.json";
import { buildCategoryMix, buildPortfolioRanking, buildRoundPulse } from "./registry-data";

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
});
