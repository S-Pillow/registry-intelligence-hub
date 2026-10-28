"use client";

import Link from "next/link";

export type ExploreDatasetSelection = "2026" | "2012-historical";

/**
 * Shared Explore dataset switcher — same interaction grammar for promoted 2026 and
 * historical 2012 surfaces without implying identical schemas.
 */
export function ExploreDatasetSwitcher({
  selected,
  href2026,
  href2012,
  className = "",
}: {
  selected: ExploreDatasetSelection;
  href2026: string;
  href2012: string;
  className?: string;
}) {
  const selected2026 = selected === "2026";
  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-800 ${className}`}
      data-testid="explore-dataset-switcher"
      role="navigation"
      aria-label="Explore dataset"
    >
      <span className="text-slate-600">Dataset:</span>
      <Link
        href={href2026}
        aria-current={selected2026 ? "page" : undefined}
        data-testid="explore-dataset-2026"
        className={`rounded-lg px-3 py-1.5 ${selected2026 ? "bg-[#007d65] text-white" : "border border-slate-300 hover:bg-slate-50"}`}
      >
        2026 applications
      </Link>
      <Link
        href={href2012}
        aria-current={!selected2026 ? "page" : undefined}
        data-testid="explore-dataset-2012"
        className={`rounded-lg px-3 py-1.5 ${!selected2026 ? "bg-[#007d65] text-white" : "border border-slate-300 hover:bg-slate-50"}`}
      >
        2012 historical
      </Link>
    </div>
  );
}
