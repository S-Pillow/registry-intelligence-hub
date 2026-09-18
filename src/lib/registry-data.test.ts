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
  describeCompareSelection,
  describeExploreFilters,
  filterApplicationsByExplore,
  listEntityOptions,
  nonDefaultExploreFilterParams,
  recordsForEntity,
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

const emptyExploreFilters = { q: "", category: "all", region: "all", status: "all", contention: "all", idn: "all", ids: "" };

describe("shared entity and Explore filter helpers used by Saved Research and Watchlists", () => {
  it("resolves supporting records for each entity type consistently", () => {
    expect(recordsForEntity("applications", "APP-26001", fixture.applications)).toHaveLength(1);
    expect(recordsForEntity("organizations", "Atlas Digital", fixture.applications)).toHaveLength(3);
    expect(recordsForEntity("categories", "Technology", fixture.applications)).toHaveLength(4);
    expect(recordsForEntity("organizations", "Nonexistent", fixture.applications)).toHaveLength(0);
  });

  it("lists sorted, deduplicated entity options with their supporting records", () => {
    const organizations = listEntityOptions("organizations", fixture.applications);

    expect(organizations.map((item) => item.key)).toEqual([...organizations.map((item) => item.key)].sort());
    expect(new Set(organizations.map((item) => item.key)).size).toBe(organizations.length);
    expect(organizations.find((item) => item.key === "Atlas Digital")?.records).toHaveLength(3);
  });

  it("filters applications identically to the Explore view for reuse in Saved Research", () => {
    const idnOnly = filterApplicationsByExplore(fixture.applications, { ...emptyExploreFilters, idn: "idn" });
    expect(idnOnly).toHaveLength(2);

    const noMatches = filterApplicationsByExplore(fixture.applications, { ...emptyExploreFilters, q: "no-such-record" });
    expect(noMatches).toHaveLength(0);
  });

  it("describes the default Explore state plainly and named filters explicitly", () => {
    expect(describeExploreFilters({ entity: "applications", category: "all", region: "all", status: "all", contention: "all", idn: "all", sort: "applications-desc" }))
      .toBe("All applications, no filters applied");

    expect(describeExploreFilters({ entity: "organizations", category: "Identity", region: "all", status: "returning", contention: "all", idn: "all", sort: "applications-desc" }))
      .toBe("Browse by organizations · Identity category · Returning only");
  });

  it("excludes default values but keeps explicit search and selection state in saved params", () => {
    const params = nonDefaultExploreFilterParams({ q: "atlas", entity: "applications", category: "all", region: "Europe", status: "all", contention: "all", idn: "all", sort: "applications-desc", ids: "" });

    expect(params).toEqual({ q: "atlas", region: "Europe" });
  });

  it("describes a Compare selection with the correct singular/plural entity noun", () => {
    expect(describeCompareSelection("organizations", ["Atlas Digital"])).toBe("Compare 1 organization: Atlas Digital");
    expect(describeCompareSelection("categories", ["Technology", "Identity"])).toBe("Compare 2 categories: Technology, Identity");
  });
});
