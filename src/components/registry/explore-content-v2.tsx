"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_EXPLORE_FILTERS_V2,
  filterBrowserApplicationsV2,
  localResultCountV2,
  UNSUPPORTED_EXPLORE_FACETS_V2,
  type ExploreFilterStateV2,
} from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { CoverageDisclosureV2 } from "@/components/registry/coverage-disclosure-v2";

export function ExploreContentV2({ document }: { document: RegistryApplicationsDocumentV2 }) {
  const [filters, setFilters] = useState<ExploreFilterStateV2>(DEFAULT_EXPLORE_FILTERS_V2);
  const matches = useMemo(
    () => filterBrowserApplicationsV2(document.applications, filters),
    [document.applications, filters],
  );
  const count = localResultCountV2(matches);
  const regions = useMemo(
    () => [...new Set(document.applications.map((a) => a.region))].sort(),
    [document.applications],
  );

  return (
    <section data-testid="explore-content-v2" className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
          Explore · Publication 2.x
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Explore registry applications</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Source-backed Application fields only. Organization, category, returning, and confidence
          are not available in Publication 2.0.0.
        </p>
      </div>

      <CoverageDisclosureV2
        document={document}
        matchingObservedRecords={count.matchingObservedRecords}
      />

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search applied string, applicant, or application id"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Search applied string, applicant, id…"
          className="h-10 min-w-[16rem] flex-1 rounded-lg border border-slate-400 px-3 text-sm"
        />
        <select
          aria-label="Filter by region"
          value={filters.region}
          onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}
          className="h-10 rounded-lg border border-slate-400 px-2 text-sm"
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
          onChange={(e) => setFilters((f) => ({ ...f, idn: e.target.value }))}
          className="h-10 rounded-lg border border-slate-400 px-2 text-sm"
        >
          <option value="all">IDN: all</option>
          <option value="idn">IDN</option>
          <option value="ascii">ASCII</option>
        </select>
      </div>

      <p className="text-xs text-slate-600" data-testid="explore-v2-gated-facets">
        Gated facets (not shown): {UNSUPPORTED_EXPLORE_FACETS_V2.join(", ")}
      </p>

      <p aria-live="polite" className="text-sm font-bold text-slate-900" data-testid="explore-v2-result-count">
        {count.matchingObservedRecords} matching RIH observed records
        {" · "}
        {document.observedApplicationRecords} records in active payload
        {" · "}
        official aggregate {document.officialApplications}
      </p>

      <ul className="divide-y rounded-lg border border-slate-200 bg-white">
        {matches.slice(0, 100).map((app) => (
          <li key={app.applicationId} className="px-3 py-2 text-sm" data-testid={`explore-v2-row-${app.applicationId}`}>
            <strong>.{app.appliedString.label}</strong>
            <span className="mt-0.5 block text-slate-700">
              {app.applicationId} · {app.applicant} · {app.country} · {app.region} ·{" "}
              {app.applicationStatus} · {app.processingStage} · {app.applicationType}
              {app.designations.idn ? " · IDN" : ""}
              {app.designations.brand ? " · Brand" : ""}
              {app.designations.community ? " · Community" : ""}
              {app.designations.geoSelfDesignated ? " · Geographic" : ""}
            </span>
          </li>
        ))}
      </ul>
      {matches.length > 100 ? (
        <p className="text-xs text-slate-600">Showing first 100 of {matches.length} matches.</p>
      ) : null}
    </section>
  );
}
