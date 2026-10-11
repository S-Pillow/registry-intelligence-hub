/** Pure pagination helpers for Explore full-result paging (EXPLORE-PAGING-1). */

export const EXPLORE_DEFAULT_PAGE_SIZE = 100;
export const EXPLORE_PAGE_SIZE_OPTIONS = [50, 100, 250] as const;
export type ExplorePageSize = (typeof EXPLORE_PAGE_SIZE_OPTIONS)[number];

export type ExplorePageWindow = {
  total: number;
  pageSize: number;
  page: number;
  totalPages: number;
  startIndex: number; // 0-based inclusive
  endIndex: number; // 0-based exclusive
  rangeStart: number; // 1-based inclusive display
  rangeEnd: number; // 1-based inclusive display
  hasPrev: boolean;
  hasNext: boolean;
};

/** Clamp page into [1, totalPages], or 1 when there are no results. */
export function clampExplorePage(page: number, total: number, pageSize: number): number {
  const size = Math.max(1, pageSize);
  const totalPages = total <= 0 ? 0 : Math.ceil(total / size);
  if (totalPages <= 0) return 1;
  if (!Number.isFinite(page) || page < 1) return 1;
  if (page > totalPages) return totalPages;
  return Math.floor(page);
}

export function explorePageWindow(
  total: number,
  page: number,
  pageSize: number = EXPLORE_DEFAULT_PAGE_SIZE,
): ExplorePageWindow {
  const size = Math.max(1, Math.floor(pageSize));
  const safeTotal = Math.max(0, Math.floor(total));
  const totalPages = safeTotal <= 0 ? 0 : Math.ceil(safeTotal / size);
  const safePage = clampExplorePage(page, safeTotal, size);
  const startIndex = safeTotal === 0 ? 0 : (safePage - 1) * size;
  const endIndex = Math.min(safeTotal, startIndex + size);
  return {
    total: safeTotal,
    pageSize: size,
    page: safePage,
    totalPages,
    startIndex,
    endIndex,
    rangeStart: safeTotal === 0 ? 0 : startIndex + 1,
    rangeEnd: endIndex,
    hasPrev: safePage > 1 && totalPages > 0,
    hasNext: totalPages > 0 && safePage < totalPages,
  };
}

export function formatExplorePageRange(window: ExplorePageWindow): string {
  if (window.total === 0) return "Showing 0 of 0";
  return `Showing ${window.rangeStart.toLocaleString()}–${window.rangeEnd.toLocaleString()} of ${window.total.toLocaleString()}`;
}

export function sliceExplorePage<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const window = explorePageWindow(items.length, page, pageSize);
  return items.slice(window.startIndex, window.endIndex);
}
