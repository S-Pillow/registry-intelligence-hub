"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_EXPLORE_FILTERS_V2,
  filterBrowserApplicationsV2,
  localResultCountV2,
  type ExploreFilterStateV2,
} from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { CoverageDisclosureV2 } from "@/components/registry/coverage-disclosure-v2";
import {
  EXPLORE_DEFAULT_PAGE_SIZE,
  EXPLORE_PAGE_SIZE_OPTIONS,
  clampExplorePage,
  explorePageWindow,
  formatExplorePageRange,
  type ExplorePageSize,
} from "@/lib/explore-pagination";
import { applicantProfileHref } from "@/lib/applicant-intelligence";
import { hubPath } from "@/lib/hub-paths";
import { ExploreDatasetSwitcher } from "@/components/registry/explore-dataset-shell";

export function ExploreContentV2({
  document,
  initial,
}: {
  document: RegistryApplicationsDocumentV2;
  initial?: { q?: string; ids?: string; region?: string; idn?: string };
}) {
  const [filters, setFilters] = useState<ExploreFilterStateV2>(() => ({
    ...DEFAULT_EXPLORE_FILTERS_V2,
    q: initial?.q ?? "",
    ids: initial?.ids ?? "",
    region: initial?.region && initial.region !== "all" ? initial.region : "all",
    idn: initial?.idn && initial.idn !== "all" ? initial.idn : "all",
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ExplorePageSize>(EXPLORE_DEFAULT_PAGE_SIZE);

  const matches = useMemo(
    () => filterBrowserApplicationsV2(document.applications, filters),
    [document.applications, filters],
  );
  const count = localResultCountV2(matches);
  const regions = useMemo(
    () => [...new Set(document.applications.map((a) => a.region))].sort(),
    [document.applications],
  );

  // Adjust out-of-range page while rendering when the filtered set shrinks.
  const safePage = clampExplorePage(page, matches.length, pageSize);
  if (safePage !== page) {
    setPage(safePage);
  }
  const window = explorePageWindow(matches.length, safePage, pageSize);
  const pageItems = useMemo(
    () => matches.slice(window.startIndex, window.endIndex),
    [matches, window.startIndex, window.endIndex],
  );

  function updateFilters(updater: (f: ExploreFilterStateV2) => ExploreFilterStateV2) {
    setFilters((f) => updater(f));
    setPage(1);
  }

  return (
    <section data-testid="explore-content-v2" className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
          Explore
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Explore registry intelligence</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Search all {document.observedApplicationRecords.toLocaleString("en-US")} application
          records currently represented in RIH. ICANN reports{" "}
          {document.officialApplications.toLocaleString("en-US")} applications; one
          administrative-check record is not represented as a normal application row.{" "}
          <Link
            href="/data-health"
            className="font-semibold text-[#006a56] underline underline-offset-2"
          >
            Data &amp; methodology
          </Link>
        </p>
      </div>

      <ExploreDatasetSwitcher
        selected="2026"
        href2026={hubPath("/explore")}
        href2012={`${hubPath("/explore")}?dataset=2012-historical`}
      />

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search applied string, applicant, or application id"
          value={filters.q}
          onChange={(e) => updateFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Search applied string, applicant, id…"
          className="h-10 min-w-[16rem] flex-1 rounded-lg border border-slate-400 px-3 text-sm"
          data-testid="explore-v2-search"
        />
        <select
          aria-label="Filter by region"
          value={filters.region}
          onChange={(e) => updateFilters((f) => ({ ...f, region: e.target.value }))}
          className="h-10 rounded-lg border border-slate-400 px-2 text-sm"
          data-testid="explore-v2-region"
        >
          <option value="all">All regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by IDN designation"
          value={filters.idn}
          onChange={(e) => updateFilters((f) => ({ ...f, idn: e.target.value }))}
          className="h-10 rounded-lg border border-slate-400 px-2 text-sm"
          data-testid="explore-v2-idn"
        >
          <option value="all">IDN: all</option>
          <option value="idn">IDN</option>
          <option value="ascii">ASCII</option>
        </select>
      </div>

      <CoverageDisclosureV2
        document={document}
        matchingObservedRecords={count.matchingObservedRecords}
      />

      <p aria-live="polite" className="text-sm font-bold text-slate-900" data-testid="explore-v2-result-count">
        {count.matchingObservedRecords} matching RIH observed records
        {" · "}
        {document.observedApplicationRecords} represented in RIH
        {" · "}
        official {document.officialApplications}
      </p>

      <ul className="divide-y rounded-lg border border-slate-200 bg-white" data-testid="explore-v2-results">
        {pageItems.map((app) => (
          <li
            key={app.applicationId}
            className="px-3 py-2 text-sm"
            data-testid={`explore-v2-row-${app.applicationId}`}
          >
            <strong>.{app.appliedString.label}</strong>
            <span className="mt-0.5 block text-slate-700">
              {app.applicationId} ·{" "}
              <Link
                href={applicantProfileHref(app.applicant)}
                className="font-medium text-[#006a56] underline-offset-2 hover:underline"
                data-testid="explore-v2-applicant-profile"
              >
                {app.applicant}
              </Link>{" "}
              · {app.country} · {app.region} · {app.applicationStatus} · {app.processingStage} ·{" "}
              {app.applicationType}
              {app.designations.idn ? " · IDN" : ""}
              {app.designations.brand ? " · Brand" : ""}
              {app.designations.community ? " · Community" : ""}
              {app.designations.geoSelfDesignated ? " · Geographic" : ""}
            </span>
          </li>
        ))}
      </ul>

      {matches.length > 0 ? (
        <nav
          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          aria-label="Explore results pagination"
          data-testid="explore-v2-pagination"
        >
          <p className="text-sm text-slate-800" data-testid="explore-v2-page-status" aria-live="polite">
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
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as ExplorePageSize);
                  setPage(1);
                }}
                className="ml-1 rounded-md border border-slate-400 px-2 py-1.5 text-sm"
                data-testid="explore-v2-page-size"
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!window.hasPrev}
              aria-label="Previous page"
              data-testid="explore-v2-prev"
            >
              Previous
            </button>
            <label className="text-sm text-slate-700">
              Page{" "}
              <select
                aria-label="Current page"
                aria-current="page"
                value={window.page}
                onChange={(e) => setPage(Number(e.target.value))}
                className="ml-1 rounded-md border border-slate-400 px-2 py-1.5 text-sm tabular-nums"
                data-testid="explore-v2-page-select"
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
              onClick={() => setPage((p) => p + 1)}
              disabled={!window.hasNext}
              aria-label="Next page"
              data-testid="explore-v2-next"
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
