import { describe, expect, it } from "vitest";
import {
  savedComparePromotionFromParams,
  savedExploreComparePromotion,
  savedResearchBriefingEligible,
  savedResearchComparePromotion,
} from "./registry-data";

describe("saved research promotion", () => {
  it("allows Compare selected and briefing for a valid saved comparison", () => {
    const params = { type: "organizations", ids: "Atlas Digital,Northstar Group" };
    const compare = savedComparePromotionFromParams(params, "test");
    expect(compare.eligible).toBe(true);
    expect(compare.href).toContain("/compare?");
    expect(compare.href).toContain("Atlas+Digital");

    const entry = { kind: "compare-config" as const, name: "Two orgs", params };
    expect(savedResearchComparePromotion(entry).eligible).toBe(true);
    expect(savedResearchBriefingEligible(entry).eligible).toBe(true);
  });

  it("blocks promotion when fewer than two entities are saved", () => {
    const params = { type: "organizations", ids: "Atlas Digital" };
    const compare = savedComparePromotionFromParams(params, "test");
    expect(compare.eligible).toBe(false);
    expect(compare.disabledReason).toMatch(/at least two/i);

    const entry = { kind: "compare-config" as const, name: "One org", params };
    expect(savedResearchBriefingEligible(entry).eligible).toBe(false);
  });

  it("derives Compare selected from an explore cohort with two organizations when browsing organizations", () => {
    const params = { entity: "organizations", q: "atlas" };
    const promotion = savedExploreComparePromotion(params, "test");
    expect(promotion.eligible).toBe(true);
    expect(promotion.href).toContain("type=organizations");
  });

  it("blocks Compare selected for strings browse", () => {
    const promotion = savedExploreComparePromotion({ entity: "strings", q: "shop" }, "test");
    expect(promotion.eligible).toBe(false);
    expect(promotion.disabledReason).toMatch(/Strings browse/i);
  });
});
