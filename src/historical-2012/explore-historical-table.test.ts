import { describe, expect, it } from "vitest";
import {
  exploreFiltersFor2012Historical,
  HISTORICAL_2012_APPLICATION_EXPLORE_COLUMN_HEADERS,
  historical2012ContentionMembershipLabel,
  historical2012IdnLabel,
  isHistorical2012ApplicationBrowse,
} from "@/historical-2012/explore-historical-table";

describe("2012 historical Explore application table model", () => {
  it("uses one-row-per-application column headers only in application browse mode", () => {
    expect(isHistorical2012ApplicationBrowse(true, "applications")).toBe(true);
    expect(isHistorical2012ApplicationBrowse(true, "strings")).toBe(false);
    expect(isHistorical2012ApplicationBrowse(false, "applications")).toBe(false);
    expect(HISTORICAL_2012_APPLICATION_EXPLORE_COLUMN_HEADERS).toEqual([
      "Applied string",
      "Application ID",
      "Applicant",
      "Region",
      "Contention membership",
      "IDN",
      "Trust / source",
      "Actions",
    ]);
    expect(HISTORICAL_2012_APPLICATION_EXPLORE_COLUMN_HEADERS).not.toContain("Applications");
    expect(HISTORICAL_2012_APPLICATION_EXPLORE_COLUMN_HEADERS).not.toContain("Participation");
  });

  it("ignores 2026 participation filters when querying the 2012 corpus", () => {
    expect(
      exploreFiltersFor2012Historical({
        status: "returning",
        entity: "applications",
      }),
    ).toEqual({ status: "all", entity: "applications" });
  });

  it("strips category filters for historical string browse", () => {
    expect(
      exploreFiltersFor2012Historical(
        { status: "all", category: "Technology", entity: "strings" },
        { browseEntity: "strings" },
      ),
    ).toEqual({ status: "all", category: "all", entity: "strings" });
  });

  it("formats contention and IDN from payload fields only", () => {
    expect(historical2012ContentionMembershipLabel("ICS-2012-exact-pair-199")).toBe(
      "ICS-2012-exact-pair-199",
    );
    expect(historical2012ContentionMembershipLabel(null)).toBe("Not in contention");
    expect(historical2012IdnLabel(true)).toBe("IDN");
    expect(historical2012IdnLabel(false)).toBe("Non-IDN");
  });
});
