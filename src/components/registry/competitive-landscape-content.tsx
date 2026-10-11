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
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  buildRspOpportunityIntelligence,
  clearedCapabilityLabel,
  filterProspects,
  mainRspSignalLabel,
  organizationMappingLabel,
  prospectingPostureLabel,
  type ApplicantRspPosture,
  type RspProspectFilter,
  type RspProspectingPosture,
} from "@/lib/rsp-opportunity-intelligence";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function OrganizationMappingBadge({
  status,
  name,
}: {
  status: string;
  name: string | null;
}) {
  const label = organizationMappingLabel(
    status as "CONFIRMED" | "CANDIDATE" | "AMBIGUOUS" | "UNRESOLVED",
    name,
  );
  if (status === "CONFIRMED" && name) {
    return (
      <Badge variant="outline" className="bg-emerald-100 text-[#006a56]" data-testid="org-confirmed-badge">
        {label}
      </Badge>
    );
  }
  if (status === "CANDIDATE") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-900" data-testid="org-candidate-badge">
        {label}
      </Badge>
    );
  }
  if (status === "AMBIGUOUS") {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-900" data-testid="org-ambiguous-badge">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-100 text-slate-700" data-testid="org-unresolved-badge">
      {label}
    </Badge>
  );
}

function OrganizationMappingExplainer() {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" data-testid="org-mapping-explainer">
      <summary className="cursor-pointer font-semibold text-slate-900">
        What do organization mappings mean?
      </summary>
      <dl className="mt-2 space-y-2 text-slate-700">
        <div>
          <dt className="font-medium text-slate-900">Confirmed organization</dt>
          <dd>
            RIH has sufficient evidence and steward approval to associate this ICANN Applicant legal name with the
            displayed Organization.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Candidate organization</dt>
          <dd>RIH found a plausible relationship, but it is not confirmed as fact.</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Ambiguous organization</dt>
          <dd>Available evidence does not support one clear Organization relationship.</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">No organization mapping</dt>
          <dd>
            RIH has not established a broader Organization mapping for this Applicant. The Applicant itself and its
            application statistics remain valid ICANN-source data.
          </dd>
        </div>
      </dl>
    </details>
  );
}

type Surface = "participants" | "rsp-prospects";

