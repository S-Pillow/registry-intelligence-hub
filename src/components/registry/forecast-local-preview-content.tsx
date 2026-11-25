"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FORECAST_LOCAL_PREVIEW_PAGE_SIZE,
  filterForecastPreviewRows,
  formatUnknownBoolean,
  paginateForecastPreviewRows,
  sortForecastPreviewRows,
  type ForecastLocalPreviewSortDir,
  type ForecastLocalPreviewSortKey,
  type ForecastLocalPreviewViewModel,
} from "@/lib/forecast-local-preview";

function HubChrome() {
  return (
    <>
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
            <Link href="/forecast" className="px-3 py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">
              Forecast (experimental)
            </Link>
            <span className="border-b-2 border-[#006a56] px-3 py-3 text-sm font-semibold text-[#006a56]">
              Local forecast preview
            </span>
          </nav>
        </div>
      </div>
    </>
  );
}

function formatCount(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

export function ForecastLocalPreviewContent({ view }: { view: ForecastLocalPreviewViewModel }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ForecastLocalPreviewSortKey>("expected");
  const [sortDir, setSortDir] = useState<ForecastLocalPreviewSortDir>("desc");
  const [page, setPage] = useState(1);
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  const filtered = useMemo(
    () => sortForecastPreviewRows(filterForecastPreviewRows(view.rows, query), sortKey, sortDir),
    [view.rows, query, sortKey, sortDir],
  );

  const paged = useMemo(
    () => paginateForecastPreviewRows(filtered, page, FORECAST_LOCAL_PREVIEW_PAGE_SIZE),
    [filtered, page],
  );

  function onSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function toggleSort(next: ForecastLocalPreviewSortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      setSortDir(next === "extension" ? "asc" : "desc");
    }
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-[#f4f7f8]" data-testid="forecast-local-preview-page">
      <HubChrome />
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
          Local development preview
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {view.heading}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Offline analysis UI for the FCAST-05A experimental forecast preview. Not a production
          publication.
        </p>

        <section
          className="mt-5 grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-4"
          data-testid="forecast-local-preview-summary"
          aria-label="Forecast preview summary"
        >
          <SummaryStat label="Measured strings" value={view.summary.measuredStringCount} />
          <SummaryStat label="With experimental scenarios" value={view.summary.estimatedStringCount} />
          <SummaryStat
            label="Conversion not recommended"
            value={view.summary.conversionNotRecommendedCount}
          />
          <SummaryStat
            label="Zero measured demand"
            value={view.summary.zeroMeasuredDemandCount}
          />
        </section>

        <section
          className="mt-5 space-y-3 rounded border border-amber-200 bg-amber-50/70 p-4 text-sm text-slate-800"
          data-testid="forecast-local-preview-methodology"
        >
          <h2 className="text-sm font-bold text-slate-950">How to read these numbers</h2>
          <p>
            <strong>Measured demand</strong> counts existing domains whose second-level names equal
            or literally end with a proposed extension string.
          </p>
          <p>
            <strong>Estimated registrations</strong> apply experimental factors of{" "}
            {view.conversionFactors.conservative}, {view.conversionFactors.expected}, and{" "}
            {view.conversionFactors.optimistic} to that count for an approximately four-year
            scenario. These are not statistically validated market predictions.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              ActiveDNS source:{" "}
              <a
                className="font-medium text-[#006a56] underline"
                href="https://activedns.net/"
                target="_blank"
                rel="noreferrer"
              >
                https://activedns.net/
              </a>
            </li>
            <li>Snapshot date: November 7, 2026 ({view.snapshotDate})</li>
            <li>
              Reference TLDs:{" "}
              {view.referencePanelTlds.map((t) => `.${t}`).join(", ")} —{" "}
              <strong>.com and other TLDs are not represented</strong>
            </li>
            <li>Observed DNS domains are not the full registration market</li>
            <li>The application inventory is partially observed</li>
            <li>
              Brand, withdrawn, contested, and uncertain strings remain included as observed-demand
              candidates
            </li>
            <li>Suffix matching is literal, not a semantic or purchase-intent analysis</li>
          </ul>
          <p className="text-xs text-slate-600">{view.conversionNote}</p>
          <p className="text-xs text-slate-600">{view.attribution}</p>
        </section>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-semibold text-slate-900">Search extension</span>
            <input
              type="search"
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="wdo or .wdo"
              className="w-full min-w-[16rem] rounded border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm focus:border-[#006a56] focus:outline-none focus:ring-1 focus:ring-[#006a56]"
              data-testid="forecast-local-preview-search"
            />
          </label>
          <p className="text-xs text-slate-600" data-testid="forecast-local-preview-result-count">
            {filtered.length.toLocaleString("en-US")} matching · page {paged.page} of {paged.pageCount}
          </p>
        </div>

        <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full border-collapse text-left text-sm" data-testid="forecast-local-preview-table">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <SortHeader
                  label="Extension"
                  active={sortKey === "extension"}
                  dir={sortDir}
                  onClick={() => toggleSort("extension")}
                />
                <SortHeader
                  label="Measured suffix demand"
                  active={sortKey === "measured"}
                  dir={sortDir}
                  onClick={() => toggleSort("measured")}
                  align="right"
                />
                <th className="px-3 py-2 text-right font-semibold">Conservative</th>
                <SortHeader
                  label="Expected"
                  active={sortKey === "expected"}
                  dir={sortDir}
                  onClick={() => toggleSort("expected")}
                  align="right"
                />
                <th className="px-3 py-2 text-right font-semibold">Optimistic</th>
                <th className="px-3 py-2 font-semibold">Conversion status</th>
                <th className="px-3 py-2 font-semibold">Source detail</th>
                <th className="px-3 py-2 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-10 text-center text-slate-600"
                    data-testid="forecast-local-preview-empty"
                  >
                    No extensions match this search.
                  </td>
                </tr>
              ) : (
                paged.rows.map((row) => {
                  const open = openLabel === row.stringLabel;
                  return (
                    <tr
                      key={row.stringLabel}
                      className="border-t border-slate-100 align-top odd:bg-white even:bg-slate-50/40"
                      data-testid={`forecast-local-preview-row-${row.stringLabel}`}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-slate-950">
                        {row.extension}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {formatCount(row.measuredDomainCount)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {formatCount(row.conservative)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {formatCount(row.expected)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {formatCount(row.optimistic)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.conversionStatus === "estimated"
                          ? "Estimated"
                          : "Conversion not recommended"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{row.sourceDetail}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#006a56] underline"
                          aria-expanded={open}
                          onClick={() => setOpenLabel(open ? null : row.stringLabel)}
                          data-testid={`forecast-local-preview-detail-toggle-${row.stringLabel}`}
                        >
                          {open ? "Hide" : "Show"}
                        </button>
                        {open ? (
                          <dl
                            className="mt-2 space-y-1 text-xs text-slate-700"
                            data-testid={`forecast-local-preview-detail-${row.stringLabel}`}
                          >
                            <div>
                              <dt className="inline font-semibold">Brand designation: </dt>
                              <dd className="inline">
                                {formatUnknownBoolean(row.brandDesignationObserved)}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">Contested: </dt>
                              <dd className="inline">{formatUnknownBoolean(row.contested)}</dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">Origins: </dt>
                              <dd className="inline">
                                {(row.origins ?? []).length ? row.origins!.join(", ") : "Unknown"}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold">Note</dt>
                              <dd className="mt-0.5 text-slate-600">{row.statusNote}</dd>
                            </div>
                          </dl>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-40"
            disabled={paged.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="forecast-local-preview-prev"
          >
            Previous
          </button>
          <p className="text-xs text-slate-600">
            Showing {paged.rows.length} of {filtered.length} · {FORECAST_LOCAL_PREVIEW_PAGE_SIZE} per
            page
          </p>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-40"
            disabled={paged.page >= paged.pageCount}
            onClick={() => setPage((p) => Math.min(paged.pageCount, p + 1))}
            data-testid="forecast-local-preview-next"
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
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">
        {value.toLocaleString("en-US")}
      </p>
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
    <th className={`px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${
          active ? "text-[#006a56]" : "text-slate-600"
        }`}
      >
        <span>{label}</span>
        <span aria-hidden className="text-[10px]">
          {active ? (dir === "asc" ? "▲" : "▼") : "◇"}
        </span>
      </button>
    </th>
  );
}
