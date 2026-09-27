import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import {
  buildHistorical2012StructuralSummary,
  prepareHistorical2012SharedLayout,
} from "@/historical-2012/structural-summary";
import {
  APPLICANT_LEGAL_NAME_CONCENTRATION_LIMIT,
  buildApplicantLegalNameConcentration,
  buildExactAppliedStringCompetition,
  EXACT_APPLIED_STRING_COMPETITION_LIMIT,
  type Application,
} from "@/lib/registry-data";

const document = JSON.parse(
  readFileSync(fileURLToPath(new URL("../data/fixtures/registry-2012-applications.payload.json", import.meta.url)), "utf8"),
) as Registry2012ApplicationsDocument;
const applications = document.applications;
const summary = buildHistorical2012StructuralSummary(applications);
const base = applications[0];

function row(overrides: Partial<Application> & { id: string }): Application {
  return { ...base, ...overrides } as Application;
}

describe("PR-6 2012 structural summary", () => {
  it("01 counts 1154 distinct applicant legal names from the corpus", () => {
    const counted = new Set(applications.map((application) => application.applicant.trim()).filter(Boolean));
    expect(counted.size).toBe(1154);
    expect(summary.legalNames.distinctApplicantLegalNames).toBe(counted.size);
    expect(summary.legalNames.method).toBe("applicant-legal-name-count/1.0.0");
    expect(summary.legalNames.grain).toBe("applicant-legal-name");
  });

  it("02 groups by applicant legal name, not organization", () => {
    const mixed = buildHistorical2012StructuralSummary([
      row({ id: "1", applicant: "ZZZ Legal", organization: "AAA Org" }),
      row({ id: "2", applicant: "AAA Legal", organization: "AAA Org" }),
    ]);
    expect(mixed.legalNames.distinctApplicantLegalNames).toBe(2);
    expect(mixed.legalNames.ranked.map((item) => [item.applicantLegalName, item.count])).toEqual([
      ["AAA Legal", 1],
      ["ZZZ Legal", 1],
    ]);
    expect(mixed.legalNames.ranked.some((item) => item.applicantLegalName === "AAA Org")).toBe(false);
  });

  it("03 keeps every corpus application in the legal-name denominator", () => {
    expect(applications).toHaveLength(1930);
    expect(applications.every((application) => application.applicant.trim().length > 0)).toBe(true);
    expect(summary.legalNames.eligibleApplicationCount).toBe(1930);
    expect(summary.applicationCount).toBe(1930);
  });

  it("04 keeps legal-name order deterministic when the corpus is reversed", () => {
    const reversed = buildHistorical2012StructuralSummary([...applications].reverse());
    expect(reversed.legalNames.ranked).toEqual(summary.legalNames.ranked);
    const counts = summary.legalNames.ranked.map((item) => item.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("05 breaks equal legal-name counts A to Z and keeps the top limit", () => {
    const full = buildApplicantLegalNameConcentration(applications);
    expect(full.ranked[4]).toMatchObject({ applicantLegalName: "Afilias Limited", count: 26 });
    expect(full.ranked[5]).toMatchObject({ applicantLegalName: "United TLD Holdco Ltd.", count: 26 });
    expect(summary.legalNames.ranked.map((item) => item.applicantLegalName)).toEqual([
      "Charleston Road Registry Inc.",
      "Amazon EU S.à r.l.",
      "Top Level Domain Holdings Limited",
      "Uniregistry, Corp.",
      "Afilias Limited",
    ]);
    expect(summary.legalNames.ranked).toHaveLength(APPLICANT_LEGAL_NAME_CONCENTRATION_LIMIT);
    expect(summary.legalNames.ranked.some((item) => item.applicantLegalName === "United TLD Holdco Ltd.")).toBe(false);
  });

  it("06 states the 1930-application denominator on every ranked legal name", () => {
    expect(summary.legalNames.shareDenominator).toBe(1930);
    expect(summary.legalNames.ranked.map((item) => [item.applicantLegalName, item.count, item.shareDenominator])).toEqual([
      ["Charleston Road Registry Inc.", 101, 1930],
      ["Amazon EU S.à r.l.", 76, 1930],
      ["Top Level Domain Holdings Limited", 70, 1930],
      ["Uniregistry, Corp.", 54, 1930],
      ["Afilias Limited", 26, 1930],
    ]);
  });

  it("07 sends the top legal names, not all 1154", () => {
    expect(summary.legalNames.distinctApplicantLegalNames).toBe(1154);
    expect(summary.legalNames.ranked.length).toBe(5);
    expect(summary.legalNames.ranked.length).toBeLessThan(summary.legalNames.distinctApplicantLegalNames);
  });

  it("08 counts 60 distinct Location values from the corpus country field", () => {
    const locations = new Set(applications.map((application) => application.country));
    expect(locations.size).toBe(60);
    expect(summary.geography.distinctLocations).toBe(locations.size);
    expect(summary.geography.locationField).toBe("Location");
  });

  it("09 counts five ICANN region codes from the corpus", () => {
    const codes = new Set(applications.map((application) => application.region));
    expect(codes.size).toBe(5);
    expect(summary.geography.regionCount).toBe(5);
    expect(summary.geography.regions.map((region) => region.regionCode)).toEqual(["NA", "EUR", "AP", "LAC", "AF"]);
    expect(summary.geography.regionField).toBe("Region");
  });

  it("10 counts region totals instead of hardcoding them", () => {
    const counted = new Map<string, number>();
    for (const application of applications) {
      counted.set(application.region, (counted.get(application.region) ?? 0) + 1);
    }
    expect(Object.fromEntries(counted)).toEqual({ NA: 911, EUR: 675, AP: 303, LAC: 24, AF: 17 });
    expect(summary.geography.regions).toEqual([
      { regionCode: "NA", applicationCount: counted.get("NA") },
      { regionCode: "EUR", applicationCount: counted.get("EUR") },
      { regionCode: "AP", applicationCount: counted.get("AP") },
      { regionCode: "LAC", applicationCount: counted.get("LAC") },
      { regionCode: "AF", applicationCount: counted.get("AF") },
    ]);
    const source = readFileSync(fileURLToPath(new URL("./structural-summary.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/\b911\b/);
    expect(source).not.toMatch(/\b675\b/);
    expect(source).not.toMatch(/\b1154\b/);
    const synthetic = buildHistorical2012StructuralSummary([
      row({ id: "1", region: "ZZ", country: "QQ" }),
      row({ id: "2", region: "ZZ", country: "QQ" }),
      row({ id: "3", region: "YY", country: "RR" }),
    ]);
    expect(synthetic.geography.regions).toEqual([
      { regionCode: "ZZ", applicationCount: 2 },
      { regionCode: "YY", applicationCount: 1 },
    ]);
    expect(synthetic.geography.distinctLocations).toBe(2);
  });

  it("11 sums region counts to 1930 applications", () => {
    const sum = summary.geography.regions.reduce((total, region) => total + region.applicationCount, 0);
    expect(sum).toBe(1930);
    expect(summary.geography.applicationCount).toBe(sum);
    expect(summary.geography.applicationCount).toBe(applications.length);
  });

  it("12 does not relabel regions as the six rehearsal prose names", () => {
    const prose = ["North America", "Latin America", "Middle East", "Europe", "Asia Pacific", "Africa"];
    for (const name of prose) {
      expect(summary.geography.regions.some((region) => region.regionCode === name)).toBe(false);
    }
  });

  it("13 groups exact strings by Application.string, not by applicant or organization", () => {
    const mixed = buildHistorical2012StructuralSummary([
      row({ id: "1", string: "APP", applicant: "One Legal LLC", organization: "One Org" }),
      row({ id: "2", string: "APP", applicant: "Two Legal Inc.", organization: "Two Org" }),
      row({ id: "3", string: "HOME", applicant: "One Legal LLC", organization: "One Org" }),
    ]);
    expect(mixed.exactStrings.repeated).toEqual([{ appliedForString: "APP", applicationCount: 2 }]);
    expect(mixed.exactStrings.method).toBe("exact-applied-string-grouping/1.0.0");
    expect(mixed.exactStrings.grain).toBe("exact-applied-for-string");
  });

  it("14 does not trim, case-fold, or IDN-fold exact strings", () => {
    const mixed = buildHistorical2012StructuralSummary([
      row({ id: "1", string: "APP" }),
      row({ id: "2", string: "APP" }),
      row({ id: "3", string: "app" }),
      row({ id: "4", string: " APP" }),
      row({ id: "5", string: " APP" }),
      row({ id: "6", string: "xn--app", aLabel: "xn--app" }),
      row({ id: "7", string: "ラベル", aLabel: "xn--app" }),
    ]);
    expect(mixed.exactStrings.repeated.map((group) => group.appliedForString)).toEqual([" APP", "APP"]);
    expect(mixed.exactStrings.largestGroup).toEqual({ appliedForString: " APP", applicationCount: 2 });
  });

  it("15 keeps exact-string grouping on the approved method and omits a set total", () => {
    const exact = buildExactAppliedStringCompetition(applications);
    expect(exact.method).toBe(summary.exactStrings.method);
    expect(exact.competingGroupCount).toBe(230);
    expect(exact.applicationsInCompetingGroups).toBe(751);
    expect(exact.competingGroupCount).not.toBe(232);
    expect(exact.competingGroupCount).not.toBe(234);
    expect(summary.exactStrings).not.toHaveProperty("competingGroupCount");
    expect(summary.exactStrings).not.toHaveProperty("applicationsInCompetingGroups");
    expect(summary.exactStrings).not.toHaveProperty("setCount");
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("232");
    expect(serialized).not.toContain("234");
    expect(serialized).not.toContain("230");
    expect(serialized).not.toContain("751");
  });

  it("16 reports the largest exact-string group from the corpus", () => {
    expect(summary.exactStrings.largestGroup).toEqual({ appliedForString: "APP", applicationCount: 13 });
    const exact = buildExactAppliedStringCompetition(applications);
    expect(exact.competingGroups[0]).toMatchObject({ appliedForString: "APP", applicationCount: 13 });
  });

  it("17 orders tied exact strings A to Z and limits the client list", () => {
    const exact = buildExactAppliedStringCompetition(applications);
    expect(exact.competingGroups[1]).toMatchObject({ appliedForString: "HOME", applicationCount: 11 });
    expect(exact.competingGroups[2]).toMatchObject({ appliedForString: "INC", applicationCount: 11 });
    expect(summary.exactStrings.repeated).toEqual([
      { appliedForString: "APP", applicationCount: 13 },
      { appliedForString: "HOME", applicationCount: 11 },
      { appliedForString: "INC", applicationCount: 11 },
      { appliedForString: "ART", applicationCount: 10 },
      { appliedForString: "BLOG", applicationCount: 9 },
    ]);
    expect(summary.exactStrings.repeated).toHaveLength(EXACT_APPLIED_STRING_COMPETITION_LIMIT);
    const reversed = buildHistorical2012StructuralSummary([...applications].reverse());
    expect(reversed.exactStrings).toEqual(summary.exactStrings);
  });

  it("18 omits the 1930 application rows from the Command Center transfer", () => {
    const resolution = resolveHistorical2012BrowserPayload(document, APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
    expect(resolution.status).toBe("loaded");
    const prepared = prepareHistorical2012SharedLayout(resolution);
    expect(prepared.structuralSummary).toEqual(summary);
    expect(prepared.applicationPayload.status).toBe("loaded");
    if (prepared.applicationPayload.status !== "loaded" || prepared.structuralSummary === null) return;
    expect(prepared.applicationPayload.document.applications).toEqual([]);
    expect(prepared.applicationPayload.applicationCount).toBe(1930);
    const summaryBytes = Buffer.byteLength(JSON.stringify(prepared.structuralSummary));
    expect(summaryBytes).toBeLessThan(8_000);
    expect(summaryBytes).toBeGreaterThan(0);
    const serialized = JSON.stringify(prepared.structuralSummary);
    expect(serialized).not.toMatch(/1-\d{3,4}-\d+/);
    expect(serialized).not.toContain("\"applications\"");
    expect(JSON.stringify(prepared.applicationPayload.document.applications)).toBe("[]");
    expect(prepared.structuralSummary.legalNames.distinctApplicantLegalNames).toBe(1154);
  });
});