export function CompetitiveLandscapeContent({ overlays }: { overlays: ParticipantOverlays }) {
  const resolution = useHubRegistryData();
  const [surface, setSurface] = useState<Surface>("participants");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ParticipantSortKey>("applications");
  const [hasContention, setHasContention] = useState(false);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [region, setRegion] = useState("");
  const [prospectQ, setProspectQ] = useState("");
  const [prospectPosture, setProspectPosture] = useState<RspProspectingPosture | "">("");
  const [mainRspSignal, setMainRspSignal] = useState<RspProspectFilter["mainRspSignal"]>("all");
  const [prospectRegion, setProspectRegion] = useState("");
  const [prospectContention, setProspectContention] = useState(false);
  const [prospectOrgMapping, setProspectOrgMapping] =
    useState<NonNullable<RspProspectFilter["organizationMapping"]> | "">("");
  const [selectedProspect, setSelectedProspect] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const document =
    resolution.status === "ok" && resolution.mode === "promoted-2026-v2" ? resolution.documentV2 : null;

  const intelligence = useMemo(() => {
    if (!document) return null;
    return buildParticipantIntelligence(document, overlays);
  }, [document, overlays]);

  const rspIntel = useMemo(() => {
    if (!intelligence) return null;
    return buildRspOpportunityIntelligence(intelligence, loadEvaluatedMainRspArtifact());
  }, [intelligence]);

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

  const visibleProspects = useMemo(() => {
    if (!rspIntel) return [];
    return filterProspects(rspIntel.prospects, {
      q: prospectQ,
      posture: prospectPosture || undefined,
      mainRspSignal,
      region: prospectRegion || undefined,
      hasOfficialContention: prospectContention || undefined,
      organizationMapping: prospectOrgMapping || undefined,
    });
  }, [rspIntel, prospectQ, prospectPosture, mainRspSignal, prospectRegion, prospectContention, prospectOrgMapping]);

  const selectedProspectRow: ApplicantRspPosture | null = useMemo(() => {
    if (!rspIntel || !selectedProspect) return null;
    return rspIntel.prospects.find((p) => p.applicantLegalName === selectedProspect) ?? null;
  }, [rspIntel, selectedProspect]);

  if (resolution.status === "fail-closed" || !document || !intelligence || !rspIntel) {
    return (
      <section
        className="rounded-lg border border-slate-300 bg-white px-4 py-6 text-sm"
        data-testid="competitive-landscape-unavailable"
      >
        <h1 className="text-xl font-bold">Competitive Landscape unavailable</h1>
        <p className="mt-2 text-slate-700">
          Requires an active 2026 application dataset with official contention membership.
        </p>
        <p className="mt-3">
          <Link href="/data-health" className="font-semibold text-[#006a56] underline">
            Data &amp; methodology
          </Link>
        </p>
      </section>
    );
  }

  const { coverage, focal, contentionCounterparts, participants } = intelligence;
  const top = participants.slice(0, 8);
  const { godaddyRsp, coverage: rspCoverage } = rspIntel;

  return (
    <div className="space-y-8" data-testid="competitive-landscape">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Competitive Landscape</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Applicant competitive intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          Analyze the {coverage.observedApplicantLegalNames.toLocaleString("en-US")} Applicant legal
          names currently represented in RIH. Applicant is the ICANN-source analytical grain;
          Organization mapping is optional enrichment. RSP prospecting uses public Main-RSP signals —
          not selected-RSP facts.{" "}
          <Link href="/data-health" className="font-semibold text-[#006a56] underline">
            Data &amp; methodology
          </Link>
          .
        </p>
      </header>

      <div
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-2"
        role="tablist"
        aria-label="Competitive Landscape surfaces"
        data-testid="landscape-surface-tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={surface === "participants"}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            surface === "participants" ? "bg-[#006a56] text-white" : "bg-slate-100 text-slate-800"
          }`}
          onClick={() => setSurface("participants")}
          data-testid="tab-participants"
        >
          Participants
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={surface === "rsp-prospects"}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            surface === "rsp-prospects" ? "bg-[#006a56] text-white" : "bg-slate-100 text-slate-800"
          }`}
          onClick={() => setSurface("rsp-prospects")}
          data-testid="tab-rsp-prospects"
        >
          RSP research
        </button>
      </div>

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

      {/* Dual GoDaddy roles */}
      {focal && godaddyRsp ? (
        <section
          className="grid gap-4 lg:grid-cols-2"
          data-testid="godaddy-competitive-position"
          aria-label="GoDaddy Applicant and Registry Service Provider roles"
        >
          <Card className="border-slate-200 shadow-sm" data-testid="godaddy-as-applicant">
            <CardHeader className="pb-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">GoDaddy as Applicant</p>
              <CardTitle className="text-xl">Applicant: {focal.applicantLegalName}</CardTitle>
              <p className="text-sm text-slate-600">Role: Applicant / prospective Registry Operator</p>
              <div className="mt-1">
                <OrganizationMappingBadge
                  status={focal.row.organizationResolutionStatus}
                  name={focal.row.confirmedOrganizationName}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-slate-700">
                These are applications submitted by Registry Services, LLC for GoDaddy&apos;s own prospective
                registry portfolio. If an application successfully proceeds through the ICANN process and the
                Applicant enters into the applicable Registry Agreement, that entity becomes Registry Operator for
                the TLD.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-500">Applications</p>
                  <p className="text-2xl font-bold text-slate-950" data-testid="focal-applications">
                    {focal.row.applicationCount}
                  </p>
                  <p className="text-xs text-slate-600">
                    Rank #{focal.rankByApplications} · {pct(focal.row.shareOfObservedApplications)} of observed
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Contention</p>
                  <p className="text-2xl font-bold text-slate-950" data-testid="focal-contested">
                    {focal.row.contestedApplicationCount}
                  </p>
                  <p className="text-xs text-slate-600">
                    {focal.row.officialContentionMemberships} memberships ·{" "}
                    {focal.row.officialContentionSetsTouched} sets · exposure rank #
                    {focal.rankByContentionExposure}
                  </p>
                </div>
              </div>
              <Link
                href={exploreApplicantApplicationsHref(focal.row.applicationIds)}
                className="inline-block font-semibold text-[#006a56] underline"
                data-testid="cta-view-godaddy-applications"
              >
                View GoDaddy applications
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm" data-testid="godaddy-as-rsp">
            <CardHeader className="pb-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
                GoDaddy as Registry Service Provider
              </p>
              <CardTitle className="text-xl">{godaddyRsp.rspLegalName}</CardTitle>
              <p className="text-sm text-slate-600">
                DBA {godaddyRsp.doingBusinessAs ?? "—"} · Country {godaddyRsp.countryCode ?? "—"}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-slate-700">
                GoDaddy Registry can also provide backend registry services for other Applicants. An RSP supplies
                backend registry technical services — distinct from being the Applicant.
              </p>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950" data-testid="selected-rsp-limitation">
                Public application data does not disclose which RSP an Applicant selected.
              </p>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Main</dt>
                  <dd className="font-semibold">{clearedCapabilityLabel(godaddyRsp.mainCleared)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">DNS</dt>
                  <dd className="font-semibold">{clearedCapabilityLabel(godaddyRsp.dnsCleared)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">DNSSEC</dt>
                  <dd className="font-semibold">{clearedCapabilityLabel(godaddyRsp.dnssecCleared)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">IDN support</dt>
                  <dd className="font-semibold">
                    {godaddyRsp.idnSupportLevel != null ? `Level ${godaddyRsp.idnSupportLevel}` : "—"}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-slate-600" data-testid="rsp-source-freshness">
                Official evaluated-RSP source: {rspCoverage.sourcePublisher} · Last updated:{" "}
                {rspCoverage.sourceLastUpdated} ·{" "}
                <a
                  href={rspCoverage.sourceUrl}
                  className="font-semibold text-[#006a56] underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  ICANN list
                </a>
              </p>
              <button
                type="button"
                className="font-semibold text-[#006a56] underline"
                onClick={() => setSurface("rsp-prospects")}
                data-testid="cta-explore-rsp-prospects"
              >
                Explore RSP prospecting research
              </button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {surface === "rsp-prospects" ? (
        <section aria-labelledby="rsp-prospects-heading" data-testid="rsp-prospects-surface" className="space-y-4">
          <div>
            <h2 id="rsp-prospects-heading" className="text-lg font-bold text-slate-950">
              RSP prospecting research
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700">
              Public-signal research view for GoDaddy Registry backend services. Rows are classified by{" "}
              <strong className="font-semibold text-slate-900">public RSP posture</strong> (factual matching
              against ICANN evaluated-RSP evidence), not by assumed sales status. Application portfolio size is
              not revenue or deal size.{" "}
              <strong className="font-semibold text-slate-900">
                “No public Main-RSP capability found” does not mean an RSP was not selected, and does not imply
                commercial availability.
              </strong>
            </p>
            <p className="mt-2 text-xs text-slate-600" data-testid="rsp-prospect-universe">
              {rspCoverage.externalApplicants.toLocaleString()} non-GoDaddy Applicants ·{" "}
              {rspCoverage.noPublicMainRspCapability.toLocaleString()} no public Main-RSP capability ·{" "}
              {rspCoverage.publicMainRspCapable.toLocaleString()} public Main-RSP capable ·{" "}
              {rspCoverage.viaConfirmedOrganization.toLocaleString()} via confirmed organization
            </p>
          </div>

          <OrganizationMappingExplainer />

          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative min-w-[12rem] flex-1">
              <span className="sr-only">Search Applicant</span>
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={prospectQ}
                onChange={(e) => startTransition(() => setProspectQ(e.target.value))}
                placeholder="Search Applicant"
                className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-[#006a56] focus:ring-1 focus:ring-[#006a56]"
                data-testid="prospect-search"
              />
            </label>
            <label className="text-sm text-slate-700">
              Public RSP posture{" "}
              <select
                value={prospectPosture}
                onChange={(e) => setProspectPosture(e.target.value as RspProspectingPosture | "")}
                className="ml-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                data-testid="filter-prospect-posture"
              >
                <option value="">All</option>
                <option value="NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND">
                  No public Main-RSP capability found
                </option>
                <option value="PUBLIC_MAIN_RSP_CAPABILITY_FOUND">Public Main-RSP capability found</option>
                <option value="MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION">
                  Main-RSP capability via confirmed organization
                </option>
                <option value="IDENTITY_REVIEW_NEEDED">Identity review needed</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Public Main-RSP signal{" "}
              <select
                value={mainRspSignal}
                onChange={(e) => setMainRspSignal(e.target.value as RspProspectFilter["mainRspSignal"])}
                className="ml-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                data-testid="filter-main-rsp-signal"
              >
                <option value="all">All</option>
                <option value="none">No public Main-RSP match</option>
                <option value="evaluated">Evaluated Main RSP</option>
                <option value="via-org">Via confirmed organization</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={prospectContention}
                onChange={(e) => setProspectContention(e.target.checked)}
                data-testid="filter-prospect-contention"
              />
              Has official contention
            </label>
            <label className="text-sm text-slate-700">
              Organization mapping{" "}
              <select
                value={prospectOrgMapping}
                onChange={(e) =>
                  setProspectOrgMapping(e.target.value as typeof prospectOrgMapping)
                }
                className="ml-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                data-testid="filter-prospect-org-mapping"
              >
                <option value="">All</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANDIDATE">Candidate</option>
                <option value="AMBIGUOUS">Ambiguous</option>
                <option value="UNRESOLVED">No organization mapping</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Region{" "}
              <select
                value={prospectRegion}
                onChange={(e) => setProspectRegion(e.target.value)}
                className="ml-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                data-testid="filter-prospect-region"
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

          <p className="text-xs text-slate-600" data-testid="visible-prospect-count">
            Showing {visibleProspects.length.toLocaleString()} / {rspIntel.prospects.length.toLocaleString()} ·
            Research priority based on public portfolio size and contention context (Applicants with no public
            Main-RSP capability match first, then Application count, then contested Applications)
          </p>

          <p className="text-sm font-semibold text-slate-900" data-testid="largest-no-public-main-rsp">
            Largest Applicants without a public Main-RSP capability match
          </p>
          <p className="text-xs text-slate-600">
            Worth investigating from public signals only — not known to be commercially available.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm" data-testid="rsp-prospect-table">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Applicant</th>
                  <th className="px-3 py-2 font-semibold">Applications</th>
                  <th className="px-3 py-2 font-semibold">Contested</th>
                  <th className="px-3 py-2 font-semibold">Region</th>
                  <th className="px-3 py-2 font-semibold">Organization mapping</th>
                  <th className="px-3 py-2 font-semibold">Public Main-RSP signal</th>
                  <th className="px-3 py-2 font-semibold">Public RSP posture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleProspects.map((p) => (
                  <tr
                    key={p.applicantLegalName}
                    data-applicant={p.applicantLegalName}
                    className={selectedProspect === p.applicantLegalName ? "bg-emerald-50/40" : undefined}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <button
                        type="button"
                        className="text-left text-[#006a56] underline"
                        onClick={() => setSelectedProspect(p.applicantLegalName)}
                        data-testid="prospect-row-select"
                      >
                        {p.applicantLegalName}
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{p.applicationCount}</td>
                    <td className="px-3 py-2 tabular-nums">{p.contestedApplications}</td>
                    <td className="px-3 py-2 text-slate-700">{p.region.slice(0, 2).join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      <OrganizationMappingBadge
                        status={p.organizationMappingStatus}
                        name={p.confirmedOrganizationName}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-800">{mainRspSignalLabel(p)}</td>
                    <td className="px-3 py-2 text-slate-800">{prospectingPostureLabel(p.rspProspectingPosture)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedProspectRow ? (
            <aside
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              data-testid="prospect-evidence-panel"
            >
              <h3 className="text-base font-bold text-slate-950">{selectedProspectRow.applicantLegalName}</h3>
              <p className="mt-1 text-sm text-slate-700">{selectedProspectRow.rspProspectingReason}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Applications</dt>
                  <dd className="font-semibold">{selectedProspectRow.applicationCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Contested / sets</dt>
                  <dd className="font-semibold">
                    {selectedProspectRow.contestedApplications} / {selectedProspectRow.contentionSetsTouched}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Region</dt>
                  <dd className="font-semibold">{selectedProspectRow.region.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Organization mapping</dt>
                  <dd>
                    <OrganizationMappingBadge
                      status={selectedProspectRow.organizationMappingStatus}
                      name={selectedProspectRow.confirmedOrganizationName}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Public RSP posture</dt>
                  <dd className="font-semibold">
                    {prospectingPostureLabel(selectedProspectRow.rspProspectingPosture)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Public Main-RSP signal</dt>
                  <dd className="font-semibold">{mainRspSignalLabel(selectedProspectRow)}</dd>
                </div>
              </dl>
              {selectedProspectRow.evaluatedRspLegalName ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" data-testid="matched-rsp-evidence">
                  <p className="font-semibold text-slate-900">Public evaluated-RSP evidence</p>
                  <p className="text-slate-700">
                    {selectedProspectRow.evaluatedRspLegalName}
                    {selectedProspectRow.evaluatedRspDba
                      ? ` · DBA ${selectedProspectRow.evaluatedRspDba}`
                      : ""}
                  </p>
                  <p className="text-slate-700">
                    Main {clearedCapabilityLabel(!!selectedProspectRow.evaluatedRspCapabilities?.main)} · DNS{" "}
                    {clearedCapabilityLabel(!!selectedProspectRow.evaluatedRspCapabilities?.dns)} · DNSSEC{" "}
                    {clearedCapabilityLabel(!!selectedProspectRow.evaluatedRspCapabilities?.dnssec)}
                    {selectedProspectRow.evaluatedRspCapabilities?.idnSupportLevel != null
                      ? ` · IDN Level ${selectedProspectRow.evaluatedRspCapabilities.idnSupportLevel}`
                      : ""}
                  </p>
                  <p className="text-xs text-slate-600">
                    Record last updated: {selectedProspectRow.evaluatedRspRecordLastUpdated ?? "—"} · Source list
                    updated: {rspCoverage.sourceLastUpdated}
                  </p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link
                  href={exploreApplicantHref(selectedProspectRow.applicantLegalName)}
                  className="font-semibold text-[#006a56] underline"
                  data-testid="prospect-explore-applicant"
                >
                  Open Applicant in Explore
                </Link>
                <Link
                  href={exploreApplicantApplicationsHref(
                    intelligence.participants.find(
                      (p) => p.applicantLegalName === selectedProspectRow.applicantLegalName,
                    )?.applicationIds ?? [],
                  )}
                  className="font-semibold text-[#006a56] underline"
                  data-testid="prospect-explore-applications"
                >
                  Open Applications
                </Link>
              </div>
            </aside>
          ) : null}
        </section>
      ) : (
        <>
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
                    <th className="px-3 py-2 font-semibold">Organization mapping</th>
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
                        <OrganizationMappingBadge
                          status={c.organizationResolutionStatus}
                          name={c.confirmedOrganizationName}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Showing top {Math.min(25, contentionCounterparts.length)} of {contentionCounterparts.length}{" "}
              counterparts (ranked by shared official sets, then shared-set Applications).
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
                  All {coverage.observedApplicantLegalNames} observed Applicant legal names. Default sort:
                  Applications descending.
                </p>
              </div>
              <p className="text-xs text-slate-600" data-testid="visible-participant-count">
                Showing {visible.length.toLocaleString()} / {participants.length.toLocaleString()}
              </p>
            </div>

            <div className="mt-3">
              <OrganizationMappingExplainer />
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
                    <th className="px-3 py-2 font-semibold">Organization mapping</th>
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
                        <OrganizationMappingBadge
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
        </>
      )}
    </div>
  );
}
