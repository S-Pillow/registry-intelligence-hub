import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FORECAST_CONVERSION_FACTORS } from "@/lib/registration-forecast";
import {
  assertConversionFactorsUnchanged,
  buildForecastPublicationCandidate,
  findForecastStringView,
  projectForecastCatalogView,
  stableStringifyForecastCandidate,
} from "@/lib/forecast-publication-candidate";
import type { ForecastPreviewDocument } from "@/registration-forecast-preview/types";

const SOURCE_PIN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function syntheticPreview(): ForecastPreviewDocument {
  return {
    schemaVersion: 1,
    kind: "experimental-registration-forecast-preview",
    status: "complete",
    horizonLabel: "~4 years",
    disclaimer: "Estimates, not facts. Toyroom-inspired wording should be sanitized in candidate.",
    conversionFactors: { ...FORECAST_CONVERSION_FACTORS },
    conversionNote: "Factors inspired by Toyroom scenario bands.",
    sourceAggregate: {
      path: "/secret/host/path.json",
      sha256: SOURCE_PIN,
      schemaVersion: 1,
      status: "complete",
      snapshotDate: "2026-11-07",
      manifestId: "mid-panel",
      sourceId: "activedns",
      sourceName: "ActiveDNS",
      sourceUrl: "https://activedns.net/",
      attribution: "ActiveDNS attribution",
      referencePanelTlds: ["net", "org", "info", "biz", "app", "dev"],
      domainScan: { huge: true },
      applicationCensus: { huge: true },
      candidateProvenance: { huge: true },
      processing: { huge: true },
    },
    summary: {
      measuredStringCount: 3,
      estimatedStringCount: 2,
      conversionNotRecommendedCount: 1,
      zeroMeasuredDemandCount: 1,
    },
    limitations: ["Partial inventory", "Inspired by Toyroom public description"],
    strings: [
      {
        stringLabel: "wdo",
        measuredDomainCount: 62,
        status: "estimated",
        compoundWordCandidate: true,
        range: { conservative: 50, expected: 118, optimistic: 198 },
        statusNote: "experimental",
        brandDesignationObserved: null,
        contested: null,
        fromNormalizedApplication: false,
        fromKnownExcluded: true,
        origins: ["knownExcludedRecords.primaryString"],
      },
      {
        stringLabel: "adidas",
        measuredDomainCount: 41,
        status: "estimated",
        compoundWordCandidate: true,
        range: { conservative: 33, expected: 78, optimistic: 131 },
        statusNote: "experimental",
        brandDesignationObserved: true,
        contested: false,
        fromNormalizedApplication: true,
        fromKnownExcluded: false,
        origins: ["appliedString.label"],
      },
      {
        stringLabel: "ab",
        measuredDomainCount: 0,
        status: "conversion_not_recommended",
        compoundWordCandidate: false,
        range: null,
        statusNote: "not recommended",
        brandDesignationObserved: false,
        contested: false,
        fromNormalizedApplication: true,
        fromKnownExcluded: false,
        origins: ["appliedString.label"],
      },
    ],
  };
}

describe("forecast publication candidate", () => {
  it("projects sanitized Low/Middle/High scenarios without host paths or aggregate blobs", () => {
    const preview = syntheticPreview();
    const candidate = buildForecastPublicationCandidate({
      preview,
      sourcePreviewSha256: "previewsha",
    });
    const json = stableStringifyForecastCandidate(candidate);
    expect(json).not.toMatch(/\/secret\/host/);
    expect(json).not.toMatch(/domainScan|applicationCensus|candidateProvenance/);
    expect(json.toLowerCase()).not.toMatch(/toyroom/);
    expect(candidate.conversionFactors).toEqual(FORECAST_CONVERSION_FACTORS);
    assertConversionFactorsUnchanged(candidate.conversionFactors);

    const catalog = projectForecastCatalogView(candidate);
    const wdo = findForecastStringView(catalog, ".wdo");
    expect(wdo).toMatchObject({
      measuredDomainCount: 62,
      scenarios: { low: 50, middle: 118, high: 198 },
      brandDesignationObserved: null,
      contested: null,
    });
    expect(findForecastStringView(catalog, "adidas")?.brandDesignationObserved).toBe(true);
    expect(findForecastStringView(catalog, "ab")?.scenarios).toBeNull();
    expect(findForecastStringView(catalog, "ab")?.measuredDomainCount).toBe(0);
  });

  it("is reproducible for hashing", () => {
    const preview = syntheticPreview();
    const a = buildForecastPublicationCandidate({ preview, sourcePreviewSha256: "previewsha" });
    const b = buildForecastPublicationCandidate({ preview, sourcePreviewSha256: "previewsha" });
    const sa = stableStringifyForecastCandidate(a);
    const sb = stableStringifyForecastCandidate(b);
    expect(sa).toBe(sb);
    expect(createHash("sha256").update(sa).digest("hex")).toBe(
      createHash("sha256").update(sb).digest("hex"),
    );
  });
});
