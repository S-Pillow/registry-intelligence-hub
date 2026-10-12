import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";
import {
  buildHistoricalApplicantPortfolioCohorts,
  exploreHistorical2012ApplicantLegalNameHref,
  formatCohortSharePercent,
  historicalCohortsHref,
  HISTORICAL_COHORT_CONCENTRATION_TOP_NS,
  HISTORICAL_COHORT_EXACT_STRING_EXPOSURE_LIMIT,
  HISTORICAL_COHORT_GRAIN,
  HISTORICAL_COHORT_LARGEST_LIMIT,
  HISTORICAL_COHORT_PORTFOLIO_BANDS,
  type HistoricalApplicantPortfolioCohortIntelligence,
} from "@/lib/historical-cohort-intelligence";
import {
  buildApplicantLegalNameConcentration,
  EXACT_APPLIED_STRING_COMPETITION_METHOD,
  type Application,
} from "@/lib/registry-data";
import { HUB_BASE_PATH, withBasePath } from "@/lib/hub-paths";

const document = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../data/fixtures/registry-2012-applications.payload.json", import.meta.url)),
    "utf8",
  ),
) as Registry2012ApplicationsDocument;
const applications = document.applications;
const intelligence = buildHistoricalApplicantPortfolioCohorts(applications);

function band(id: string) {
  return intelligence.bands.find((row) => row.id === id)!;
}

describe("HIST-COHORT-1 portfolio distribution", () => {
  it("pins accepted portfolio-size bands", () => {
    expect(band("1")).toMatchObject({ applicantCount: 964, applicationCount: 964 });
    expect(band("2-4")).toMatchObject({ applicantCount: 154, applicationCount: 379 });
    expect(band("5-9")).toMatchObject({ applicantCount: 22, applicationCount: 134 });
    expect(band("10-24")).toMatchObject({ applicantCount: 8, applicationCount: 100 });
    expect(band("25+")).toMatchObject({ applicantCount: 6, applicationCount: 353 });
  });

  it("sums band Applicants and Applications to accepted denominators", () => {
    expect(intelligence.bands.reduce((sum, row) => sum + row.applicantCount, 0)).toBe(1154);
    expect(intelligence.bands.reduce((sum, row) => sum + row.applicationCount, 0)).toBe(1930);
    expect(intelligence.applicantLegalNameDenominator).toBe(1154);
    expect(intelligence.applicationDenominator).toBe(1930);
    expect(HISTORICAL_COHORT_PORTFOLIO_BANDS).toHaveLength(5);
  });

  it("derives band shares from denominators rather than hard-coded display strings", () => {
    expect(band("1").applicantShare).toBeCloseTo(964 / 1154, 12);
    expect(band("1").applicationShare).toBeCloseTo(964 / 1930, 12);
    expect(formatCohortSharePercent(band("1").applicantShare)).toBe("83.54%");
    expect(formatCohortSharePercent(band("1").applicationShare)).toBe("49.95%");
  });
});

describe("HIST-COHORT-1 one-off vs multi-Application", () => {
  it("pins one-off and multi-Application partitions", () => {
    const { oneOffVsMulti: o } = intelligence;
    expect(o.oneOffApplicants).toBe(964);
    expect(o.multiApplicants).toBe(190);
    expect(o.oneOffApplications).toBe(964);
    expect(o.multiApplications).toBe(966);
    expect(o.oneOffApplicants + o.multiApplicants).toBe(1154);
    expect(o.oneOffApplications + o.multiApplications).toBe(1930);
    expect(o.oneOffApplicantShare).toBeCloseTo(964 / 1154, 12);
    expect(o.multiApplicationShare).toBeCloseTo(966 / 1930, 12);
  });
});

describe("HIST-COHORT-1 concentration", () => {
  it("pins top-N Application totals against the 1930 denominator", () => {
    expect(HISTORICAL_COHORT_CONCENTRATION_TOP_NS).toEqual([5, 10, 25, 50]);
    const byN = Object.fromEntries(
      intelligence.concentration.map((row) => [row.topN, row]),
    );
    expect(byN[5]).toMatchObject({ applicationCount: 327 });
    expect(byN[10]).toMatchObject({ applicationCount: 407 });
    expect(byN[25]).toMatchObject({ applicationCount: 530 });
    expect(byN[50]).toMatchObject({ applicationCount: 643 });
    expect(byN[5].share).toBeCloseTo(327 / 1930, 12);
    expect(byN[50].share).toBeCloseTo(643 / 1930, 12);
    expect(formatCohortSharePercent(byN[5].share)).toBe("16.94%");
    expect(formatCohortSharePercent(byN[50].share)).toBe("33.32%");
  });
});

