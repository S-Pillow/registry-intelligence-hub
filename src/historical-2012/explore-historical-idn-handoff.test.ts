import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import {
  exploreFiltersFor2012Historical,
  filterHistorical2012StringAggregates,
  underlyingApplicationsInHistorical2012StringAggregates,
} from "@/historical-2012/explore-historical-table";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { filterApplicationsByExplore, type ExploreFilterState } from "@/lib/registry-data";

const payload = parse2012ApplicationPayloadJson(
  readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
);

const idnApplicationFilters: ExploreFilterState = exploreFiltersFor2012Historical({
  q: "",
  category: "all",
  region: "all",
  status: "all",
  contention: "all",
  idn: "idn",
  ids: "",
  entity: "applications",
});

describe("2012 historical IDN application handoff (D2.2)", () => {
  it("filters exactly 116 IDN applications with no non-IDN rows", () => {
    const rows = filterApplicationsByExplore(payload.applications, idnApplicationFilters);
    expect(rows).toHaveLength(APPROVED_2012_BASELINE.idnApplications);
    expect(rows.every((row) => row.idn)).toBe(true);
    expect(rows.some((row) => !row.idn)).toBe(false);
  });

  it("preserves IDN filter when switching aggregate grain to strings (109 strings / 116 apps)", () => {
    const stringFilters = exploreFiltersFor2012Historical(
      { ...idnApplicationFilters, entity: "strings" },
      { browseEntity: "strings" },
    );
    const stringRows = filterHistorical2012StringAggregates(payload.applications, stringFilters);
    expect(stringRows).toHaveLength(109);
    expect(underlyingApplicationsInHistorical2012StringAggregates(stringRows)).toBe(
      APPROVED_2012_BASELINE.idnApplications,
    );
    expect(stringRows.every((row) => row.records.every((record) => record.idn))).toBe(true);
  });
});
