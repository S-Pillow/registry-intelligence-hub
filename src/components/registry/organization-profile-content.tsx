"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type OrganizationIntelligenceLookup,
  type OrganizationIntelligenceProfile,
} from "@/lib/organization-intelligence";
import type { OrganizationConcentrationModel } from "@/lib/organization-concentration";
import { CompareAddButton, CompareTrayFloating } from "@/components/registry/compare-add-button";
import { OrganizationConcentrationProfileContext } from "@/components/registry/organization-concentration-panel";

function Stat({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function HubChrome() {
  const items = [
    { label: "Command Center", href: "/" },
    { label: "Explore", href: "/explore" },
    { label: "Competitive Landscape", href: "/competitive-landscape" },
    { label: "Contention", href: "/contention" },
    { label: "Changes", href: "/changes" },
  ] as const;
  return (
    <>
      <header className="border-b border-white/10 bg-[#101923] text-white">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center px-4 sm:px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-[0.2em]">
            FORGE<span className="text-[#72dfb4]">/</span>FORWARD
          </Link>
        </div>
      </header>
      <div className="border-b bg-white" data-testid="hub-primary-nav">
        <div className="mx-auto flex max-w-[1480px] px-2 sm:px-6">
          <nav aria-label="Hub business navigation" className="flex flex-wrap gap-1">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-3 py-3 text-sm font-semibold text-slate-600 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/data-health" className="px-3 py-3 text-sm font-medium text-slate-500 hover:text-slate-800">
              Data &amp; methodology
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}

function ProfileFound({
  profile,
  organizationConcentration,
}: {
  profile: OrganizationIntelligenceProfile;
  organizationConcentration?: OrganizationConcentrationModel | null;
}) {
  const [applicantFilter, setApplicantFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState<"all" | "brand" | "non-brand">("all");
  const [contentionFilter, setContentionFilter] = useState<"all" | "in" | "out">("all");
  const [portfolioQ, setPortfolioQ] = useState("");

  const filteredPortfolio = useMemo(() => {
    const q = portfolioQ.trim().toLowerCase();
    return profile.portfolio.filter((row) => {
      if (applicantFilter !== "all" && row.applicantLegalName !== applicantFilter) return false;
      if (brandFilter === "brand" && !row.brand) return false;
      if (brandFilter === "non-brand" && row.brand) return false;
      if (contentionFilter === "in" && !row.inInitialContention) return false;
      if (contentionFilter === "out" && row.inInitialContention) return false;
      if (!q) return true;
      return (
        row.appliedForString.toLowerCase().includes(q) ||
        row.applicationId.toLowerCase().includes(q) ||
        row.applicantLegalName.toLowerCase().includes(q)
      );
    });
  }, [profile.portfolio, applicantFilter, brandFilter, contentionFilter, portfolioQ]);

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8" data-testid="organization-profile">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Organization profile</p>
      <header className="mt-2" data-testid="organization-profile-header">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{profile.canonicalName}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-800" data-testid="org-confirmed-status">
          Confirmed Organization
        </p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600" data-testid="org-confirmed-explainer">
          RIH-confirmed Organization based on evidence-backed relationships between published Applicant
          legal entities. This is not an ICANN designation.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
          <span>
            Represented Applicant legal entities:{" "}
            <strong className="tabular-nums">{profile.applicantEntityCount}</strong>
          </span>
          <span>
            2026 Applications: <strong className="tabular-nums">{profile.applicationCount}</strong>
          </span>
          <span>
            Contention memberships:{" "}
            <strong className="tabular-nums">{profile.contentionMemberships}</strong>
          </span>
          <span>
            Unique contention sets:{" "}
            <strong className="tabular-nums">{profile.uniqueContentionSets}</strong>
          </span>
          <span>
            Brand Applications:{" "}
            <strong className="tabular-nums">{profile.brandApplicationCount}</strong>
          </span>
          {profile.confirmedReturning ? (
            <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-900">
              Returning participation
            </span>
          ) : null}
        </div>
        <div className="mt-4" data-testid="organization-compare-actions">
          <CompareAddButton
            type="organization"
            entityKey={profile.organizationKey}
            label={profile.canonicalName}
            testId="organization-add-to-compare"
          />
        </div>
      </header>

      <section
        className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-labelledby="org-glance-heading"
        data-testid="organization-at-a-glance"
      >
        <h2 id="org-glance-heading" className="sr-only">
          At a glance
        </h2>
        <Stat label="Applicant entities" value={profile.applicantEntityCount} testId="stat-applicants" />
        <Stat label="2026 Applications" value={profile.applicationCount} testId="stat-applications" />
        <Stat
          label="Brand Applications"
          value={`${profile.brandApplicationCount} of ${profile.applicationCount}`}
          testId="stat-brand"
        />
        <Stat
          label="In initial contention"
          value={profile.contestedApplicationCount}
          testId="stat-contested"
        />
        <Stat label="Unique contention sets" value={profile.uniqueContentionSets} testId="stat-sets" />
        <Stat
          label="Contention memberships"
          value={profile.contentionMemberships}
          testId="stat-memberships"
        />
        {profile.confirmedReturning ? (
          <>
            <Stat
              label="2012 Applications"
              value={profile.confirmedReturning.applications2012}
              testId="stat-2012"
            />
            <Stat
              label="2026 vs 2012 change"
              value={`${profile.confirmedReturning.applicationDelta >= 0 ? "+" : ""}${profile.confirmedReturning.applicationDelta}`}
              testId="stat-delta"
            />
          </>
        ) : null}
      </section>

      <p className="mt-4 text-sm text-slate-700" data-testid="portfolio-summary-line">
        RIH maps {profile.applicationCount} represented Applications across {profile.applicantEntityCount}{" "}
        Applicant legal {profile.applicantEntityCount === 1 ? "entity" : "entities"} to{" "}
        {profile.canonicalName}.
      </p>

      {organizationConcentration ? (
        <div className="mt-4">
          <OrganizationConcentrationProfileContext
            model={organizationConcentration}
            organizationKey={profile.organizationKey}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3 text-sm" data-testid="organization-profile-actions">
        <Link href={profile.exploreApplicationsHref} className="font-semibold text-[#006a56] underline">
          Explore applications
        </Link>
        <Link href={profile.competitiveLandscapeHref} className="font-semibold text-[#006a56] underline">
          Competitive Landscape
        </Link>
        <Link href={profile.contentionHref} className="font-semibold text-[#006a56] underline">
          Contention
        </Link>
        {profile.confirmedReturning ? (
          <Link
            href="/cross-round"
            className="font-semibold text-[#006a56] underline"
            data-testid="org-cross-round-link"
          >
            2012 vs 2026 structural comparison
          </Link>
        ) : null}
        {profile.applicantEntityCount === 1 ? (
          <Link
            href={profile.applicants[0]!.profileHref}
            className="font-semibold text-[#006a56] underline"
            data-testid="view-applicant-profile"
          >
            View Applicant Profile
          </Link>
        ) : null}
      </div>

      <section className="mt-8" aria-labelledby="applicant-family-heading" data-testid="org-applicant-family">
        <h2 id="applicant-family-heading" className="text-lg font-bold text-slate-950">
          Represented Applicant entities mapped to this Organization
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          These are ICANN Applicant legal entities — not subsidiaries or brands unless evidence establishes
          that relationship.
        </p>
        <ul className="mt-4 space-y-2">
          {profile.applicants.map((a) => (
            <li
              key={a.applicantLegalName}
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
              data-testid={`org-applicant-${a.applicantLegalName}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={a.profileHref}
                  className="font-semibold text-[#006a56] underline-offset-2 hover:underline"
                  data-testid="org-member-applicant-profile"
                >
                  {a.applicantLegalName}
                </Link>
                <span className="tabular-nums text-slate-700">
                  {a.applicationCount} apps · {a.brandApplicationCount} Brand · {a.contentionMemberships}{" "}
                  contention memberships
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {[a.countries.join(", "), a.regions.join(", ")].filter(Boolean).join(" · ") || "—"}
                {a.applicantWebsiteHost ? ` · ${a.applicantWebsiteHost}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="portfolio-heading" data-testid="org-portfolio-section">
        <h2 id="portfolio-heading" className="text-lg font-bold text-slate-950">
          Application portfolio
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Brand Applications: {profile.brandApplicationCount} of {profile.applicationCount}. Each row keeps
          its legal Applicant attribution — {profile.canonicalName} is not the ICANN Applicant.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="text-sm text-slate-700">
            Applicant{" "}
            <select
              className="ml-1 rounded-md border border-slate-300 px-2 py-1.5"
              value={applicantFilter}
              onChange={(e) => setApplicantFilter(e.target.value)}
              data-testid="portfolio-filter-applicant"
            >
              <option value="all">All</option>
              {profile.applicants.map((a) => (
                <option key={a.applicantLegalName} value={a.applicantLegalName}>
                  {a.applicantLegalName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Brand{" "}
            <select
              className="ml-1 rounded-md border border-slate-300 px-2 py-1.5"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value as typeof brandFilter)}
              data-testid="portfolio-filter-brand"
            >
              <option value="all">All</option>
              <option value="brand">Brand</option>
              <option value="non-brand">Non-Brand</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Contention{" "}
            <select
              className="ml-1 rounded-md border border-slate-300 px-2 py-1.5"
              value={contentionFilter}
              onChange={(e) => setContentionFilter(e.target.value as typeof contentionFilter)}
              data-testid="portfolio-filter-contention"
            >
              <option value="all">All</option>
              <option value="in">In contention</option>
              <option value="out">Not in contention</option>
            </select>
          </label>
          <label className="text-sm text-slate-700 sm:flex-1">
            Search{" "}
            <input
              className="ml-1 w-full max-w-xs rounded-md border border-slate-300 px-2 py-1.5"
              value={portfolioQ}
              onChange={(e) => setPortfolioQ(e.target.value)}
              placeholder="String, Application ID, Applicant"
              data-testid="portfolio-search"
            />
          </label>
        </div>
        <ul className="mt-4 space-y-2 md:hidden" data-testid="org-portfolio-mobile">
          {filteredPortfolio.map((row) => (
            <li key={row.applicationId} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm">
              <p className="font-semibold">
                .{row.appliedForString || "—"}
                {row.brand ? <span className="ml-2 text-xs text-[#006a56]">Brand</span> : null}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-600">{row.applicationId}</p>
              <p className="mt-1">
                <Link href={row.applicantProfileHref} className="text-[#006a56] underline">
                  {row.applicantLegalName}
                </Link>
              </p>
              <Link href={row.exploreHref} className="mt-2 inline-block text-xs font-semibold text-[#006a56] underline">
                Open in Explore
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm" data-testid="org-portfolio-table">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2 font-semibold">String</th>
                <th className="px-2 py-2 font-semibold">Application ID</th>
                <th className="px-2 py-2 font-semibold">Applicant</th>
                <th className="px-2 py-2 font-semibold">Brand</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Contention</th>
              </tr>
            </thead>
            <tbody>
              {filteredPortfolio.map((row) => (
                <tr key={row.applicationId} className="border-b border-slate-100">
                  <td className="px-2 py-2">
                    <Link href={row.exploreHref} className="font-medium text-[#006a56] hover:underline">
                      .{row.appliedForString || "—"}
                    </Link>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{row.applicationId}</td>
                  <td className="px-2 py-2">
                    <Link href={row.applicantProfileHref} className="text-[#006a56] hover:underline">
                      {row.applicantLegalName}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-xs">{row.brand ? "Brand" : "—"}</td>
                  <td className="px-2 py-2 text-xs">{row.applicationStatus ?? "—"}</td>
                  <td className="px-2 py-2 text-xs">
                    {row.inInitialContention ? row.officialContentionSetIds.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="contention-heading" data-testid="org-contention-section">
        <h2 id="contention-heading" className="text-lg font-bold text-slate-950">
          Contention
        </h2>
        <p className="mt-2 text-sm text-slate-700" data-testid="org-contention-clarity">
          {profile.canonicalName} has {profile.contentionMemberships} Application contention memberships in{" "}
          {profile.uniqueContentionSets} unique contention sets, from{" "}
          {profile.applicants.filter((a) => a.contentionMemberships > 0).length} Applicant legal entities
          represented in those sets. Application memberships and unique sets are not interchangeable.
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-xs uppercase text-slate-500">Applications in contention</dt>
            <dd className="font-semibold tabular-nums">{profile.contestedApplicationCount}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-xs uppercase text-slate-500">Unique sets</dt>
            <dd className="font-semibold tabular-nums">{profile.uniqueContentionSets}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-xs uppercase text-slate-500">External counterpart Applicants</dt>
            <dd className="font-semibold tabular-nums">{profile.distinctExternalCounterpartApplicants}</dd>
          </div>
        </dl>
        {profile.contentionSets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No official initial contention memberships for this Organization.</p>
        ) : (
          <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
            {profile.contentionSets.slice(0, 40).map((set) => (
              <li
                key={set.setId}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
                data-testid={`org-contention-set-${set.setId}`}
              >
                <p className="font-semibold text-slate-950">
                  Set #{set.setId}
                  {set.appliedForStrings[0] ? (
                    <span className="ml-2 font-medium text-slate-700">.{set.appliedForStrings[0]}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-slate-700">
                  {set.applicationCount} Applications · {set.distinctApplicantCount} distinct Applicants · this
                  Organization: {set.organizationApplicationCount} Applications from{" "}
                  {set.organizationApplicantCount} Applicant
                  {set.organizationApplicantCount === 1 ? "" : "s"}
                  {set.includesGodaddy ? " · includes GoDaddy" : ""}
                </p>
                <Link href={set.contentionSetHref} className="mt-2 inline-block font-semibold text-[#006a56] underline">
                  Open set detail
                </Link>
              </li>
            ))}
          </ul>
        )}
        {profile.counterparts.length > 0 ? (
          <div className="mt-6" data-testid="org-counterparts">
            <h3 className="text-sm font-bold text-slate-950">Counterpart Applicants</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {profile.counterparts.slice(0, 12).map((c) => (
                <li key={c.applicantLegalName} className="rounded border border-slate-200 px-3 py-2">
                  <Link href={c.profileHref} className="font-medium text-[#006a56] underline">
                    {c.applicantLegalName}
                  </Link>
                  {c.confirmedOrganizationName && c.organizationProfileHref ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={c.organizationProfileHref} className="text-[#006a56] underline">
                        Confirmed · {c.confirmedOrganizationName}
                      </Link>
                    </>
                  ) : (
                    <span className="ml-2 text-xs text-slate-500">{c.organizationResolutionStatus}</span>
                  )}
                  <span className="ml-2 text-xs text-slate-600">
                    {c.sharedContentionSets} shared sets · {c.sharedApplicationMemberships} memberships
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="evidence-heading" data-testid="org-evidence-section">
        <h2 id="evidence-heading" className="text-lg font-bold text-slate-950">
          Identity / relationship evidence
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {profile.canonicalName}: {profile.evidenceSummary.mappingCount} Confirmed Applicant mappings
          {profile.evidenceSummary.evidenceTypeLabels.length
            ? `. Evidence types observed: ${profile.evidenceSummary.evidenceTypeLabels.join("; ")}.`
            : "."}
        </p>
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-900">Inspect by Applicant</summary>
          <ul className="mt-3 space-y-3">
            {profile.applicants.map((a) => (
              <li key={a.applicantLegalName} className="border-t border-slate-200 pt-2">
                <Link href={a.profileHref} className="font-medium text-[#006a56] underline">
                  {a.applicantLegalName}
                </Link>
                {a.applicantWebsiteHost ? (
                  <p className="mt-1 text-xs text-slate-600">Website: {a.applicantWebsiteHost}</p>
                ) : null}
                {a.identityEvidence?.directParentLegalName ? (
                  <p className="text-xs text-slate-600">Direct parent: {a.identityEvidence.directParentLegalName}</p>
                ) : null}
                {a.identityEvidence?.ultimateParentLegalName ? (
                  <p className="text-xs text-slate-600">
                    Ultimate parent: {a.identityEvidence.ultimateParentLegalName}
                  </p>
                ) : null}
                {a.identityEvidence?.ultimateControlLegalName &&
                a.identityEvidence.ultimateControlLegalName !== a.identityEvidence.ultimateParentLegalName ? (
                  <p className="text-xs text-slate-600">
                    Ultimate control: {a.identityEvidence.ultimateControlLegalName}
                  </p>
                ) : null}
                {a.identityEvidence?.evidenceExplanationLines?.length ? (
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
                    {a.identityEvidence.evidenceExplanationLines.slice(0, 4).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="mt-8" aria-labelledby="rsp-heading" data-testid="org-rsp-section">
        <h2 id="rsp-heading" className="text-lg font-bold text-slate-950">
          Public RSP posture
        </h2>
        <p className="mt-2 text-sm text-slate-700" data-testid="org-rsp-summary">
          Public Main-RSP capability among mapped Applicants:{" "}
          <strong className="tabular-nums">{profile.rspAmongMappedApplicants.publicMainRspCapableCount}</strong>
          {" · "}
          No public Main-RSP: {profile.rspAmongMappedApplicants.noPublicMainRspCount}
          {" · "}
          Via confirmed Organization: {profile.rspAmongMappedApplicants.viaConfirmedOrganizationCount}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Selected RSP is not established by the public Applicant data. No Organization-level RSP inference
          beyond accepted Applicant matching rules.
        </p>
      </section>

      {profile.confirmedReturning ? (
        <section className="mt-8" aria-labelledby="history-heading" data-testid="org-history-section">
          <h2 id="history-heading" className="text-lg font-bold text-slate-950">
            Confirmed cross-round Organization relationship
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Organization-level portfolio: {profile.confirmedReturning.applications2012} Applications in 2012 ·{" "}
            {profile.confirmedReturning.applications2026} in 2026 · change{" "}
            {profile.confirmedReturning.applicationDelta >= 0 ? "+" : ""}
            {profile.confirmedReturning.applicationDelta} ({profile.confirmedReturning.portfolioChange.toLowerCase()}
            ). Organization continuity does not imply identical Applicant legal-entity wording across rounds.
          </p>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="changes-heading" data-testid="org-changes-section">
        <h2 id="changes-heading" className="text-lg font-bold text-slate-950">
          Recent changes
        </h2>
        <p className="mt-2 text-sm text-slate-700">{profile.changeSummary.summaryLine}</p>
        <Link href={profile.changeSummary.changesHref} className="mt-2 inline-block text-sm font-semibold text-[#006a56] underline">
          Open Change Intelligence
        </Link>
      </section>

      <section className="mt-8" aria-labelledby="sources-heading" data-testid="org-sources-section">
        <h2 id="sources-heading" className="text-lg font-bold text-slate-950">
          Sources
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Organization resolution: RIH evidence-backed mapping (steward Confirmed)</li>
          <li>Applications: ICANN APS / represented Application publication</li>
          <li>Contention: official initial contention memberships</li>
          <li>RSP: official evaluated-RSP source where applicable</li>
          <li>Cross-round: accepted historical identity evidence where confirmed</li>
        </ul>
        <Link href="/data-health" className="mt-2 inline-block text-sm font-semibold text-[#006a56] underline">
          Data &amp; methodology
        </Link>
      </section>
    </main>
  );
}

export function OrganizationProfileContent({
  lookup,
  organizationConcentration = null,
}: {
  lookup: OrganizationIntelligenceLookup;
  organizationConcentration?: OrganizationConcentrationModel | null;
}) {
  return (
    <div className="min-h-screen bg-[#f4f7f8]">
      <HubChrome />
      {!lookup.found ? (
        <main className="mx-auto max-w-[1100px] px-4 py-8" data-testid="organization-profile-not-found">
          <h1 className="text-xl font-bold text-slate-950">Organization not found</h1>
          <p className="mt-2 text-sm text-slate-700">
            {lookup.reason === "not-confirmed"
              ? "Only steward-Confirmed Organizations have Organization Profiles. Candidate, Ambiguous, and Unresolved Applicants remain on Applicant Profiles."
              : "No Confirmed Organization matches this canonical key."}{" "}
            Key: <span className="font-semibold">{lookup.organizationKey || "(empty)"}</span>
          </p>
          <Link href="/competitive-landscape" className="mt-4 inline-block font-semibold text-[#006a56] underline">
            Back to Competitive Landscape
          </Link>
        </main>
      ) : (
        <ProfileFound profile={lookup} organizationConcentration={organizationConcentration} />
      )}
      <CompareTrayFloating />
    </div>
  );
}