describe("HIST-COHORT-1 largest Applicants", () => {
  it("pins the largest Applicant legal-name portfolios and preserves the 26-Application tie", () => {
    const names = Object.fromEntries(
      intelligence.largest.map((row) => [row.applicantLegalName, row.applicationCount]),
    );
    expect(names["Charleston Road Registry Inc."]).toBe(101);
    expect(names["Amazon EU S.à r.l."]).toBe(76);
    expect(names["Top Level Domain Holdings Limited"]).toBe(70);
    expect(names["Uniregistry, Corp."]).toBe(54);
    expect(names["Afilias Limited"]).toBe(26);
    expect(names["United TLD Holdco Ltd."]).toBe(26);

    const afilias = intelligence.largest.find((row) => row.applicantLegalName === "Afilias Limited")!;
    const united = intelligence.largest.find(
      (row) => row.applicantLegalName === "United TLD Holdco Ltd.",
    )!;
    expect(afilias.rank).toBeLessThan(united.rank);
    expect(afilias.applicationCount).toBe(united.applicationCount);
    expect(intelligence.largest[0]?.applicantLegalName).toBe("Charleston Road Registry Inc.");
    expect(HISTORICAL_COHORT_LARGEST_LIMIT).toBeGreaterThanOrEqual(6);
  });
});

describe("HIST-COHORT-1 grain safety", () => {
  it("groups only by Applicant legal name and never merges Organizations", () => {
    expect(intelligence.grain).toBe(HISTORICAL_COHORT_GRAIN);
    expect(intelligence.grain).toBe("applicant-legal-name");

    const base = applications[0]!;
    const synthetic: Application[] = [
      { ...base, id: "g1", applicant: "Afilias Limited", organization: "Afilias Org Bundle" },
      { ...base, id: "g2", applicant: "Afilias Limited", organization: "Afilias Org Bundle" },
      { ...base, id: "g3", applicant: "Afilias plc", organization: "Afilias Org Bundle" },
    ];
    const derived = buildHistoricalApplicantPortfolioCohorts(synthetic);
    expect(derived.applicantLegalNameDenominator).toBe(2);
    expect(derived.largest.map((row) => row.applicantLegalName)).toEqual([
      "Afilias Limited",
      "Afilias plc",
    ]);
    expect(derived.largest.some((row) => row.applicantLegalName === "Afilias Org Bundle")).toBe(
      false,
    );

    const afiliasLimited = intelligence.largest.find(
      (row) => row.applicantLegalName === "Afilias Limited",
    )!;
    expect(afiliasLimited.applicationCount).toBe(26);
    expect(afiliasLimited.applicationCount).not.toBe(31);
  });

  it("does not infer current-round identity from historical-name equality", () => {
    expect(intelligence.largest.every((row) => row.exploreHref.includes("dataset=2012-historical"))).toBe(
      true,
    );
    expect(intelligence.largest.every((row) => !row.exploreHref.includes("/applicant?"))).toBe(true);
    expect(JSON.stringify(intelligence)).not.toMatch(/returning Applicant|new entrant|parent company/i);
  });
});

describe("HIST-COHORT-1 performance / payload", () => {
  it("view model contains aggregates and top-N only — not the 1930-row corpus", () => {
    const serialized = JSON.stringify(intelligence);
    expect(serialized.length).toBeLessThan(50_000);
    expect(serialized).not.toContain('"applications":[');
    expect(intelligence).not.toHaveProperty("applications");
    expect(intelligence.largest.length).toBeLessThanOrEqual(HISTORICAL_COHORT_LARGEST_LIMIT);
    expect(intelligence.largest.length).toBeLessThan(100);
    expect(intelligence.bands).toHaveLength(5);
    expect(intelligence.concentration).toHaveLength(4);

    // Guard against accidentally embedding corpus rows via unknown keys.
    const keys = Object.keys(intelligence).sort();
    expect(keys).toEqual(
      [
        "applicantLegalNameDenominator",
        "applicationDenominator",
        "bands",
        "concentration",
        "concentrationMethod",
        "exactStringCompetition",
        "exclusions",
        "grain",
        "hrefs",
        "largest",
        "method",
        "observation",
        "oneOffVsMulti",
        "productQuestion",
        "provenance",
        "roundProgramYear",
        "subtitle",
        "title",
      ].sort(),
    );
    expect(intelligence.exactStringCompetition.ranked.length).toBeLessThanOrEqual(
      HISTORICAL_COHORT_EXACT_STRING_EXPOSURE_LIMIT,
    );
    expect(JSON.stringify(intelligence.exactStringCompetition)).not.toContain('"applications":[');
  });

  it("concentration helper and cohort builder agree on legal-name ranking", () => {
    const direct = buildApplicantLegalNameConcentration(applications);
    expect(intelligence.largest.map((row) => [row.applicantLegalName, row.applicationCount])).toEqual(
      direct.ranked
        .slice(0, intelligence.largest.length)
        .map((row) => [row.applicantLegalName, row.count]),
    );
  });
});

describe("HIST-COHORT-1 navigation helpers", () => {
  it("exposes basePath-safe app routes (Next Link prefixes basePath at runtime)", () => {
    expect(historicalCohortsHref()).toBe("/historical-cohorts");
    expect(withBasePath(historicalCohortsHref())).toBe(`${HUB_BASE_PATH}/historical-cohorts`);
    expect(exploreHistorical2012ApplicantLegalNameHref("Charleston Road Registry Inc.")).toBe(
      "/explore?dataset=2012-historical&entity=applications&q=Charleston+Road+Registry+Inc.",
    );
    expect(
      withBasePath(exploreHistorical2012ApplicantLegalNameHref("Afilias Limited")),
    ).toBe(
      `${HUB_BASE_PATH}/explore?dataset=2012-historical&entity=applications&q=Afilias+Limited`,
    );
  });
});

