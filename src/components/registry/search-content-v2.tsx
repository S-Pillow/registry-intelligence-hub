"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_EXPLORE_FILTERS_V2,
  filterBrowserApplicationsV2,
  localResultCountV2,
} from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { CoverageDisclosureV2 } from "@/components/registry/coverage-disclosure-v2";

export function SearchContentV2({ document }: { document: RegistryApplicationsDocumentV2 }) {
  const [q, setQ] = useState("");
  const matches = useMemo(
    () => filterBrowserApplicationsV2(document.applications, { ...DEFAULT_EXPLORE_FILTERS_V2, q }),
    [document.applications, q],
  );
  const count = localResultCountV2(matches);

  return (
    <section data-testid="search-content-v2" className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
          Search
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Search applications</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Search applied string, application ID, applicant legal name, country/location, region,
          status, stage, application type, and designation flags.
        </p>
      </div>

      <CoverageDisclosureV2
        document={document}
        matchingObservedRecords={count.matchingObservedRecords}
      />

      <input
        aria-label="Search all registry records"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search applied string, applicant, id…"
        className="h-10 w-full rounded-lg border border-slate-400 px-3 text-sm"
      />

      <p aria-live="polite" className="text-sm font-bold" data-testid="search-v2-result-count">
        {count.matchingObservedRecords} matching RIH observed records
      </p>

      <ul className="divide-y rounded-lg border border-slate-200 bg-white">
        {matches.slice(0, 50).map((app) => (
          <li key={app.applicationId} className="px-3 py-2 text-sm">
            <strong>.{app.appliedString.label}</strong>
            <span className="mt-0.5 block text-slate-700">
              {app.applicationId} · {app.applicant} · {app.region}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
