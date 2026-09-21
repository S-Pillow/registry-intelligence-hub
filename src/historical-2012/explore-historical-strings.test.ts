import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import {
  assertHistorical2012StringCorpusIntegrity,
  filterHistorical2012StringAggregates,
  exploreFiltersFor2012Historical,
  groupHistorical2012ApplicationsByString,
  historical2012StringContentionSummary,
  historical2012StringIdnSummary,
  HISTORICAL_2012_UNIQUE_STRING_COUNT,
  isHistorical2012StringBrowse,
  underlyingApplicationsInHistorical2012StringAggregates,
} from "@/historical-2012/explore-historical-table";
import type { ExploreFilterState } from "@/lib/registry-data";

const payload = parse2012ApplicationPayloadJson(
  readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
);

describe("2012 historical string corpus derivation (D2.1)", () => {
  it("derives exactly 1409 unique strings from the 1930-application payload", () => {
    const integrity = assertHistorical2012StringCorpusIntegrity(payload.applications);
    expect(integrity.uniqueStrings).toBe(HISTORICAL_2012_UNIQUE_STRING_COUNT);
    expect(integrity.assignedApplications).toBe(1930);
  });

  it("groups .AAA to one row and .APP to one row with all member applications", () => {
    const rows = groupHistorical2012ApplicationsByString(payload.applications);
    const aaa = rows.find((row) => row.stringKey === "AAA");
    const app = rows.find((row) => row.stringKey === "APP");
    expect(aaa?.records).toHaveLength(1);
    expect(app?.records.length).toBeGreaterThan(1);
    expect(app?.records.every((record) => record.string === "APP")).toBe(true);
  });

  it("aggregates contention and IDN conservatively at string level", () => {
    const rows = groupHistorical2012ApplicationsByString(payload.applications);
    const app = rows.find((row) => row.stringKey === "APP")!;
    expect(historical2012StringContentionSummary(app.records)).not.toMatch(/234|232/);
    expect(historical2012StringIdnSummary(app.records)).toMatch(/IDN|Non-IDN|Mixed/);
  });

  it("uses dedicated string browse mode flag", () => {
    expect(isHistorical2012StringBrowse(true, "strings")).toBe(true);
    expect(isHistorical2012StringBrowse(true, "applications")).toBe(false);
  });
});

const emptyExploreFilters: ExploreFilterState = {
  q: "",
  category: "all",
  region: "all",
  status: "all",
  contention: "all",
  idn: "all",
  ids: "",
};

describe("2012 historical string aggregate explore filters (D2.1A)", () => {
  it("keeps full .APP membership for q=.APP, q=APP, and case-insensitive APP", () => {
    for (const q of [".APP", "APP", "app"]) {
      const exploreFilters = exploreFiltersFor2012Historical(
        { ...emptyExploreFilters, q, entity: "strings" },
        { browseEntity: "strings" },
      );
      const rows = filterHistorical2012StringAggregates(payload.applications, exploreFilters);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.stringKey).toBe("APP");
      expect(rows[0]?.records).toHaveLength(13);
    }
  });

  it("returns one string with full membership when searching by a member application id", () => {
    const appRow = groupHistorical2012ApplicationsByString(payload.applications).find((row) => row.stringKey === "APP")!;
    const memberId = appRow.records[0]!.id;
    const rows = filterHistorical2012StringAggregates(payload.applications, { ...emptyExploreFilters, q: memberId });
    expect(rows.find((row) => row.stringKey === "APP")?.records).toHaveLength(13);
  });

  it("returns one string with full membership when searching by a member applicant", () => {
    const appRow = groupHistorical2012ApplicationsByString(payload.applications).find((row) => row.stringKey === "APP")!;
    const applicant = appRow.records[0]!.applicant;
    const rows = filterHistorical2012StringAggregates(payload.applications, { ...emptyExploreFilters, q: applicant });
    expect(rows.find((row) => row.stringKey === "APP")?.records).toHaveLength(13);
  });

  it("does not truncate membership for region, contention, or IDN aggregate filters", () => {
    const appRow = groupHistorical2012ApplicationsByString(payload.applications).find((row) => row.stringKey === "APP")!;
    const sampleRegion = appRow.records[0]!.region;
    const regionRows = filterHistorical2012StringAggregates(payload.applications, {
      ...emptyExploreFilters,
      region: sampleRegion,
    });
    expect(regionRows.find((row) => row.stringKey === "APP")?.records).toHaveLength(13);

    const contentionRows = filterHistorical2012StringAggregates(payload.applications, {
      ...emptyExploreFilters,
      contention: "in",
    });
    const contestedApp = contentionRows.find((row) => row.stringKey === "APP");
    if (contestedApp) expect(contestedApp.records).toHaveLength(13);

    const idnRows = filterHistorical2012StringAggregates(payload.applications, {
      ...emptyExploreFilters,
      idn: "non-idn",
    });
    const idnApp = idnRows.find((row) => row.stringKey === "APP");
    if (idnApp) expect(idnApp.records).toHaveLength(13);
  });

  it("preserves corpus integrity for unfiltered aggregates", () => {
    const rows = filterHistorical2012StringAggregates(payload.applications, emptyExploreFilters);
    expect(rows).toHaveLength(HISTORICAL_2012_UNIQUE_STRING_COUNT);
    expect(underlyingApplicationsInHistorical2012StringAggregates(rows)).toBe(1930);
  });
});
