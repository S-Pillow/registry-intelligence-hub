import { describe, expect, it } from "vitest";
import { METRIC_ELIGIBILITY_CATALOG, assertMetricComparable, getMetricEligibility } from "./metric-eligibility";

describe("metric-eligibility catalog", () => {
  it("defines post-Reveal lifecycle metrics as BLOCKED_SOURCE", () => {
    const blocked = [
      "returning-delegated-operator",
      "returning-successful-applicant",
      "historical-operator-track-record",
    ];
    for (const id of blocked) {
      expect(getMetricEligibility(id)?.readiness).toBe("BLOCKED_SOURCE");
    }
  });

  it("treats identity-only returning participant as PARTIAL with cross-round method", () => {
    const entry = getMetricEligibility("returning-participant-identity");
    expect(entry?.readiness).toBe("PARTIAL");
    expect(entry?.method).toContain("cross-round-identity");
  });

  it("blocks round-wide portfolio and category mix from COMPARABLE", () => {
    expect(getMetricEligibility("portfolio-concentration-round-wide")?.readiness).toBe("BLOCKED_COVERAGE");
    expect(getMetricEligibility("category-mix")?.readiness).toBe("BLOCKED_COVERAGE");
    expect(getMetricEligibility("contention-set-count")?.readiness).toBe("BLOCKED_METHOD");
  });

  it("allows approved count metrics to be COMPARABLE", () => {
    for (const id of ["application-count", "unique-applied-strings", "idn-applications"]) {
      expect(() => assertMetricComparable(id)).not.toThrow();
    }
  });

  it("has unique metric ids", () => {
    const ids = METRIC_ELIGIBILITY_CATALOG.map((e) => e.metricId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
