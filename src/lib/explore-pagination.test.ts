import { describe, expect, it } from "vitest";
import {
  clampExplorePage,
  explorePageWindow,
  formatExplorePageRange,
  sliceExplorePage,
} from "@/lib/explore-pagination";

describe("explore pagination helpers", () => {
  it("computes first, second, and last page ranges for 1614 / 100", () => {
    const first = explorePageWindow(1614, 1, 100);
    expect(first.totalPages).toBe(17);
    expect(first.rangeStart).toBe(1);
    expect(first.rangeEnd).toBe(100);
    expect(first.hasPrev).toBe(false);
    expect(first.hasNext).toBe(true);
    expect(formatExplorePageRange(first)).toBe("Showing 1–100 of 1,614");

    const second = explorePageWindow(1614, 2, 100);
    expect(second.rangeStart).toBe(101);
    expect(second.rangeEnd).toBe(200);

    const last = explorePageWindow(1614, 17, 100);
    expect(last.rangeStart).toBe(1601);
    expect(last.rangeEnd).toBe(1614);
    expect(last.hasNext).toBe(false);
    expect(last.hasPrev).toBe(true);
    expect(formatExplorePageRange(last)).toBe("Showing 1,601–1,614 of 1,614");
  });

  it("clamps invalid pages safely", () => {
    expect(clampExplorePage(0, 1614, 100)).toBe(1);
    expect(clampExplorePage(-3, 1614, 100)).toBe(1);
    expect(clampExplorePage(99, 1614, 100)).toBe(17);
    expect(clampExplorePage(2, 0, 100)).toBe(1);
    expect(clampExplorePage(5, 50, 100)).toBe(1);
  });

  it("slices the requested page from a full result array", () => {
    const items = Array.from({ length: 1614 }, (_, i) => i + 1);
    expect(sliceExplorePage(items, 1, 100)).toEqual(items.slice(0, 100));
    expect(sliceExplorePage(items, 2, 100)).toEqual(items.slice(100, 200));
    expect(sliceExplorePage(items, 17, 100)).toEqual(items.slice(1600, 1614));
  });

  it("uses filtered totals for ranges", () => {
    const w = explorePageWindow(237, 1, 100);
    expect(formatExplorePageRange(w)).toBe("Showing 1–100 of 237");
    expect(w.totalPages).toBe(3);
  });
});
