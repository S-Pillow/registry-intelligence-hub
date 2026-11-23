import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  buildExampleForecastRows,
  buildForecastRow,
  buildForecastUnits,
  defaultUnavailableSuffixDemandEvidence,
  estimateRegistrationsFromSuffixDemand,
  FORECAST_CONVERSION_FACTORS,
  isCompoundWordCandidate,
  isConfirmedClosedBrandUnit,
  selectExampleForecastUnits,
  syntheticAvailableDemand,
} from "@/lib/registration-forecast";

const COHORT = join(process.cwd(), "src/lib/fixtures/applicant-string-status-scd-cohort/browser-document.cohort.json");

function loadCohort(): RegistryApplicationsDocumentV2 {
  return JSON.parse(readFileSync(COHORT, "utf8")) as RegistryApplicationsDocumentV2;
}

function emptyLabels() {
  return {
    gacEarlyWarning: false,
    gacAdvice: false,
    highRiskString: false,
    objection: false,
    safeguard: false,
    inContentionExportLabel: false,
    clarifyingQuestions: false,
    changeRequest: false,
    openCommentPeriod: false,
    comments: false,
    rvc: false,
    applicantSupport: false,
    variantOnlyExistingTld: false,
    variantIncluded: false,
    cocExemption: false,
    reservedName: false,
    cpe: false,
    singularPlural: false,
  };
}

function mkApp(
  partial: Partial<BrowserApplicationV2> &
    Pick<BrowserApplicationV2, "applicationId" | "applicant" | "appliedString">,
): BrowserApplicationV2 {
  return {
    country: "US",
    region: "NA",
    applicationStatus: "Active",
    processingStage: "String Evaluation Processing",
    applicationType: "New gTLD",
    designations: {
      idn: false,
      brand: false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
    },
    labels: emptyLabels(),
    officialContention: {
      membershipPresent: false,
      officialContentionSetIds: [],
      terminology: "official-initial-contention",
    },
    ...partial,
  };
}

describe("registration forecast conversions", () => {
  it("applies transparent 0.8 / 1.9 / 3.2 conversions to measured suffix demand", () => {
    expect(estimateRegistrationsFromSuffixDemand(1000)).toEqual({
      conservative: Math.round(1000 * FORECAST_CONVERSION_FACTORS.conservative),
      expected: Math.round(1000 * FORECAST_CONVERSION_FACTORS.expected),
      optimistic: Math.round(1000 * FORECAST_CONVERSION_FACTORS.optimistic),
    });
    expect(estimateRegistrationsFromSuffixDemand(1000)).toEqual({
      conservative: 800,
      expected: 1900,
      optimistic: 3200,
    });
  });

  it("rejects invalid demand counts", () => {
    expect(() => estimateRegistrationsFromSuffixDemand(-1)).toThrow(/finite number/i);
  });

  it("flags word-like strings for the experimental band", () => {
    expect(isCompoundWordCandidate("cloud")).toBe(true);
    expect(isCompoundWordCandidate("home-hub")).toBe(true);
    expect(isCompoundWordCandidate("ai")).toBe(false);
    expect(isCompoundWordCandidate("x")).toBe(false);
  });
});

describe("registration forecast eligibility", () => {
  it("builds one unit per unique selected string and marks contested without predicting winners", () => {
    const document = {
      applications: [
        mkApp({
          applicationId: "A1",
          applicant: "Alpha LLC",
          appliedString: { sourceRowId: "1", label: "cloud" },
          officialContention: {
            membershipPresent: true,
            officialContentionSetIds: ["9"],
            terminology: "official-initial-contention",
          },
        }),
        mkApp({
          applicationId: "A2",
          applicant: "Beta Inc",
          appliedString: { sourceRowId: "2", label: "cloud" },
          officialContention: {
            membershipPresent: true,
            officialContentionSetIds: ["9"],
            terminology: "official-initial-contention",
          },
        }),
        mkApp({
          applicationId: "B1",
          applicant: "Brand Co",
          appliedString: { sourceRowId: "3", label: "brandco" },
          designations: {
            idn: false,
            brand: true,
            community: false,
            geoSelfDesignated: false,
            geoStringReviewConfirmed: false,
          },
        }),
      ],
    } as RegistryApplicationsDocumentV2;

    const units = buildForecastUnits(document);
    const cloud = units.find((u) => u.stringLabel === "cloud");
    const brand = units.find((u) => u.stringLabel === "brandco");
    expect(units.filter((u) => u.stringLabel === "cloud")).toHaveLength(1);
    expect(cloud?.applicantCount).toBe(2);
    expect(cloud?.contested).toBe(true);
    expect(cloud?.officialContentionSetIds).toEqual(["9"]);
    expect(brand && isConfirmedClosedBrandUnit(brand)).toBe(true);

    const brandRow = buildForecastRow(brand!, syntheticAvailableDemand(500));
    expect(brandRow.status).toBe("excluded_brand");
    expect(brandRow.range).toBeNull();

    const cloudReady = buildForecastRow(cloud!, syntheticAvailableDemand(1000));
    expect(cloudReady.status).toBe("ready");
    expect(cloudReady.range).toEqual({ conservative: 800, expected: 1900, optimistic: 3200 });
    expect(cloudReady.statusNote).toMatch(/Experimental estimate/i);
    expect(cloudReady.contested).toBe(true);
  });

  it("does not fabricate numeric forecasts when suffix-demand evidence is unavailable", () => {
    const document = loadCohort();
    const rows = buildExampleForecastRows(document, null, defaultUnavailableSuffixDemandEvidence());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(12);
    expect(rows.every((r) => r.range === null || r.status === "ready")).toBe(true);
    expect(rows.every((r) => r.status !== "ready")).toBe(true);
    expect(rows.some((r) => r.status === "demand_unavailable")).toBe(true);
    const unavailable = defaultUnavailableSuffixDemandEvidence();
    expect(unavailable.status).toBe("unavailable");
    if (unavailable.status === "unavailable") {
      expect(unavailable.blocker).toMatch(/domain-name-level/i);
    }
    expect(unavailable.coverageNote).toMatch(/Monthly Registry Reports/i);
  });

  it("uses selected replacement string identity for uniqueness (brand → master)", () => {
    const document = loadCohort();
    const units = buildForecastUnits(document);
    const labels = new Set(units.map((u) => u.stringLabel));
    expect(labels.has("master")).toBe(true);
    const examples = selectExampleForecastUnits(units);
    expect(examples.some((u) => u.stringLabel === "master")).toBe(true);
    expect(examples.some((u) => u.stringLabel === "force" && u.contested)).toBe(true);
  });

  it("keeps short tokens measured but conversion-not-recommended when demand exists", () => {
    const unit = {
      stringLabel: "ai",
      unicodeLabel: null,
      applicantCount: 1,
      applicantLegalNames: ["ShortDot (Ireland) Limited"],
      applicationIds: ["X1"],
      brandApplicationCount: 0,
      contested: true,
      officialContentionSetIds: ["1"],
      compoundWordCandidate: false,
    };
    const row = buildForecastRow(unit, syntheticAvailableDemand(50_000));
    expect(row.status).toBe("conversion_not_recommended");
    expect(row.suffixDemandCount).toBe(50_000);
    expect(row.range).toBeNull();
  });
});
