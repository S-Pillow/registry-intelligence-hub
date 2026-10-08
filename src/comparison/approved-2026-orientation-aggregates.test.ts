import { describe, expect, it } from "vitest";
import { APPROVED_2026_ORIENTATION_AGGREGATES } from "./approved-2026-orientation-aggregates";

describe("APPROVED_2026_ORIENTATION_AGGREGATES", () => {
  it("pins Reveal Day official designation orientation facts", () => {
    expect(APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications).toBe(21);
    expect(APPROVED_2026_ORIENTATION_AGGREGATES.brandApplications).toBe(333);
    expect(APPROVED_2026_ORIENTATION_AGGREGATES.communityApplications).toBe(16);
    expect(APPROVED_2026_ORIENTATION_AGGREGATES.geographicApplicationsSelfIdentified).toBe(15);
    expect(APPROVED_2026_ORIENTATION_AGGREGATES.variantApplications).toBe(9);
  });
});
