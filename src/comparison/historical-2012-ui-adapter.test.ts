import { describe, expect, it } from "vitest";
import fixture from "@/data/fixtures/registry-applications.json";
import { APPROVED_2012_BASELINE } from "./approved-2012-baseline";
import { buildCommandCenterRoundPulse, buildRevealDayGlanceMetrics, isMetricGatedForUi } from "./historical-2012-ui-adapter";

describe("historical-2012-ui-adapter", () => {
  it("uses approved 2012 Reveal Day denominators for comparable glance metrics", () => {
    const glance = buildRevealDayGlanceMetrics(fixture.applications);
    const apps = glance.find((m) => m.metricId === "application-count");
    expect(apps?.baseline2012).toBe(APPROVED_2012_BASELINE.applications);
    expect(apps?.rehearsalValue).toBe(12);
    expect(apps?.readiness).toBe("COMPARABLE");
  });

  it("does not present organization round count as comparable", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const orgs = pulse.find((m) => m.metricId === "organization-round-count");
    expect(orgs?.readiness).toBe("BLOCKED_COVERAGE");
    expect(orgs?.deltaLabel).toMatch(/not approved/i);
  });

  it("blocks contention set headline comparison", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const contention = pulse.find((m) => m.metricId === "contention-set-count");
    expect(contention?.readiness).toBe("BLOCKED_METHOD");
  });

  it("flags gated metrics for UI", () => {
    expect(isMetricGatedForUi("category-mix")).toBe(true);
    expect(isMetricGatedForUi("application-count")).toBe(false);
  });
});
