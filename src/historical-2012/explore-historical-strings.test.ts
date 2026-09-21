import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import {
  assertHistorical2012StringCorpusIntegrity,
  groupHistorical2012ApplicationsByString,
  historical2012StringContentionSummary,
  historical2012StringIdnSummary,
  HISTORICAL_2012_UNIQUE_STRING_COUNT,
  isHistorical2012StringBrowse,
} from "@/historical-2012/explore-historical-table";

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
