import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  estimateRegistrationsFromSuffixDemand,
  FORECAST_CONVERSION_FACTORS,
  isCompoundWordCandidate,
} from "@/lib/registration-forecast";
import {
  buildForecastPreviewDocument,
  forecastPreviewToCsv,
  stableStringify,
} from "./derive";
import { validateSuffixDemandAggregateForPreview } from "./validate-aggregate";

function baseAggregate(strings: Array<Record<string, unknown>>) {
  return {
    schemaVersion: 3,
    status: "complete",
    snapshotDate: "2026-11-07",
    manifestId: "activedns-mid-panel-2026-11-07",
    sourceId: "activedns-2026-11-07-panel-activedns-mid-panel-2026-11-07",
    sourceName: "ActiveDNS",
    sourceUrl: "https://activedns.net/",
    attribution: "Source: ActiveDNS — https://activedns.net/",
    referencePanelTlds: ["net", "org", "info", "biz", "app", "dev"],
    domainScan: {
      status: "complete",
      referencePanelTlds: ["net", "org", "info", "biz", "app", "dev"],
      filesVerified: 6,
    },
    applicationCensus: {
      status: "partial-observed",
      assertsCompleteRoundInventory: false,
      note: "partial",
    },
    candidateProvenance: {
      mode: "observed-proposed-strings",
      eligibleCandidateCount: strings.length,
    },
    processing: { acceptedRecords: 10, rejectedRecords: 0, duplicateRecords: 0, headerLines: 36 },
    forecastConversion: { applied: false, reason: "not converted at measurement" },
    strings,
  };
}

describe("forecast preview conversion reuse", () => {
  it("applies exact 0.8 / 1.9 / 3.2 scenario calculations and rounding", () => {
    expect(estimateRegistrationsFromSuffixDemand(62)).toEqual({
      conservative: Math.round(62 * FORECAST_CONVERSION_FACTORS.conservative),
      expected: Math.round(62 * FORECAST_CONVERSION_FACTORS.expected),
      optimistic: Math.round(62 * FORECAST_CONVERSION_FACTORS.optimistic),
    });
    expect(estimateRegistrationsFromSuffixDemand(62)).toEqual({
      conservative: 50,
      expected: 118,
      optimistic: 198,
    });
    expect(estimateRegistrationsFromSuffixDemand(0)).toEqual({
      conservative: 0,
      expected: 0,
      optimistic: 0,
    });
  });
});