describe("HIST-COHORT-1 exclusions stay declarative", () => {
  it("declares deferred and excluded surfaces without peer preliminary-contention board", () => {
    expect(intelligence.exclusions.join(" ")).toMatch(/Preliminary contention/i);
    expect(intelligence.exclusions.join(" ")).toMatch(/Organization/i);
    expect(intelligence.exclusions.join(" ")).toMatch(/Cross-round/i);
    expect(intelligence.provenance.limitations.some((line) => /not a 2012 vs 2026/i.test(line))).toBe(
      true,
    );
  });
});

describe("HIST-COHORT-2A exact-string competition aggregates", () => {
  it("pins exposed Applicants, Applications, and repeated-string counts", () => {
    const exact = intelligence.exactStringCompetition;
    expect(exact.applicantsExposed).toBe(452);
    expect(exact.applicationsExposed).toBe(751);
    expect(exact.repeatedStringCount).toBe(230);
    expect(intelligence.applicantLegalNameDenominator).toBe(1154);
    expect(intelligence.applicationDenominator).toBe(1930);
    expect(exact.applicantShare).toBeCloseTo(452 / 1154, 12);
    expect(exact.applicationShare).toBeCloseTo(751 / 1930, 12);
    expect(formatCohortSharePercent(exact.applicantShare)).toBe("39.17%");
    expect(formatCohortSharePercent(exact.applicationShare)).toBe("38.91%");
    expect(exact.exactRepeatApplicationsAlsoInPreliminaryContention).toBe(748);
  });

  it("pins top Applicant exact-string exposure with deterministic ordering", () => {
    const byName = Object.fromEntries(
      intelligence.exactStringCompetition.ranked.map((row) => [
        row.applicantLegalName,
        row,
      ]),
    );
    expect(byName["Charleston Road Registry Inc."]).toMatchObject({
      applicationsInExactStringCompetition: 58,
      portfolioApplicationCount: 101,
    });
    expect(byName["Top Level Domain Holdings Limited"]).toMatchObject({
      applicationsInExactStringCompetition: 56,
      portfolioApplicationCount: 70,
    });
    expect(byName["Uniregistry, Corp."]).toMatchObject({
      applicationsInExactStringCompetition: 45,
      portfolioApplicationCount: 54,
    });
    expect(byName["Amazon EU S.à r.l."]).toMatchObject({
      applicationsInExactStringCompetition: 35,
      portfolioApplicationCount: 76,
    });
    expect(byName["Afilias Limited"]).toMatchObject({
      applicationsInExactStringCompetition: 16,
      portfolioApplicationCount: 26,
    });
    expect(byName["NU DOT CO LLC"]).toMatchObject({
      applicationsInExactStringCompetition: 13,
      portfolioApplicationCount: 13,
      portfolioExposureShare: 1,
    });
    expect(intelligence.exactStringCompetition.ranked[0]?.applicantLegalName).toBe(
      "Charleston Road Registry Inc.",
    );
    expect(intelligence.exactStringCompetition.ranked.map((r) => r.applicationsInExactStringCompetition)).toEqual(
      [...intelligence.exactStringCompetition.ranked.map((r) => r.applicationsInExactStringCompetition)].sort(
        (a, b) => b - a,
      ),
    );
  });
});

describe("HIST-COHORT-2A concept safety", () => {
  it("never labels exact-string competition as official contention", () => {
    const exact = intelligence.exactStringCompetition;
    expect(exact.label).toBe("Exact-string competition");
    expect(exact.method).toBe(EXACT_APPLIED_STRING_COMPETITION_METHOD);
    expect(exact.grain).toBe("exact-applied-for-string");
    const blob = JSON.stringify(exact);
    expect(blob).not.toMatch(/"official contention"/i);
    expect(exact.limitations.join(" ")).toMatch(/not official contention/i);
    expect(exact.limitations.join(" ")).toMatch(/keeps the two historical concepts separate/i);
    expect(intelligence.exclusions.join(" ")).toMatch(/Preliminary contention leaderboard/i);
    expect(intelligence.exclusions.join(" ")).toMatch(/Cross-round exact-string/i);
    // 230 / 751 must not be framed as contention sets / memberships in product copy fields
    expect(exact.limitations.join(" ")).not.toMatch(/230.*contention sets/i);
    expect(JSON.stringify(intelligence)).not.toMatch(/2012→2026|vs 2026 official initial contention delta/i);
  });
});

/** Compile-time shape lock for page props — keeps payload free of Application[]. */
export type _AssertNoApplications = HistoricalApplicantPortfolioCohortIntelligence extends {
  applications: unknown;
}
  ? never
  : true;
