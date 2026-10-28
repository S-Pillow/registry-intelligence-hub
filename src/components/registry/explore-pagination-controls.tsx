"use client";

import {
  EXPLORE_PAGE_SIZE_OPTIONS,
  formatExplorePageRange,
  type ExplorePageSize,
  type ExplorePageWindow,
} from "@/lib/explore-pagination";

/**
 * Shared Explore full-result pagination chrome (EXPLORE-PAGING-1 contract).
 * Suppress when totalPages <= 1 so small grains do not show empty page chrome.
 */
export function ExplorePaginationControls({
  window,
  pageSize,
  onPageChange,
  onPageSizeChange,
  testIdPrefix = "explore-pagination",
}: {
  window: ExplorePageWindow;
  pageSize: ExplorePageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: ExplorePageSize) => void;
  testIdPrefix?: string;
}) {
  if (window.totalPages <= 1) return null;

  return (
    <nav
      className="flex flex-col gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      aria-label="Explore results pagination"
      data-testid={testIdPrefix}
    >
      <p className="text-sm text-slate-800" data-testid={`${testIdPrefix}-status`} aria-live="polite">
        {formatExplorePageRange(window)}
        <span className="text-slate-600">
          {" "}
          · Page {window.page} of {window.totalPages}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-700">
          Page size{" "}
          <select
            aria-label="Results page size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as ExplorePageSize)}
            className="ml-1 rounded-md border border-slate-400 px-2 py-1.5 text-sm"
            data-testid={`${testIdPrefix}-page-size`}
          >
            {EXPLORE_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-400 px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onPageChange(Math.max(1, window.page - 1))}
          disabled={!window.hasPrev}
          aria-label="Previous page"
          data-testid={`${testIdPrefix}-prev`}
        >
          Previous
        </button>
        <label className="text-sm text-slate-700">
          Page{" "}
          <select
            aria-label="Current page"
            aria-current="page"
            value={window.page}
            onChange={(e) => onPageChange(Number(e.target.value))}
            className="ml-1 rounded-md border border-slate-400 px-2 py-1.5 text-sm tabular-nums"
            data-testid={`${testIdPrefix}-page-select`}
          >
            {Array.from({ length: window.totalPages }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-400 px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onPageChange(window.page + 1)}
          disabled={!window.hasNext}
          aria-label="Next page"
          data-testid={`${testIdPrefix}-next`}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
