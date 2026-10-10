import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/data/fixtures/manifest.json";
import fixture from "@/data/fixtures/registry-applications.json";
import {
  buildApplicantLegalNameConcentration,
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
  exploreDrillDownHref,
  exploreEntityResearchHref,
  exploreFullHrefForInvestigation,
  exploreHistorical2012ApplicationsHref,
  exploreHistorical2012ContentionApplicationsHref,
  exploreHistorical2012IdnApplicationsHref,
  exploreHistorical2012StringsHref,
  exploreResearchHref,
  exploreSavedResearchParams,
  roundPulseHistoricalCardExploreHref,
  roundPulseHistoricalAggregateBand,
  roundPulseSupportingRecords,
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

describe("Round Pulse supporting records", () => {
  it("returns no rehearsal rows for approved 2012 historical aggregate cards", () => {
    const pulse = buildRoundPulse(fixture.applications);
    const historical = pulse.filter((metric) => metric.historicalFact);
    expect(historical.map((m) => m.id).sort()).toEqual(["applications", "contention", "idn", "strings"]);
    for (const metric of historical) {
      expect(roundPulseSupportingRecords(metric)).toEqual([]);
    }
    const rehearsal = pulse.find((m) => m.id === "organizations");
    expect(roundPulseSupportingRecords(rehearsal!)).toHaveLength(fixture.applications.length);
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
      contention: 754,
    });
    expect(fixture.applications.filter((item) => item.replacement === null)).toHaveLength(10);
  });

  it("ranks applicant legal names independently of resolved organization", () => {
    const concentration = buildApplicantLegalNameConcentration(fixture.applications);
    expect(concentration.eligibleApplicationCount).toBe(fixture.applications.length);
    expect(concentration.distinctApplicantLegalNames).toBe(8);
    expect(concentration.ranked.map((item) => [item.applicantLegalName, item.count])).toEqual([
      ["Atlas Digital Registry LLC", 3],
      ["Kizuna Registry KK", 2],
      ["Northstar Naming Inc.", 2],
      ["Future MENA Domains FZ-LLC", 1],
      ["Harbor Brands GmbH", 1],
      ["Sentinel Public Benefit Corp.", 1],
      ["Terra Geographic Association", 1],
      ["Verde Community Cooperative", 1],
    ]);
    expect(concentration.ranked[0].shareDenominator).toBe(12);
    expect(concentration.ranked.some((item) => item.applicantLegalName === "Atlas Digital")).toBe(false);
  });

  it("keeps distinct legal names distinct and breaks ties by legal-name text", () => {
    const base = fixture.applications[0];
    const rows = [
      { ...base, id: "a", applicant: "Beta Legal Inc.", organization: "Same Org" },
      { ...base, id: "b", applicant: "Alpha Legal LLC", organization: "Same Org" },
      { ...base, id: "c", applicant: "Beta Legal Inc.", organization: "Same Org" },
      { ...base, id: "d", applicant: "Alpha Legal LLC", organization: "Same Org" },
      { ...base, id: "e", applicant: "alpha legal llc", organization: "Same Org" },
      { ...base, id: "f", applicant: "  Alpha Legal LLC  ", organization: "Other Org" },
      { ...base, id: "g", applicant: "   ", organization: "Blank Org" },
    ];
    const first = buildApplicantLegalNameConcentration(rows);
    const second = buildApplicantLegalNameConcentration([...rows].reverse());
    expect(first.ranked.map((item) => [item.applicantLegalName, item.count])).toEqual([
      ["Alpha Legal LLC", 3],
      ["Beta Legal Inc.", 2],
      ["alpha legal llc", 1],
    ]);
    expect(second.ranked).toEqual(first.ranked);
    expect(first.eligibleApplicationCount).toBe(6);
    expect(first.datasetApplicationCount).toBe(7);
    expect(first.ranked.every((item) => item.shareDenominator === 6)).toBe(true);
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
    expect(watched[0].reasons).toEqual([
      "3 loaded applications",
      "2 category labels on the loaded snapshot",
      "1 application with a contention-set label",
      "returning flag on the loaded snapshot",
    ]);
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

describe("exploreResearchHref", () => {
  it("builds Explore URLs with optional query text", () => {
    expect(exploreResearchHref("")).toBe("/explore");
    expect(exploreResearchHref("  Atlas  ")).toBe("/explore?q=Atlas");
  });
});

describe("exploreDrillDownHref", () => {
  it("maps Round Pulse filters to composable Explore params", () => {
    expect(exploreDrillDownHref("all")).toBe("/explore");
    expect(exploreDrillDownHref("idn")).toBe("/explore?idn=idn");
    expect(exploreDrillDownHref("contention")).toBe("/explore?contention=in");
    expect(exploreDrillDownHref("strings")).toBe("/explore?entity=strings");
    expect(exploreDrillDownHref("organizations")).toBe("/explore?entity=organizations");
  });
});

describe("exploreHistorical2012ApplicationsHref (D2.0)", () => {
  it("preserves dataset=2012-historical for general and application-corpus handoffs", () => {
    expect(exploreHistorical2012ApplicationsHref()).toBe("/explore?dataset=2012-historical");
    expect(exploreHistorical2012ApplicationsHref({ entityApplications: true })).toBe(
      "/explore?dataset=2012-historical&entity=applications",
    );
  });
});

describe("exploreHistorical2012StringsHref (D2.1)", () => {
  it("opens historical string browse mode", () => {
    expect(exploreHistorical2012StringsHref()).toBe("/explore?dataset=2012-historical&entity=strings");
  });
});

describe("exploreHistorical2012IdnApplicationsHref (D2.2)", () => {
  it("opens historical application browse with canonical IDN filter", () => {
    expect(exploreHistorical2012IdnApplicationsHref()).toBe(
      "/explore?dataset=2012-historical&entity=applications&idn=idn",
    );
  });
});

describe("exploreHistorical2012ContentionApplicationsHref (D2.3)", () => {
  it("opens historical application browse with canonical contention filter", () => {
    expect(exploreHistorical2012ContentionApplicationsHref()).toBe(
      "/explore?dataset=2012-historical&entity=applications&contention=in",
    );
  });
});

describe("roundPulseHistoricalAggregateBand (D2.3 closeout)", () => {
  it("uses membership round label for contention — not Reveal Day aggregate band", () => {
    expect(roundPulseHistoricalAggregateBand("contention-membership-exposure")).toBe(
      "Historical membership · 2012 round",
    );
    expect(roundPulseHistoricalAggregateBand("application-count")).toBe("Historical aggregate · 2012 Reveal Day");
    expect(roundPulseHistoricalAggregateBand("idn-applications")).toBe("Historical aggregate · 2012 Reveal Day");
  });
});

describe("roundPulseHistoricalCardExploreHref (D2.0 / D2.1)", () => {
  it("returns application corpus href only when payload is loaded", () => {
    expect(roundPulseHistoricalCardExploreHref("application-count", false)).toBeNull();
    expect(roundPulseHistoricalCardExploreHref("application-count", true)).toContain("dataset=2012-historical");
    expect(roundPulseHistoricalCardExploreHref("application-count", true)).toContain("entity=applications");
  });

  it("returns string corpus href for unique-applied-strings when loaded", () => {
    expect(roundPulseHistoricalCardExploreHref("unique-applied-strings", true)).toBe(
      "/explore?dataset=2012-historical&entity=strings",
    );
  });

  it("returns IDN application browse href when payload is loaded (D2.2)", () => {
    expect(roundPulseHistoricalCardExploreHref("idn-applications", false)).toBeNull();
    expect(roundPulseHistoricalCardExploreHref("idn-applications", true)).toBe(
      exploreHistorical2012IdnApplicationsHref(),
    );
  });

  it("returns contention application browse href when payload is loaded (D2.3)", () => {
    expect(roundPulseHistoricalCardExploreHref("contention-membership-exposure", false)).toBeNull();
    expect(roundPulseHistoricalCardExploreHref("contention-membership-exposure", true)).toBe(
      exploreHistorical2012ContentionApplicationsHref(),
    );
  });
});

describe("exploreSavedResearchParams (D2.1)", () => {
  it("preserves dataset and strings browse mode in saved params", () => {
    expect(
      exploreSavedResearchParams(
        { entity: "strings", category: "all", region: "all", status: "all", contention: "all", idn: "all", sort: "applications-desc", q: "", ids: "" },
        { dataset: "2012-historical" },
      ),
    ).toEqual({ entity: "strings", dataset: "2012-historical" });
  });
});

describe("exploreEntityResearchHref", () => {
  it("builds entity-scoped Explore destinations", () => {
    expect(exploreEntityResearchHref("categories", "Technology")).toBe(
      "/explore?entity=categories&q=Technology",
    );
    expect(exploreEntityResearchHref("applications", "APP-26001")).toBe(
      "/explore?entity=applications&ids=APP-26001",
    );
  });
});

describe("exploreFullHrefForInvestigation", () => {
  it("routes entity, multi-record, and override destinations for the intelligence drawer", () => {
    expect(exploreFullHrefForInvestigation({
      entityType: "organizations",
      entityKey: "Atlas Digital",
      records: [],
    })).toBe("/explore?entity=organizations&q=Atlas+Digital");

    expect(exploreFullHrefForInvestigation({
      records: fixture.applications.slice(0, 2),
    })).toContain("ids=");

    expect(exploreFullHrefForInvestigation({
      records: [],
      exploreFullHref: "/explore?idn=idn",
    })).toBe("/explore?idn=idn");

    expect(exploreFullHrefForInvestigation({
      entityType: "applications",
      entityKey: "1-1386-27446",
      records: [],
      exploreDataset: "2012-historical",
    })).toContain("dataset=2012-historical");

    const template = fixture.applications[0];
    const appRecords = [
      { ...template, string: "APP", id: "1-test-a" },
      { ...template, string: "APP", id: "1-test-b" },
    ];
    expect(exploreFullHrefForInvestigation({
      records: appRecords,
      exploreDataset: "2012-historical",
    })).toBe("/explore?dataset=2012-historical&entity=strings&q=APP");
  });
});
