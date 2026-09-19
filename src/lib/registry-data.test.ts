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
  cellDiffersFromBaseline,
  type CompareRowLike,
  describeCompareSelection,
  describeExploreFilters,
  filterApplicationsByExplore,
  groupCompareRowsBySection,
  listEntityOptions,
  nonDefaultExploreFilterParams,
  numericCellDelta,
  recordsForEntity,
  rowHasDifference,
  summarizeCompareDifferences,
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
      applications: 1930,
      strings: 1409,
      organizations: 8,
      regions: 6,
      idn: 116,
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

describe("deterministic Compare differencing, grouping, and delta helpers", () => {
  const matchingRow: CompareRowLike = { label: "Regions", section: "round-activity", cells: [{ value: "Americas", entityLabel: "Atlas Digital" }, { value: "Americas", entityLabel: "Northstar Group" }] };
  const differingRow: CompareRowLike = { label: "2026 applications", section: "round-activity", cells: [{ value: 3, entityLabel: "Atlas Digital" }, { value: 5, entityLabel: "Northstar Group" }] };
  const stateDifferingRow: CompareRowLike = {
    label: "Historical market demand",
    section: "market-context",
    cells: [{ value: "Not available — source not approved", state: "unavailable", entityLabel: "Atlas Digital" }, { value: 42, entityLabel: "Northstar Group" }],
  };
  const bothUnavailableRow: CompareRowLike = {
    label: "Market demand",
    section: "market-context",
    cells: [{ value: "Not comparable", state: "not-comparable", entityLabel: "Atlas Digital" }, { value: "Not comparable", state: "not-comparable", entityLabel: "Northstar Group" }],
  };

  it("flags a row as differing only when a cell's state+value diverges from the first selection", () => {
    expect(rowHasDifference(matchingRow)).toBe(false);
    expect(rowHasDifference(differingRow)).toBe(true);
    expect(rowHasDifference(stateDifferingRow)).toBe(true);
    expect(rowHasDifference(bothUnavailableRow)).toBe(false);
    expect(rowHasDifference({ label: "Solo", section: "round-activity", cells: [{ value: 1 }] })).toBe(false);
  });

  it("never marks the baseline (first) cell as differing from itself", () => {
    expect(cellDiffersFromBaseline(differingRow.cells, 0)).toBe(false);
    expect(cellDiffersFromBaseline(differingRow.cells, 1)).toBe(true);
    expect(cellDiffersFromBaseline(matchingRow.cells, 1)).toBe(false);
  });

  it("computes a deterministic numeric delta versus the baseline selection only when both sides are numeric and unequal", () => {
    expect(numericCellDelta(differingRow.cells, 1)).toBe(2);
    expect(numericCellDelta(differingRow.cells, 0)).toBeNull();
    expect(numericCellDelta(matchingRow.cells, 1)).toBeNull();
    expect(numericCellDelta(stateDifferingRow.cells, 1)).toBeNull();
  });

  it("groups rows into the four scalable sections in a fixed, stable order", () => {
    const rows: CompareRowLike[] = [
      { label: "Market demand", section: "market-context", cells: [] },
      { label: "2026 applications", section: "round-activity", cells: [] },
      { label: "Categories", section: "existing-portfolio", cells: [] },
      { label: "Participation status", section: "historical-participation", cells: [] },
    ];
    const grouped = groupCompareRowsBySection(rows, "organizations");

    expect(grouped.map((group) => group.label)).toEqual([
      "Round Activity",
      "Historical Participation",
      "Existing Portfolio",
      "Market Context",
    ]);
    expect(grouped.every((group) => group.rows.length === 1)).toBe(true);
  });

  it("omits empty sections rather than rendering a heading with no dimensions", () => {
    const grouped = groupCompareRowsBySection([{ label: "2026 applications", section: "round-activity", cells: [] }], "organizations");
    expect(grouped).toHaveLength(1);
    expect(grouped[0].section).toBe("round-activity");
  });

  it("uses the same section ids, row assignment, and comparison engine across entity types but chooses semantically correct labels per type", () => {
    const rows: CompareRowLike[] = [
      { label: "2026 applications", section: "round-activity", cells: [] },
      { label: "Organizations", section: "existing-portfolio", cells: [] },
    ];

    const organizationLabels = groupCompareRowsBySection(rows, "organizations").map((group) => group.label);
    const applicationLabels = groupCompareRowsBySection(rows, "applications").map((group) => group.label);
    const categoryLabels = groupCompareRowsBySection(rows, "categories").map((group) => group.label);

    expect(organizationLabels).toEqual(["Round Activity", "Existing Portfolio"]);
    expect(applicationLabels).toEqual(["Application Details", "Application Context"]);
    expect(categoryLabels).toEqual(["Round Composition", "Category Footprint"]);
    // Same rows, same sections, same order — only the label text differs by entity type.
    expect(groupCompareRowsBySection(rows, "organizations").map((group) => group.section)).toEqual(
      groupCompareRowsBySection(rows, "categories").map((group) => group.section),
    );
  });

  it("summarizes key differences with ranked, evidence-neutral facts (numeric before availability-state) and meaningful shared dimensions, never any score or winner language", () => {
    const summary = summarizeCompareDifferences([matchingRow, differingRow, stateDifferingRow, bothUnavailableRow]);

    expect(summary.headline).toBe("2 of 4 dimensions differ across selections");
    expect(summary.differingLabels).toEqual(["2026 applications", "Historical market demand"]);
    // A real numeric comparison ranks ahead of a difference driven by one side simply lacking data.
    expect(summary.topFacts).toEqual([
      "2026 applications — Atlas Digital 3, Northstar Group 5",
      "Historical market demand — Atlas Digital unavailable, Northstar Group 42",
    ]);
    expect(summary.remainingFacts).toEqual([]);
    // "Regions" is a meaningful shared dimension (both sides have a real value); the two both-unavailable
    // rows are not reported as "matching" — an absence of data on both sides is not a shared fact.
    expect(summary.matchingLabels).toEqual(["Regions"]);
    expect(summary.matchingSentence).toBe("Selections match on Regions.");
    expect([...summary.topFacts, summary.matchingSentence].join(" ")).not.toMatch(/win|best|worst|lead|recommend|\bAI\b|\brank/i);
  });

  it("reports when every shown dimension matches, naming meaningful shared dimensions and excluding shared-absence rows", () => {
    const summary = summarizeCompareDifferences([matchingRow, bothUnavailableRow]);
    expect(summary.headline).toBe("All 2 dimensions match across selections");
    expect(summary.differingLabels).toEqual([]);
    expect(summary.topFacts).toEqual([]);
    expect(summary.matchingLabels).toEqual(["Regions"]);
    expect(summary.matchingSentence).toContain("including Regions");
  });

  it("caps the initial findings at a concise, deterministic set and reveals the rest as remainingFacts for a 'View all' affordance", () => {
    const manyDiffering: CompareRowLike[] = Array.from({ length: 6 }, (_, index) => ({
      label: `Dimension ${index + 1}`,
      section: "round-activity" as const,
      cells: [{ value: index, entityLabel: "Atlas Digital" }, { value: index + 1, entityLabel: "Northstar Group" }],
    }));
    const summary = summarizeCompareDifferences(manyDiffering);

    expect(summary.headline).toBe("6 of 6 dimensions differ across selections");
    expect(summary.topFacts).toEqual([
      "Dimension 1 — Atlas Digital 0, Northstar Group 1",
      "Dimension 2 — Atlas Digital 1, Northstar Group 2",
      "Dimension 3 — Atlas Digital 2, Northstar Group 3",
      "Dimension 4 — Atlas Digital 3, Northstar Group 4",
    ]);
    expect(summary.remainingFacts).toEqual([
      "Dimension 5 — Atlas Digital 4, Northstar Group 5",
      "Dimension 6 — Atlas Digital 5, Northstar Group 6",
    ]);
    expect(summary.topFacts.length + summary.remainingFacts.length).toBe(summary.differingLabels.length);
  });

  it("scales down cleanly to a single finding for a two-entity, single-difference comparison (no 'View all' needed)", () => {
    const summary = summarizeCompareDifferences([matchingRow, differingRow]);
    expect(summary.topFacts).toEqual(["2026 applications — Atlas Digital 3, Northstar Group 5"]);
    expect(summary.remainingFacts).toEqual([]);
  });
});
