import { describe, expect, it } from "vitest";
import { summarizeChangeSinceVisit } from "./saved-change-summary";

const fixtureChangedAt = "2026-09-16T14:07:32Z";

describe("summarizeChangeSinceVisit", () => {
  it("reports no material change when the fixture and result count are both unchanged", () => {
    const summary = summarizeChangeSinceVisit({
      lastOpenedAt: "2026-09-18T10:00:00Z",
      recordedCount: 12,
      currentCount: 12,
      fixtureChangedAt,
    });

    expect(summary.hasChanged).toBe(false);
    expect(summary.hasFixtureUpdate).toBe(false);
    expect(summary.hasCountDrift).toBe(false);
    expect(summary.lastMaterialChangeAt).toBe(fixtureChangedAt);
    expect(summary.headline).toBe("No material change since your last visit");
    expect(summary.detail).toContain("steady at 12");
  });

  it("flags a fixture update when the fixture changed after the last visit", () => {
    const summary = summarizeChangeSinceVisit({
      lastOpenedAt: "2026-09-10T00:00:00Z",
      recordedCount: 12,
      currentCount: 12,
      fixtureChangedAt,
    });

    expect(summary.hasChanged).toBe(true);
    expect(summary.hasFixtureUpdate).toBe(true);
    expect(summary.hasCountDrift).toBe(false);
    expect(summary.lastMaterialChangeAt).toBe(fixtureChangedAt);
    expect(summary.headline).toBe("Material change since your last visit");
    expect(summary.detail).toContain("Fixture snapshot updated");
    expect(summary.detail).toContain("not live monitoring");
  });

  it("flags a result-count drift independently of fixture timing", () => {
    const summary = summarizeChangeSinceVisit({
      lastOpenedAt: "2026-09-18T10:00:00Z",
      recordedCount: 8,
      currentCount: 5,
      fixtureChangedAt,
    });

    expect(summary.hasChanged).toBe(true);
    expect(summary.hasFixtureUpdate).toBe(false);
    expect(summary.hasCountDrift).toBe(true);
    expect(summary.detail).toContain("Result count moved from 8 to 5");
  });

  it("reports both kinds of change together without conflating them", () => {
    const summary = summarizeChangeSinceVisit({
      lastOpenedAt: "2026-09-01T00:00:00Z",
      recordedCount: 3,
      currentCount: 4,
      fixtureChangedAt,
    });

    expect(summary.hasFixtureUpdate).toBe(true);
    expect(summary.hasCountDrift).toBe(true);
    expect(summary.detail).toContain("Fixture snapshot updated");
    expect(summary.detail).toContain("Result count moved from 3 to 4");
  });

  it("labels the count as supporting records, never a bare result/entity count, when subject is supporting-record", () => {
    const steady = summarizeChangeSinceVisit({
      lastOpenedAt: "2026-09-18T10:00:00Z",
      recordedCount: 4,
      currentCount: 4,
      fixtureChangedAt,
      subject: "supporting-record",
    });
    expect(steady.detail).toContain("Supporting records unchanged at 4");
    expect(steady.detail).not.toContain("Result count");

    const drifted = summarizeChangeSinceVisit({
      lastOpenedAt: "2026-09-01T00:00:00Z",
      recordedCount: 4,
      currentCount: 6,
      fixtureChangedAt,
      subject: "supporting-record",
    });
    expect(drifted.detail).toContain("Supporting records changed from 4 to 6");
    expect(drifted.detail).not.toContain("Result count");
  });
});
