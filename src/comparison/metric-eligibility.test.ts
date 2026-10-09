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

  it("keeps application/idn comparable for official-aggregate channel while unique strings stay coverage-blocked", () => {
    for (const id of ["application-count", "idn-applications"] as const) {
      const resolved = resolveMetricEligibility(id)!;
      expect(resolved.methodReadiness).toBe("COMPARABLE");
      expect(resolved.claimReadiness.round2012).toBe("REAL_SOURCE_READY");
      expect(resolved.claimReadiness.round2026).toBe("NOT_PUBLISHED");
      expect(resolved.comparisonAllowed).toBe(false);
      expect(() => assertMetricComparable(id)).not.toThrow();
      expect(() => assertCrossRoundDeltaAllowed(id)).toThrow();
    }
    const unique = resolveMetricEligibility("unique-applied-strings")!;
    expect(unique.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(unique.comparisonAllowed).toBe(false);
    expect(() => assertMetricComparable("unique-applied-strings")).toThrow();
  });

  it("allows cross-round delta only when method COMPARABLE and both rounds REAL_SOURCE_READY", () => {
    expect(isCrossRoundComparisonAllowed("COMPARABLE", "REAL_SOURCE_READY", "REAL_SOURCE_READY")).toBe(true);
    expect(isCrossRoundComparisonAllowed("COMPARABLE", "REAL_SOURCE_READY", "NOT_PUBLISHED")).toBe(false);
    expect(isCrossRoundComparisonAllowed("PARTIAL", "REAL_SOURCE_READY", "REAL_SOURCE_READY")).toBe(false);
  });

  it("keeps complete returning blocked; confirmed-subset returning is limitation-qualified", () => {
    const complete = getMetricEligibility("returning-participant-identity");
    expect(complete?.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(complete?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(complete?.method).toBe("cross-round-participation-intelligence/1.0.0");

    const subset = getMetricEligibility("confirmed-returning-organizations");
    expect(subset?.methodReadiness).toBe("PARTIAL");
    expect(subset?.crossRoundStatus).toBe("READY_WITH_LIMITATION");

    const newOrgs = getMetricEligibility("new-organizations");
    expect(newOrgs?.methodReadiness).toBe("BLOCKED_SOURCE");
  });

  it("blocks round-wide portfolio, category mix, and 2012 contention set entity count", () => {
    expect(getMetricEligibility("portfolio-concentration-round-wide")?.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(getMetricEligibility("category-mix")?.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(getMetricEligibility("contention-set-count")?.methodReadiness).toBe("BLOCKED_METHOD");
    expect(getMetricEligibility("organization-round-count")?.methodReadiness).toBe("BLOCKED_SOURCE");
  });

  it("has unique metric ids", () => {
    const ids = METRIC_ELIGIBILITY_CATALOG.map((e) => e.metricId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
