"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ForecastAvailability } from "@/components/registry/forecast-link";
import { ForecastMethodologyDisclosure } from "@/components/registry/forecast-methodology-disclosure";
import { ForecastMiddleComparison } from "@/components/registry/forecast-middle-comparison";
import {
  FORECAST_LOCAL_PREVIEW_PAGE_SIZE,
  filterForecastPreviewRows,
  paginateForecastPreviewRows,
  sortForecastPreviewRows,
  type ForecastLocalPreviewRowView,
  type ForecastLocalPreviewSortDir,
  type ForecastLocalPreviewSortKey,
} from "@/lib/forecast-local-preview";
import type { ForecastCatalogView } from "@/lib/forecast-publication-candidate";
import { forecastDetailHref } from "@/lib/forecast-routes";

function toTableRows(catalog: ForecastCatalogView): ForecastLocalPreviewRowView[] {
  return catalog.strings.map((row) => ({
    stringLabel: row.stringLabel,
    extension: row.extension,
    measuredDomainCount: row.measuredDomainCount,
    conservative: row.scenarios?.low ?? null,
    expected: row.scenarios?.middle ?? null,
    optimistic: row.scenarios?.high ?? null,
    conversionStatus: row.status,
    statusNote: "",
    brandDesignationObserved: row.brandDesignationObserved,
    contested: row.contested,
    origins: row.origins,
    fromKnownExcluded: null,
    fromNormalizedApplication: null,
    sourceDetail: row.sourceDetail,
  }));
}

