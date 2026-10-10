"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHubRegistryData } from "@/components/registry/hub-registry-data-provider";
import {
  buildParticipantIntelligence,
  exploreApplicantApplicationsHref,
  exploreApplicantHref,
  filterAndSortParticipants,
  type ParticipantOverlays,
  type ParticipantSortKey,
} from "@/lib/participant-intelligence";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function ResolutionBadge({
  status,
  name,
}: {
  status: string;
  name: string | null;
}) {
  if (status === "CONFIRMED" && name) {
    return (
      <Badge variant="outline" className="bg-emerald-100 text-[#006a56]" data-testid="org-confirmed-badge">
        Confirmed · {name}
      </Badge>
    );
  }
  if (status === "CANDIDATE" || status === "AMBIGUOUS") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-900">
        Not confirmed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-100 text-slate-700">
      Not resolved
    </Badge>
  );
}

export function CompetitiveLandscapeContent({ overlays }: { overlays: ParticipantOverlays }) {
  const resolution = useHubRegistryData();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ParticipantSortKey>("applications");
  const [hasContention, setHasContention] = useState(false);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [region, setRegion] = useState("");
  const [, startTransition] = useTransition();

  const document = resolution.status === "ok" && resolution.mode === "promoted-2026-v2"
    ? resolution.documentV2
    : null;

  const intelligence = useMemo(() => {
    if (!document) return null;
    return buildParticipantIntelligence(document, overlays);
  }, [document, overlays]);

  const regions = useMemo(() => {
    if (!intelligence) return [];
    return [...new Set(intelligence.participants.flatMap((p) => p.regions))].sort();
  }, [intelligence]);

  const visible = useMemo(() => {
    if (!intelligence) return [];
    return filterAndSortParticipants(
      intelligence.participants,
      {
        q,
        hasOfficialContention: hasContention || undefined,
        confirmedOrganizationOnly: confirmedOnly || undefined,
        region: region || undefined,
      },
      sort,
    );
  }, [intelligence, q, hasContention, confirmedOnly, region, sort]);

  if (resolution.status === "fail-closed" || !document || !intelligence) {
    return (
      <section className="rounded-lg border border-slate-300 bg-white px-4 py-6 text-sm" data-testid="competitive-landscape-unavailable">
        <h1 className="text-xl font-bold">Competitive Landscape unavailable</h1>
        <p className="mt-2 text-slate-700">
          Requires an active Publication 2.x Application payload with official contention overlay.
        </p>
        <p className="mt-3">
          <Link href="/data-health" className="font-semibold text-[#006a56] underline">
            Open Data Health
          </Link>
        </p>
      </section>
    );
  }

  const { coverage, focal, contentionCounterparts, participants } = intelligence;
  const top = participants.slice(0, 8);

  return (
    <div className="space-y-8" data-testid="competitive-landscape">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Competitive Landscape</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Applicant competitive intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          Full-coverage view of observed Applicant legal names. Applicant is the ICANN-source analytical grain;
          resolved Organization is optional enrichment.{" "}
          <Link href="/data-health" className="font-semibold text-[#006a56] underline">
            Coverage detail in Data Health
          </Link>
          .
        </p>
      </header>

      {/* Orientation */}
      <section
        aria-labelledby="orientation-heading"
        className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
        data-testid="landscape-orientation"
      >
        <h2 id="orientation-heading" className="text-sm font-semibold text-slate-900">
          Coverage orientation
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Official Applications / Applicants</dt>
            <dd className="font-semibold text-slate-900">
              {coverage.officialApplications.toLocaleString()} / {coverage.officialApplicants.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Observed for analysis</dt>
            <dd className="font-semibold text-slate-900">
              {coverage.observedApplications.toLocaleString()} Applications ·{" "}
              {coverage.observedApplicantLegalNames.toLocaleString()} Applicant legal names
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Official initial contention</dt>
            <dd className="font-semibold text-slate-900">
              {coverage.officialContentionSets} sets · {coverage.officialContentionMemberships} memberships
            </dd>
          </div>
        </dl>
        {coverage.knownExcludedRecordIds.length > 0 ? (
          <p className="mt-3 text-xs text-slate-600">
            Known exclusion (not a participant row): {coverage.knownExcludedRecordIds.join(", ")}. Organization
            resolution covers {coverage.confirmedOrganizationMappings} confirmed Applicant mappings as enrichment
            only.
          </p>
        ) : null}
      </section>

      {/* GoDaddy position */}
      {focal ? (
        <Card className="border-slate-200 shadow-sm" data-testid="godaddy-competitive-position">
          <CardHeader className="pb-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">GoDaddy competitive position</p>
            <CardTitle className="text-xl">Applicant: {focal.applicantLegalName}</CardTitle>
            <div className="mt-1">
              <ResolutionBadge
                status={focal.row.organizationResolutionStatus}
                name={focal.row.confirmedOrganizationName}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-slate-500">Observed Applications</p>
              <p className="text-2xl font-bold text-slate-950" data-testid="focal-applications">
                {focal.row.applicationCount}
              </p>
              <p className="text-xs text-slate-600">
                Rank #{focal.rankByApplications} · {pct(focal.row.shareOfObservedApplications)} of observed
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Contested Applications</p>
              <p className="text-2xl font-bold text-slate-950" data-testid="focal-contested">
                {focal.row.contestedApplicationCount}
              </p>
              <p className="text-xs text-slate-600">
                Rate {pct(focal.row.contentionRate)} · {focal.row.officialContentionMemberships} memberships
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Contention sets touched</p>
              <p className="text-2xl font-bold text-slate-950">{focal.row.officialContentionSetsTouched}</p>
              <p className="text-xs text-slate-600">Contention exposure rank #{focal.rankByContentionExposure}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Designation composition</p>
              <p className="mt-1 text-slate-800">
                IDN {focal.row.designationCounts.idn} · Brand {focal.row.designationCounts.brand} · Community{" "}
                {focal.row.designationCounts.community} · Geographic {focal.row.designationCounts.geographic}
              </p>
              <Link
                href={exploreApplicantApplicationsHref(focal.row.applicationIds)}
                className="mt-2 inline-block font-semibold text-[#006a56] underline"
              >
                Open Applications in Explore
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Counterparts */}
      <section aria-labelledby="counterparts-heading" data-testid="godaddy-contention-counterparts">
        <h2 id="counterparts-heading" className="text-lg font-bold text-slate-950">
          Contention counterparts
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-700">
          Other Applicant legal names appearing in the same official initial contention sets as{" "}
          {intelligence.focalApplicantLegalName}. This is an official-set counterpart list — not a claim about
          corporate competitive relationships where Organization resolution is absent.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Applicant</th>
                <th className="px-3 py-2 font-semibold">Shared sets</th>
                <th className="px-3 py-2 font-semibold">Shared-set Applications</th>
                <th className="px-3 py-2 font-semibold">Resolved Organization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contentionCounterparts.slice(0, 25).map((c) => (
                <tr key={c.applicantLegalName}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <Link href={exploreApplicantHref(c.applicantLegalName)} className="text-[#006a56] underline">
                      {c.applicantLegalName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{c.sharedContentionSets}</td>
                  <td className="px-3 py-2 tabular-nums">{c.sharedSetApplications}</td>
                  <td className="px-3 py-2">
                    <ResolutionBadge status={c.organizationResolutionStatus} name={c.confirmedOrganizationName} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Showing top {Math.min(25, contentionCounterparts.length)} of {contentionCounterparts.length} counterparts
          (ranked by shared official sets, then shared-set Applications).
        </p>
      </section>

      {/* Landscape table */}
      <section aria-labelledby="landscape-heading" data-testid="participant-landscape">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="landscape-heading" className="text-lg font-bold text-slate-950">
              Participant landscape
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              All {coverage.observedApplicantLegalNames} observed Applicant legal names. Default sort: Applications
              descending.
            </p>
          </div>
          <p className="text-xs text-slate-600" data-testid="visible-participant-count">
            Showing {visible.length.toLocaleString()} / {participants.length.toLocaleString()}
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">Search Applicant legal name</span>
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => startTransition(() => setQ(e.target.value))}
              placeholder="Search Applicant legal name"
              className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-[#006a56] focus:ring-1 focus:ring-[#006a56]"
              data-testid="participant-search"
            />
          </label>
          <label className="text-sm text-slate-700">
            Sort{" "}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ParticipantSortKey)}
              className="ml-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              data-testid="participant-sort"
            >
              <option value="applications">Applications</option>
              <option value="contested">Contested Applications</option>
              <option value="contention-rate">Contention rate</option>
              <option value="contention-sets">Contention sets</option>
              <option value="name">Applicant name</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hasContention}
              onChange={(e) => setHasContention(e.target.checked)}
              data-testid="filter-has-contention"
            />
            Has official contention
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmedOnly}
              onChange={(e) => setConfirmedOnly(e.target.checked)}
              data-testid="filter-confirmed-org"
            />
            Confirmed Organization
          </label>
          <label className="text-sm text-slate-700">
            Region{" "}
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="ml-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              data-testid="filter-region"
            >
              <option value="">All</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Compact top glance */}
        <p className="mt-3 text-xs text-slate-600" data-testid="top-applicants-glance">
          Top by Applications:{" "}
          {top.map((p, i) => `${i + 1}. ${p.applicantLegalName} (${p.applicationCount})`).join(" · ")}
        </p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm" data-testid="participant-table">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Applicant</th>
                <th className="px-3 py-2 font-semibold">Applications</th>
                <th className="px-3 py-2 font-semibold">Share of observed</th>
                <th className="px-3 py-2 font-semibold">Contested</th>
                <th className="px-3 py-2 font-semibold">Rate</th>
                <th className="px-3 py-2 font-semibold">Sets</th>
                <th className="px-3 py-2 font-semibold">Region</th>
                <th className="px-3 py-2 font-semibold">Resolved Organization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((p) => (
                <tr key={p.applicantLegalName} data-applicant={p.applicantLegalName}>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{p.rankByApplications}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <Link href={exploreApplicantHref(p.applicantLegalName)} className="text-[#006a56] underline">
                      {p.applicantLegalName}
                    </Link>
                    {p.confirmedReturning ? (
                      <span
                        className="ml-2 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900"
                        data-testid="returning-badge"
                        title={`Confirmed returning · ${p.confirmedReturning.applications2012} → ${p.confirmedReturning.applications2026} (${p.confirmedReturning.portfolioChange})`}
                      >
                        Returning · {p.confirmedReturning.portfolioChange.toLowerCase()}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.applicationCount}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(p.shareOfObservedApplications)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.contestedApplicationCount}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(p.contentionRate)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.officialContentionSetsTouched}</td>
                  <td className="px-3 py-2 text-slate-700">{p.regions.slice(0, 2).join(", ") || "—"}</td>
                  <td className="px-3 py-2">
                    <ResolutionBadge
                      status={p.organizationResolutionStatus}
                      name={p.confirmedOrganizationName}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