describe("offline forecast preview derivation", () => {
  it("retains and converts WDO; retains Brand; does not Brand-exclude", () => {
    const aggregate = validateSuffixDemandAggregateForPreview(
      baseAggregate([
        {
          stringLabel: "wdo",
          domainCount: 62,
          measurementStatus: "measured",
          brandDesignationObserved: null,
          contested: null,
          fromKnownExcluded: true,
          fromNormalizedApplication: false,
          origins: ["known-excluded-primary-string"],
        },
        {
          stringLabel: "brandco",
          domainCount: 100,
          measurementStatus: "measured",
          brandDesignationObserved: true,
          contested: false,
          fromNormalizedApplication: true,
          fromKnownExcluded: false,
          origins: ["applied-string"],
        },
        {
          stringLabel: "ai",
          domainCount: 500,
          measurementStatus: "measured",
          brandDesignationObserved: false,
          contested: true,
        },
        {
          stringLabel: "zeroed",
          domainCount: 0,
          measurementStatus: "measured",
        },
      ]),
    );

    const doc = buildForecastPreviewDocument({
      aggregate,
      sourcePath: "/tmp/agg.json",
      sourceSha256: "abc",
    });

    expect(doc.summary.measuredStringCount).toBe(4);
    expect(doc.strings.map((s) => s.stringLabel)).toEqual(["ai", "brandco", "wdo", "zeroed"]);

    const wdo = doc.strings.find((s) => s.stringLabel === "wdo")!;
    expect(wdo.status).toBe("estimated");
    expect(wdo.measuredDomainCount).toBe(62);
    expect(wdo.range).toEqual({ conservative: 50, expected: 118, optimistic: 198 });
    expect(wdo.brandDesignationObserved).toBeNull();
    expect(wdo.contested).toBeNull();
    expect(wdo.fromKnownExcluded).toBe(true);

    const brand = doc.strings.find((s) => s.stringLabel === "brandco")!;
    expect(brand.status).toBe("estimated");
    expect(brand.brandDesignationObserved).toBe(true);
    expect(brand.range).toEqual({
      conservative: 80,
      expected: 190,
      optimistic: 320,
    });

    const short = doc.strings.find((s) => s.stringLabel === "ai")!;
    expect(isCompoundWordCandidate("ai")).toBe(false);
    expect(short.status).toBe("conversion_not_recommended");
    expect(short.measuredDomainCount).toBe(500);
    expect(short.range).toBeNull();
    expect(short.statusNote).toMatch(/not zero demand/i);

    const zero = doc.strings.find((s) => s.stringLabel === "zeroed")!;
    expect(zero.measuredDomainCount).toBe(0);
    expect(zero.status).toBe("estimated");
    expect(zero.range).toEqual({ conservative: 0, expected: 0, optimistic: 0 });

    expect(doc.sourceAggregate.attribution).toMatch(/ActiveDNS/);
    expect(doc.limitations.some((l) => l.includes(".com"))).toBe(true);
    expect(doc.conversionFactors).toEqual({ ...FORECAST_CONVERSION_FACTORS });
  });

  it("rejects duplicate labels, bad schema, bad hash, and invalid counts", () => {
    expect(() =>
      validateSuffixDemandAggregateForPreview(
        baseAggregate([
          { stringLabel: "hub", domainCount: 1 },
          { stringLabel: "hub", domainCount: 2 },
        ]),
      ),
    ).toThrow(/Duplicate/i);

    expect(() =>
      validateSuffixDemandAggregateForPreview({
        ...baseAggregate([{ stringLabel: "hub", domainCount: 1 }]),
        schemaVersion: 2,
      }),
    ).toThrow(/schemaVersion must be 3/i);

    expect(() =>
      validateSuffixDemandAggregateForPreview(
        baseAggregate([{ stringLabel: "hub", domainCount: -1 }]),
      ),
    ).toThrow(/domainCount/i);

    const body = Buffer.from(
      JSON.stringify(baseAggregate([{ stringLabel: "hub", domainCount: 1 }])),
      "utf8",
    );
    expect(() =>
      validateSuffixDemandAggregateForPreview(JSON.parse(body.toString("utf8")), {
        expectedSha256: "0".repeat(64),
        rawBytes: body,
      }),
    ).toThrow(/SHA-256 mismatch/i);

    const okSha = createHash("sha256").update(body).digest("hex");
    const validated = validateSuffixDemandAggregateForPreview(JSON.parse(body.toString("utf8")), {
      expectedSha256: okSha,
      rawBytes: body,
    });
    expect(validated.strings).toHaveLength(1);
  });

  it("produces deterministic JSON/CSV and accurate provenance", () => {
    const aggregate = validateSuffixDemandAggregateForPreview(
      baseAggregate([
        { stringLabel: "zeta", domainCount: 3, measurementStatus: "measured" },
        { stringLabel: "alpha", domainCount: 10, measurementStatus: "measured" },
      ]),
    );
    const a = buildForecastPreviewDocument({
      aggregate,
      sourcePath: "/data/agg.json",
      sourceSha256: "deadbeef",
    });
    const b = buildForecastPreviewDocument({
      aggregate,
      sourcePath: "/data/agg.json",
      sourceSha256: "deadbeef",
    });
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(forecastPreviewToCsv(a)).toBe(forecastPreviewToCsv(b));
    expect(a.sourceAggregate.path).toBe("/data/agg.json");
    expect(a.sourceAggregate.sha256).toBe("deadbeef");
    expect(a.sourceAggregate.snapshotDate).toBe("2026-11-07");
    expect(a.strings.map((s) => s.stringLabel)).toEqual(["alpha", "zeta"]);
  });

  it("distinguishes zero measured demand from unavailable demand semantics", () => {
    const aggregate = validateSuffixDemandAggregateForPreview(
      baseAggregate([{ stringLabel: "fresh", domainCount: 0, measurementStatus: "measured" }]),
    );
    const doc = buildForecastPreviewDocument({
      aggregate,
      sourcePath: "x",
      sourceSha256: "y",
    });
    const row = doc.strings[0]!;
    expect(row.measuredDomainCount).toBe(0);
    expect(row.range).toEqual({ conservative: 0, expected: 0, optimistic: 0 });
    expect(row.status).toBe("estimated");
    // Unavailable demand would have no measured count / no row — not represented as fabricated zero.
    expect(doc.summary.zeroMeasuredDemandCount).toBe(1);
  });
});
