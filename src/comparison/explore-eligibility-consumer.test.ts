import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPLORE_ELIGIBILITY_CATALOG_VERSION,
  exploreCrossRoundComparisonAllowed,
  getExploreHistoricalIntelligencePolicy,
} from "./explore-eligibility-consumer";

describe("Explore eligibility catalog consumption", () => {
  it("resolves historical intelligence policy from metric-eligibility-catalog, not local gates", () => {
    const policy = getExploreHistoricalIntelligencePolicy();
    expect(policy.catalogVersion).toBe(EXPLORE_ELIGIBILITY_CATALOG_VERSION);
    expect(policy.allMetricsDenyReal2026Identity).toBe(true);
    expect(exploreCrossRoundComparisonAllowed("application-count")).toBe(false);
  });

  it("Explore page imports the catalog consumer module (regression guard)", () => {
    const explorePageSource = readFileSync(
      resolve("src/components/registry/command-center.tsx"),
      "utf8",
    );
    expect(explorePageSource).toContain("@/comparison/explore-eligibility-consumer");
    expect(explorePageSource).toContain("exploreHistoricalComparisonDisclosure");
    expect(explorePageSource).not.toMatch(/comparisonAllowed\s*=\s*false/);
  });
});
