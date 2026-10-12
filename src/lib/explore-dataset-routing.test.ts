import { describe, expect, it } from "vitest";
import { shouldRenderHistoricalExploreSurface } from "@/lib/explore-dataset-routing";

describe("HIST-EXPLORE-ROUTING-1 dataset selection precedence", () => {
  it("selects historical Explore when view=explore and dataset=2012-historical", () => {
    expect(
      shouldRenderHistoricalExploreSurface({
        view: "explore",
        exploreDataset: "2012-historical",
      }),
    ).toBe(true);
  });

  it("does not select historical for plain Explore (default/promoted path)", () => {
    expect(shouldRenderHistoricalExploreSurface({ view: "explore" })).toBe(false);
    expect(
      shouldRenderHistoricalExploreSurface({
        view: "explore",
        exploreDataset: "2026-rehearsal",
      }),
    ).toBe(false);
    expect(
      shouldRenderHistoricalExploreSurface({
        view: "explore",
        exploreDataset: undefined,
      }),
    ).toBe(false);
  });

  it("does not select historical for non-explore views even with the dataset param", () => {
    expect(
      shouldRenderHistoricalExploreSurface({
        view: "command",
        exploreDataset: "2012-historical",
      }),
    ).toBe(false);
  });
});
