import { describe, expect, it } from "vitest";
import fixture from "@/data/fixtures/registry-applications.json";
import { APPROVED_2012_BASELINE } from "./approved-2012-baseline";
import {
  buildApproved2012HistoricalFacts,
  buildCommandCenterRoundPulse,
  buildRevealDayGlanceMetrics,
  isMetricGatedForUi,
} from "./historical-2012-ui-adapter";
import { assertCrossRoundDeltaAllowed } from "./metric-eligibility";

describe("historical-2012-ui-adapter", () => {
  it("returns structured 2012 facts with two-axis eligibility and comparisonAllowed false", () => {
    const facts = buildApproved2012HistoricalFacts();
    expect(facts).toHaveLength(3);
    const apps = facts.find((m) => m.metricId === "application-count");
    expect(apps).toMatchObject({
      value: APPROVED_2012_BASELINE.applications,
      roundId: "2012-reveal-day",
      methodReadiness: "COMPARABLE",
      claimReadiness: "REAL_SOURCE_READY",
      comparisonAllowed: false,
      sourceClassification: "ICANN_PRIMARY_ARCHIVED_COPY",
      sourceSnapshotId: "snap-2012-reveal-day-csv-v1",
    });
    expect(apps?.limitations.join(" ")).toMatch(/2026 round not published/i);
    for (const id of ["application-count", "unique-applied-strings", "idn-applications"]) {
      expect(() => assertCrossRoundDeltaAllowed(id)).toThrow(/Cross-round delta blocked/);
    }
  });

  it("does not expose naked baseline numbers — glance metrics are full HistoricalMetricFact objects", () => {
    const glance = buildRevealDayGlanceMetrics(fixture.applications);
    expect(glance.every((fact) => typeof fact.value === "number" && fact.metricId && fact.methodVersion)).toBe(true);
    expect(glance.find((m) => m.metricId === "unique-applied-strings")?.value).toBe(1409);
  });

  it("uses approved 2012 values in round pulse for the three swapped metrics without rehearsal deltas", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const apps = pulse.find((m) => m.metricId === "application-count");
    expect(apps?.value).toBe(1930);
    expect(apps?.historicalFact?.value).toBe(1930);
    expect(apps?.deltaLabel).toMatch(/Historical aggregate fact/i);
    expect(apps?.deltaLabel).toMatch(/2026 comparison pending publication/i);
    expect(apps?.deltaLabel).not.toMatch(/\+.*vs 2012/i);
    expect(apps?.comparisonAllowed).toBe(false);
  });

  it("does not present organization round count as comparable", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const orgs = pulse.find((m) => m.metricId === "organization-round-count");
    expect(orgs?.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(orgs?.deltaLabel).toMatch(/not approved/i);
  });

  it("blocks contention set headline comparison", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const contention = pulse.find((m) => m.metricId === "contention-set-count");
    expect(contention?.methodReadiness).toBe("BLOCKED_METHOD");
  });

  it("flags gated metrics for UI", () => {
    expect(isMetricGatedForUi("category-mix")).toBe(true);
    expect(isMetricGatedForUi("application-count")).toBe(false);
  });
});
