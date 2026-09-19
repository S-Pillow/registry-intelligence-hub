import { describe, expect, it } from "vitest";
import { isCrossRoundComparisonAllowed } from "./comparison-gates";
import {
  METRIC_ELIGIBILITY_CATALOG,
  assertMetricComparable,
  assertCrossRoundDeltaAllowed,
  getMetricEligibility,
  resolveMetricEligibility,
} from "./metric-eligibility";

describe("metric-eligibility catalog (two-axis)", () => {
  it("defines post-Reveal lifecycle metrics as BLOCKED_SOURCE", () => {
    const blocked = [
      "returning-delegated-operator",
      "returning-successful-applicant",
      "historical-operator-track-record",
    ];
    for (const id of blocked) {
      expect(getMetricEligibility(id)?.methodReadiness).toBe("BLOCKED_SOURCE");
    }
  });

  it("denies real 2026 identity claims for every catalog entry", () => {
    expect(METRIC_ELIGIBILITY_CATALOG.every((entry) => entry.claimsReal2026Identity === false)).toBe(true);
  });

  it("sets approved count metrics: method COMPARABLE, 2012 REAL_SOURCE_READY, 2026 NOT_PUBLISHED, comparisonAllowed false", () => {
    for (const id of ["application-count", "unique-applied-strings", "idn-applications"] as const) {
      const resolved = resolveMetricEligibility(id)!;
      expect(resolved.methodReadiness).toBe("COMPARABLE");
      expect(resolved.claimReadiness.round2012).toBe("REAL_SOURCE_READY");
      expect(resolved.claimReadiness.round2026).toBe("NOT_PUBLISHED");
      expect(resolved.comparisonAllowed).toBe(false);
      expect(() => assertMetricComparable(id)).not.toThrow();
      expect(() => assertCrossRoundDeltaAllowed(id)).toThrow();
    }
  });

  it("allows cross-round delta only when method COMPARABLE and both rounds REAL_SOURCE_READY", () => {
    expect(isCrossRoundComparisonAllowed("COMPARABLE", "REAL_SOURCE_READY", "REAL_SOURCE_READY")).toBe(true);
    expect(isCrossRoundComparisonAllowed("COMPARABLE", "REAL_SOURCE_READY", "NOT_PUBLISHED")).toBe(false);
    expect(isCrossRoundComparisonAllowed("PARTIAL", "REAL_SOURCE_READY", "REAL_SOURCE_READY")).toBe(false);
  });

  it("treats identity-only returning participant as PARTIAL with cross-round method", () => {
    const entry = getMetricEligibility("returning-participant-identity");
    expect(entry?.methodReadiness).toBe("PARTIAL");
    expect(entry?.method).toContain("cross-round-identity");
  });

  it("blocks round-wide portfolio and category mix from COMPARABLE method readiness", () => {
    expect(getMetricEligibility("portfolio-concentration-round-wide")?.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(getMetricEligibility("category-mix")?.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(getMetricEligibility("contention-set-count")?.methodReadiness).toBe("BLOCKED_METHOD");
  });

  it("has unique metric ids", () => {
    const ids = METRIC_ELIGIBILITY_CATALOG.map((e) => e.metricId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
