import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import {
  exploreFiltersFor2012Historical,
  filterHistorical2012StringAggregates,
  formatHistorical2012StringAggregateResultsSummary,
  underlyingApplicationsInHistorical2012StringAggregates,
} from "@/historical-2012/explore-historical-table";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { filterApplicationsByExplore, type ExploreFilterState } from "@/lib/registry-data";

const payload = parse2012ApplicationPayloadJson(
  readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
);

const contentionApplicationFilters: ExploreFilterState = exploreFiltersFor2012Historical({
  q: "",
  category: "all",
  region: "all",
  status: "all",
  contention: "in",
  idn: "all",
  ids: "",
  entity: "applications",
});

describe("2012 historical contention application handoff (D2.3)", () => {
  it("filters exactly 754 contention applications with membership on every row", () => {
    const rows = filterApplicationsByExplore(payload.applications, contentionApplicationFilters);
    expect(rows).toHaveLength(APPROVED_2012_BASELINE.contentionMembershipApplications);
    expect(rows.every((row) => row.contentionSet)).toBe(true);
    expect(rows.some((row) => !row.contentionSet)).toBe(false);
  });

  it("preserves contention filter at strings grain (235 strings / 755 total apps in matched strings)", () => {
    const stringFilters = exploreFiltersFor2012Historical(
      { ...contentionApplicationFilters, entity: "strings" },
      { browseEntity: "strings" },
    );
    const stringRows = filterHistorical2012StringAggregates(payload.applications, stringFilters);
    expect(stringRows).toHaveLength(235);
    expect(underlyingApplicationsInHistorical2012StringAggregates(stringRows)).toBe(755);
    expect(formatHistorical2012StringAggregateResultsSummary(235, 755)).toBe(
      "235 strings results · 755 total applications in matched strings",
    );

    const gmbh = stringRows.find((row) => row.stringKey === "GMBH");
    expect(gmbh).toBeDefined();
    expect(gmbh!.records.some((record) => !record.contentionSet)).toBe(true);
    expect(gmbh!.records.some((record) => record.contentionSet)).toBe(true);
  });
});