function formatCount(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

export function ForecastOverviewContent({
  catalog,
  accessLabel,
}: {
  catalog: ForecastCatalogView;
  /** Development-only banner. Omit for ordinary / production publication visitors. */
  accessLabel?: string;
}) {
  const availability: ForecastAvailability = useMemo(
    () => ({ enabled: true, labels: catalog.labelSet }),
    [catalog.labelSet],
  );
  const baseRows = useMemo(() => toTableRows(catalog), [catalog]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ForecastLocalPreviewSortKey>("expected");
  const [sortDir, setSortDir] = useState<ForecastLocalPreviewSortDir>("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => sortForecastPreviewRows(filterForecastPreviewRows(baseRows, query), sortKey, sortDir),
    [baseRows, query, sortKey, sortDir],
  );
  const paged = useMemo(
    () => paginateForecastPreviewRows(filtered, page, FORECAST_LOCAL_PREVIEW_PAGE_SIZE),
    [filtered, page],
  );

  const spotlight = filtered.slice(0, 5);

  function toggleSort(next: ForecastLocalPreviewSortKey) {
    if (sortKey === next) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDir(next === "extension" ? "asc" : "desc");
    }
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-[#f4f7f8]" data-testid="forecast-overview-page">
      <header className="border-b border-white/10 bg-[#101923] text-white">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center px-4 sm:px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-[0.2em]">
            FORGE<span className="text-[#72dfb4]">/</span>FORWARD
          </Link>
        </div>
      </header>
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-[1480px] px-2 sm:px-6">
          <nav aria-label="Hub business navigation" className="flex flex-wrap gap-1">
            <Link href="/" className="px-3 py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">
              Command Center
            </Link>
            <span className="border-b-2 border-[#006a56] px-3 py-3 text-sm font-semibold text-[#006a56]">
              Forecast (experimental)
            </span>
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {accessLabel ? (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
            {accessLabel}
          </p>
        ) : null}
        <h1
          className={`text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl ${
            accessLabel ? "mt-2" : ""
          }`}
        >
          {catalog.heading}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Explore observed domain-name matches and experimental registration scenarios for proposed
          2026 extensions.
        </p>

        <section
          className="mt-5 grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-4"
          data-testid="forecast-overview-summary"
        >
          <SummaryStat label="Measured strings" value={catalog.summary.measuredStringCount} />
          <SummaryStat label="With scenarios" value={catalog.summary.estimatedStringCount} />
          <SummaryStat
            label="Scenarios not recommended"
            value={catalog.summary.conversionNotRecommendedCount}
          />
          <SummaryStat label="Zero measured matches" value={catalog.summary.zeroMeasuredDemandCount} />
        </section>

        <div className="mt-5">
          <ForecastMethodologyDisclosure catalog={catalog} />
        </div>

        <section className="mt-5 rounded border border-slate-200 bg-white p-4" data-testid="forecast-overview-spotlight">
          <h2 className="text-sm font-bold text-slate-950">
            Middle scenario comparison (current listing)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            First rows of the current search and sort, drawn on one shared Middle scale. Measured
            matches are shown separately; missing estimates are not charted as zero.
          </p>
          <div className="mt-4">
            <ForecastMiddleComparison
              availability={availability}
              rows={spotlight.map((row) => ({
                stringLabel: row.stringLabel,
                extension: row.extension,
                middle: row.expected,
                measuredDomainCount: row.measuredDomainCount,
              }))}
            />
          </div>
        </section>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-semibold text-slate-900">Search extension</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="wdo or .wdo"
              className="w-full min-w-[16rem] rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#006a56] focus:outline-none focus:ring-1 focus:ring-[#006a56]"
              data-testid="forecast-overview-search"
            />
          </label>
          <p className="text-xs text-slate-600" data-testid="forecast-overview-result-count">
            {filtered.length.toLocaleString("en-US")} matching · page {paged.page} of {paged.pageCount}
          </p>
        </div>

        <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full border-collapse text-left text-sm" data-testid="forecast-overview-table">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <SortHeader label="Extension" active={sortKey === "extension"} dir={sortDir} onClick={() => toggleSort("extension")} />
                <SortHeader label="Measured matches" active={sortKey === "measured"} dir={sortDir} onClick={() => toggleSort("measured")} align="right" />
                <th className="px-3 py-2 text-right font-semibold">Low</th>
                <SortHeader label="Middle" active={sortKey === "expected"} dir={sortDir} onClick={() => toggleSort("expected")} align="right" />
                <th className="px-3 py-2 text-right font-semibold">High</th>
                <th className="px-3 py-2 font-semibold">Forecast availability</th>
                <th className="px-3 py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-600" data-testid="forecast-overview-empty">
                    No extensions match this search.
                  </td>
                </tr>
              ) : (
                paged.rows.map((row) => (
                  <tr
                    key={row.stringLabel}
                    className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40"
                    data-testid={`forecast-overview-row-${row.stringLabel}`}
                  >
                    <td className="px-3 py-2 font-mono font-semibold">
                      <Link
                        href={forecastDetailHref(row.stringLabel) ?? "#"}
                        className="text-[#006a56] underline-offset-2 hover:underline"
                      >
                        {row.extension}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.measuredDomainCount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.conservative)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.expected)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.optimistic)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.conversionStatus === "estimated" ? "Scenarios available" : "Scenarios not recommended"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.sourceDetail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-500 sm:hidden">Scroll sideways to see all columns.</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            disabled={paged.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="forecast-overview-prev"
          >
            Previous
          </button>
          <p className="text-xs text-slate-600">
            Showing {paged.rows.length} of {filtered.length} · {FORECAST_LOCAL_PREVIEW_PAGE_SIZE} per page
          </p>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            disabled={paged.page >= paged.pageCount}
            onClick={() => setPage((p) => Math.min(paged.pageCount, p + 1))}
            data-testid="forecast-overview-next"
          >
            Next
          </button>
        </div>
      </main>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{value.toLocaleString("en-US")}</p>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: ForecastLocalPreviewSortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${
          active ? "text-[#006a56]" : "text-slate-600"
        }`}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span aria-hidden className="text-[10px]">
          {active ? (dir === "asc" ? "▲" : "▼") : "◇"}
        </span>
      </button>
    </th>
  );
}
