"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ApplicantIdentityEvidencePanel,
  OrganizationMappingBadge,
} from "@/components/registry/organization-mapping-display";
import {
  ProfilePortfolioFilterBar,
  ProfileSourceSummary,
  ScdProfileSummaryCards,
  usePortfolioFilterNavigation,
} from "@/components/registry/scd-profile-summary";
import {
  contestedApplicationsStatLabel,
  contentionSetExplanation,
  filterApplicantPortfolio,
  noContentionMembershipsLabel,
  scdContentionStatusLabel,
  selectionModeLabel,
  type ApplicantIntelligenceLookup,
  type ApplicantIntelligenceProfile,
  type ApplicantPortfolioFilter,
  type ApplicantPortfolioRow,
} from "@/lib/applicant-intelligence";
import { CompareAddButton, CompareTrayFloating } from "@/components/registry/compare-add-button";
import { ForecastLink } from "@/components/registry/forecast-link";

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function HubChrome({ active }: { active?: string }) {
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
            {items.map((item) => {
              const isActive = item.label === active;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-3 py-3 text-sm font-semibold ${
                    isActive
                      ? "border-b-2 border-[#006a56] text-[#006a56]"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/data-health"
              className="px-3 py-3 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Data &amp; methodology
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}

function PortfolioRowCard({ row }: { row: ApplicantPortfolioRow }) {
  const selectedDiffers = row.selectedCurrentString !== row.originalAppliedForString;
  return (
    <li
      className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
      data-testid={`portfolio-row-${row.applicationId}`}
    >
      <p className="font-semibold text-slate-950">
        <ForecastLink
          label={row.selectedCurrentString}
          testId={`portfolio-forecast-selected-${row.applicationId}`}
          fallback={<span>.{row.selectedCurrentString || "—"}</span>}
        />
        {selectedDiffers ? (
          <span className="ml-2 text-xs font-medium text-slate-600">
            (original{" "}
            <ForecastLink
              label={row.originalAppliedForString}
              testId={`portfolio-forecast-original-${row.applicationId}`}
              fallback={<span>.{row.originalAppliedForString}</span>}
            />
            )
          </span>
        ) : null}
        {row.brand ? <span className="ml-2 text-xs font-semibold text-[#006a56]">Brand</span> : null}
      </p>
      <p className="mt-1 font-mono text-xs text-slate-600">{row.applicationId}</p>
      <p className="mt-1 text-xs text-slate-600">
        Status: {row.currentApplicationStatus ?? "—"} · {selectionModeLabel(row.selectionMode)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {scdContentionStatusLabel(row.scdContentionStatus)}
        {row.scdContentionSetId ? ` · set ${row.scdContentionSetId}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Award: {row.officialAwardOutcome === "awarded" ? "Awarded" : "Not established"}
      </p>
      {row.competitors.length > 0 ? (
        <p className="mt-1 text-xs text-slate-600" data-testid={`portfolio-competitors-${row.applicationId}`}>
          Competitors:{" "}
          {row.competitors
            .map((c) => `${c.applicantLegalName} (.${c.appliedForString})`)
            .join("; ")}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3">
        <Link
          href={row.exploreHref}
          className="font-semibold text-[#006a56] underline"
          data-testid={`portfolio-application-details-${row.applicationId}`}
        >
          Application details
        </Link>
        {row.scdContentionStatus === "contested" && row.contentionSetHref ? (
          <Link
            href={row.contentionSetHref}
            className="font-semibold text-[#006a56] underline"
            data-testid={`portfolio-contention-link-${row.applicationId}`}
          >
            Open contention set
            {row.scdContentionSetId ? ` #${row.scdContentionSetId}` : ""}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function ProfileFound({ profile }: { profile: ApplicantIntelligenceProfile }) {
  const evidence = profile.identityEvidence;
  const orgConfirmed = profile.organizationResolutionStatus === "CONFIRMED";
  const [portfolioFilter, setPortfolioFilter] = useState<ApplicantPortfolioFilter>("all");
  const portfolioRef = useRef<HTMLElement | null>(null);
  const selectPortfolioFilter = usePortfolioFilterNavigation(portfolioRef, setPortfolioFilter);
  const filteredPortfolio = filterApplicantPortfolio(profile.portfolio, portfolioFilter);
  const observation = profile.stringStatusObservation;
  const summary = profile.stringStatusSummary;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8" data-testid="applicant-profile">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Applicant profile</p>
      <header className="mt-2" data-testid="applicant-profile-header">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {profile.applicantLegalName}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OrganizationMappingBadge
            status={profile.organizationResolutionStatus}
            name={profile.confirmedOrganizationName}
            href={profile.organizationProfileHref}
          />
          {profile.countries[0] ? (
            <span className="text-sm text-slate-600" data-testid="applicant-country">
              {profile.countries.join(", ")}
              {profile.regions.length ? ` · ${profile.regions.join(", ")}` : ""}
            </span>
          ) : null}
          {evidence?.applicantWebsiteHost ? (
            <a
              href={evidence.applicantWebsiteUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#006a56] underline-offset-2 hover:underline"
              data-testid="header-website"
            >
              {evidence.applicantWebsiteHost}
            </a>
          ) : null}
        </div>
        {orgConfirmed && profile.confirmedOrganizationName ? (
          <p className="mt-2 text-sm text-slate-700" data-testid="header-org-distinction">
            Legal Applicant remains <span className="font-semibold">{profile.applicantLegalName}</span>.
            Broader Organization:{" "}
            {profile.organizationProfileHref ? (
              <Link
                href={profile.organizationProfileHref}
                className="font-semibold text-[#006a56] underline-offset-2 hover:underline"
                data-testid="header-org-profile-link"
              >
                Confirmed · {profile.confirmedOrganizationName}
              </Link>
            ) : (
              <span className="font-semibold">Confirmed · {profile.confirmedOrganizationName}</span>
            )}
            .
          </p>
        ) : profile.organizationResolutionStatus === "UNRESOLVED" ? (
          <p className="mt-2 text-sm text-slate-600" data-testid="header-unresolved-note">
            No broader Organization mapping is confirmed yet. Applicant intelligence below still applies.
          </p>
        ) : null}
        <div className="mt-4" data-testid="applicant-compare-actions">
          <CompareAddButton
            type="applicant"
            entityKey={profile.applicantLegalName}
            label={profile.applicantLegalName}
            testId="applicant-add-to-compare"
          />
        </div>
      </header>

      <ScdProfileSummaryCards
        summary={summary}
        observation={observation}
        activeFilter={portfolioFilter}
        onSelect={selectPortfolioFilter}
      />
      <ProfileSourceSummary observation={observation} />

      <section
        className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-labelledby="at-a-glance-heading"
        data-testid="applicant-at-a-glance"
      >
        <h2 id="at-a-glance-heading" className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-4">
          Additional intelligence
        </h2>
        <Stat label="Applications" value={profile.applicationCount} testId="stat-applications" />
        <Stat
          label="Brand applications"
          value={`${profile.brandApplicationCount} of ${profile.applicationCount}`}
          testId="stat-brand"
        />
        <Stat
          label={contestedApplicationsStatLabel(observation)}
          value={profile.contestedApplicationCount}
          testId="stat-contested"
        />
        <Stat
          label="Unique contention sets"
          value={profile.uniqueContentionSets}
          testId="stat-sets"
        />
        <Stat
          label="Counterpart Applicants"
          value={profile.distinctCounterpartApplicants}
          testId="stat-counterparts"
        />
        <Stat label="Public Main-RSP posture" value={profile.rspPostureLabel} testId="stat-rsp" />
        {profile.confirmedReturning ? (
          <>
            <Stat
              label="2012 Organization apps"
              value={profile.confirmedReturning.applications2012}
              testId="stat-2012"
            />
            <Stat
              label="2026 Organization apps"
              value={profile.confirmedReturning.applications2026}
              testId="stat-2026"
            />
          </>
        ) : null}
      </section>

      <div className="mt-4 flex flex-wrap gap-3 text-sm" data-testid="applicant-profile-actions">
        <Link href={profile.exploreApplicationsHref} className="font-semibold text-[#006a56] underline">
          Explore applications
        </Link>
        <Link href={profile.competitiveLandscapeHref} className="font-semibold text-[#006a56] underline">
          Competitive Landscape
        </Link>
        <Link href={profile.contentionHref} className="font-semibold text-[#006a56] underline">
          Contention
        </Link>
        <Link href={profile.changeSummary.changesHref} className="font-semibold text-[#006a56] underline">
          Recent changes
        </Link>
      </div>

      <section className="mt-8" aria-labelledby="identity-heading" data-testid="applicant-identity-section">
        <h2 id="identity-heading" className="text-lg font-bold text-slate-950">
          Identity
        </h2>
        <ApplicantIdentityEvidencePanel
          applicantLegalName={profile.applicantLegalName}
          organizationStatus={profile.organizationResolutionStatus}
          confirmedOrganizationName={profile.confirmedOrganizationName}
          applicantWebsiteHost={evidence?.applicantWebsiteHost ?? null}
          applicantWebsiteUrl={evidence?.applicantWebsiteUrl ?? null}
          directParentLegalName={evidence?.directParentLegalName ?? null}
          ultimateParentLegalName={evidence?.ultimateParentLegalName ?? null}
          ultimateControlLegalName={evidence?.ultimateControlLegalName ?? null}
          evidenceExplanationLines={evidence?.evidenceExplanationLines ?? []}
          brandApplicationCount={profile.brandApplicationCount}
          applicationCount={profile.applicationCount}
        />
      </section>

      <section
        ref={portfolioRef}
        className="mt-8 scroll-mt-4"
        aria-labelledby="portfolio-heading"
        data-testid="applicant-portfolio-section"
      >
        <h2 id="portfolio-heading" className="text-lg font-bold text-slate-950">
          Application portfolio
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Brand applications: {profile.brandApplicationCount} of {profile.applicationCount}. Applied-for
          strings are Applications under this Applicant — not separate Organizations.
        </p>
        <ProfilePortfolioFilterBar
          activeFilter={portfolioFilter}
          onChange={selectPortfolioFilter}
          showClear
        />
        <ul className="mt-4 space-y-2 md:hidden" data-testid="portfolio-mobile-list">
          {filteredPortfolio.map((row) => (
            <PortfolioRowCard key={row.applicationId} row={row} />
          ))}
        </ul>
        <div className="mt-4 hidden overflow-x-auto md:block" data-testid="portfolio-table-wrap">
          <table className="min-w-full text-left text-sm" data-testid="portfolio-table">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2 font-semibold">Original</th>
                <th className="px-2 py-2 font-semibold">Selected</th>
                <th className="px-2 py-2 font-semibold">Application ID</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Competition status</th>
                <th className="px-2 py-2 font-semibold">Competitors</th>
                <th className="px-2 py-2 font-semibold">Award</th>
              </tr>
            </thead>
            <tbody>
              {filteredPortfolio.map((row) => (
                <tr
                  key={row.applicationId}
                  className="border-b border-slate-100"
                  data-testid={`portfolio-row-${row.applicationId}`}
                >
                  <td className="px-2 py-2 font-medium">
                    <ForecastLink
                      label={row.originalAppliedForString}
                      testId={`portfolio-forecast-original-${row.applicationId}`}
                      fallback={<span>.{row.originalAppliedForString || "—"}</span>}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-800">
                    <ForecastLink
                      label={row.selectedCurrentString}
                      testId={`portfolio-forecast-selected-${row.applicationId}`}
                      fallback={<span>.{row.selectedCurrentString || "—"}</span>}
                    />
                    {row.selectionMode === "selected-replacement" && row.selectedReplacementApplicationId ? (
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                        {row.selectedReplacementApplicationId}
                      </span>
                    ) : null}
                    <Link
                      href={row.exploreHref}
                      className="mt-0.5 block text-[11px] font-semibold text-[#006a56] underline-offset-2 hover:underline"
                      data-testid={`portfolio-application-details-${row.applicationId}`}
                    >
                      Application details
                    </Link>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{row.applicationId}</td>
                  <td className="px-2 py-2 text-xs text-slate-700">
                    {row.currentApplicationStatus ?? "—"}
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {selectionModeLabel(row.selectionMode)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {scdContentionStatusLabel(row.scdContentionStatus)}
                    {row.scdContentionSetId ? (
                      <span className="mt-0.5 block text-slate-500">set {row.scdContentionSetId}</span>
                    ) : null}
                    {row.scdContentionStatus === "contested" && row.contentionSetHref ? (
                      <Link
                        href={row.contentionSetHref}
                        className="mt-0.5 block font-semibold text-[#006a56] underline-offset-2 hover:underline"
                        data-testid={`portfolio-contention-link-${row.applicationId}`}
                      >
                        Open contention set
                      </Link>
                    ) : null}
                    {row.inInitialContention && row.scdContentionStatus === "unavailable" ? (
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        Historical membership: {row.officialContentionSetIds.join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-700">
                    {row.competitors.length === 0
                      ? "—"
                      : row.competitors
                          .map((c) => `${c.applicantLegalName} (.${c.appliedForString})`)
                          .join("; ")}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-700">
                    {row.officialAwardOutcome === "awarded" ? "Awarded" : "Not established"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPortfolio.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600" data-testid="portfolio-filter-empty">
            No applications match this filter.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500" data-testid="portfolio-filter-count">
            Showing {filteredPortfolio.length} of {profile.portfolio.length} applications
            {portfolioFilter !== "all" ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="font-semibold text-[#006a56] underline"
                  onClick={() => selectPortfolioFilter("all")}
                >
                  Show all
                </button>
              </>
            ) : null}
          </p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="contention-heading" data-testid="applicant-contention-section">
        <h2 id="contention-heading" className="text-lg font-bold text-slate-950">
          Contention
        </h2>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">What is a contention set?</p>
          <p className="mt-1 leading-6">{contentionSetExplanation(observation)}</p>
        </div>
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
            <dt className="text-xs uppercase text-slate-500">Distinct counterparts</dt>
            <dd className="font-semibold tabular-nums">{profile.distinctCounterpartApplicants}</dd>
          </div>
        </dl>
        {profile.contentionSets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{noContentionMembershipsLabel(observation)}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {profile.contentionSets.map((set) => (
              <li
                key={set.setId}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
                data-testid={`profile-contention-set-${set.setId}`}
              >
                <p className="font-semibold text-slate-950">
                  Contention set #{set.setId}
                  {set.appliedForStrings[0] ? (
                    <span className="ml-2 font-medium text-slate-700">.{set.appliedForStrings[0]}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-slate-700">
                  ONE CONTENTION SET · {set.applicationCount} Applications ·{" "}
                  {set.distinctApplicantCount} distinct Applicants
                  {set.includesGodaddy ? " · includes GoDaddy" : ""}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  This Applicant&apos;s Applications: {set.applicantApplicationIds.join(", ")}
                </p>
                <ul
                  className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-700"
                  data-testid={`profile-contention-members-${set.setId}`}
                >
                  {set.members.map((m) => (
                    <li key={m.applicationId} className="flex flex-wrap gap-x-2">
                      <Link href={m.exploreHref} className="font-medium text-[#006a56] underline-offset-2 hover:underline">
                        .{m.appliedForString || "—"}
                      </Link>
                      <span aria-hidden="true">—</span>
                      <Link
                        href={m.profileHref}
                        className={`underline-offset-2 hover:underline ${
                          m.isFocalApplicant ? "font-semibold text-slate-950" : "text-[#006a56]"
                        }`}
                      >
                        {m.applicantLegalName}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={set.contentionSetHref}
                  className="mt-2 inline-block font-semibold text-[#006a56] underline"
                >
                  Open set detail
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="rsp-heading" data-testid="applicant-rsp-section">
        <h2 id="rsp-heading" className="text-lg font-bold text-slate-950">
          Public RSP posture
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-900" data-testid="rsp-posture-label">
          {profile.rspPostureLabel}
        </p>
        <p className="mt-1 text-sm text-slate-700">{profile.rspProspectingReason}</p>
        <p className="mt-2 text-xs text-slate-500">
          Selected RSP is not established by the public Applicant data.
        </p>
      </section>

      {profile.organizationContext ? (
        <section
          className="mt-8"
          aria-labelledby="org-context-heading"
          data-testid="applicant-org-context-section"
        >
          <h2 id="org-context-heading" className="text-lg font-bold text-slate-950">
            Organization context
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Confirmed · {profile.organizationContext.organizationName} ·{" "}
            {profile.organizationContext.organizationApplicationCount} Applications ·{" "}
            {profile.organizationContext.organizationContentionMemberships} contention memberships
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Other represented Applicants mapped to {profile.organizationContext.organizationName}:{" "}
            <span className="font-semibold">{profile.organizationContext.siblingApplicantCount}</span>
          </p>
          {profile.organizationContext.siblingApplicants.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm" data-testid="org-sibling-list">
              {profile.organizationContext.siblingApplicants.slice(0, 8).map((s) => (
                <li key={s.applicantLegalName}>
                  <Link href={s.profileHref} className="font-medium text-[#006a56] underline-offset-2 hover:underline">
                    {s.applicantLegalName}
                  </Link>
                  <span className="text-slate-500"> · {s.applicationCount} apps</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {profile.organizationProfileHref ? (
              <Link
                href={profile.organizationProfileHref}
                className="font-semibold text-[#006a56] underline"
                data-testid="view-organization-profile"
              >
                View Organization Profile
              </Link>
            ) : null}
            <Link
              href={`/competitive-landscape?q=${encodeURIComponent(profile.organizationContext.organizationName)}`}
              className="font-semibold text-[#006a56] underline"
            >
              View Organization context
            </Link>
          </div>
        </section>
      ) : null}

      {profile.confirmedReturning ? (
        <section className="mt-8" aria-labelledby="history-heading" data-testid="applicant-history-section">
          <h2 id="history-heading" className="text-lg font-bold text-slate-950">
            Confirmed Organization history
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Organization-level portfolio (not Applicant legal-name continuity):{" "}
            {profile.confirmedReturning.applications2012} Applications in 2012 ·{" "}
            {profile.confirmedReturning.applications2026} in 2026 ·{" "}
            {profile.confirmedReturning.portfolioChange.toLowerCase()} (
            {profile.confirmedReturning.applicationDelta >= 0 ? "+" : ""}
            {profile.confirmedReturning.applicationDelta}).
          </p>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="changes-heading" data-testid="applicant-changes-section">
        <h2 id="changes-heading" className="text-lg font-bold text-slate-950">
          Recent changes
        </h2>
        <p className="mt-2 text-sm text-slate-700">{profile.changeSummary.summaryLine}</p>
        <Link
          href={profile.changeSummary.changesHref}
          className="mt-2 inline-block text-sm font-semibold text-[#006a56] underline"
        >
          Open Change Intelligence
        </Link>
      </section>

      <section className="mt-8" aria-labelledby="sources-heading" data-testid="applicant-sources-section">
        <h2 id="sources-heading" className="text-lg font-bold text-slate-950">
          Sources
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>ICANN Application publication (represented Applications)</li>
          <li>
            {observation.scdContentionEvidence === "ready" ||
            observation.applicationSnapshotId.includes("string-confirmation")
              ? "Published String Confirmation Day contention membership capture"
              : "Official initial contention membership publication"}
          </li>
          {evidence?.applicantWebsiteHost ? <li>ICANN Applicant Website / Application Responses</li> : null}
          <li>Organization resolution sidecar (steward-approved mappings where Confirmed)</li>
          <li>ICANN evaluated Main-RSP list (public capability posture only)</li>
        </ul>
        <Link href="/data-health" className="mt-2 inline-block text-sm font-semibold text-[#006a56] underline">
          Data &amp; methodology
        </Link>
      </section>
    </main>
  );
}

export function ApplicantProfileContent({
  lookup,
}: {
  lookup: ApplicantIntelligenceLookup;
}) {
  return (
    <div className="min-h-screen bg-[#f4f7f8]">
      <HubChrome />
      {!lookup.found ? (
        <main className="mx-auto max-w-[1100px] px-4 py-8" data-testid="applicant-profile-not-found">
          <h1 className="text-xl font-bold text-slate-950">Applicant not found</h1>
          <p className="mt-2 text-sm text-slate-700">
            No represented Applicant legal name matches{" "}
            <span className="font-semibold">{lookup.applicantLegalName || "(empty)"}</span>.
          </p>
          <Link href="/explore" className="mt-4 inline-block font-semibold text-[#006a56] underline">
            Back to Explore
          </Link>
        </main>
      ) : (
        <ProfileFound profile={lookup} />
      )}
      <CompareTrayFloating />
    </div>
  );
}
