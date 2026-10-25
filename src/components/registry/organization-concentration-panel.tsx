"use client";

import Link from "next/link";
import type { OrganizationConcentrationModel } from "@/lib/organization-concentration";
import { organizationProfileHref } from "@/lib/organization-intelligence";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function OrgLink({
  organizationKey,
  organizationName,
}: {
  organizationKey: string;
  organizationName: string;
}) {
  return (
    <Link
      href={organizationProfileHref(organizationKey)}
      className="font-semibold text-[#006a56] underline-offset-2 hover:underline"
    >
      {organizationName}
    </Link>
  );
}

/** Primary Competitive Landscape concentration section. */
export function OrganizationConcentrationLandscapePanel({
  model,
}: {
  model: OrganizationConcentrationModel;
}) {
  const { coverage, applicationConcentration, contentionConcentration, godaddyRelative, topShares, disclosure } =
    model;
  const appTop = applicationConcentration.slice(0, 15);
  const contTop = contentionConcentration.slice(0, 15);

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid="org-concentration-landscape"
      aria-labelledby="org-concentration-heading"
    >
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
          Confirmed Organization concentration
        </p>
        <h2 id="org-concentration-heading" className="mt-1 text-xl font-bold text-slate-950">
          Where confirmed portfolios and contention concentrate
        </h2>
        <p className="mt-2 text-sm text-slate-700" data-testid="org-concentration-coverage">
          {disclosure.applicationCoverageSentence}{" "}
          {disclosure.contentionCoverageSentence} {disclosure.subsetDisclaimer}
        </p>
      </header>

      <dl
        className="grid gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4"
        data-testid="org-concentration-summary"
      >
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Confirmed Organizations</dt>
          <dd className="font-semibold tabular-nums">{coverage.confirmedOrganizations}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Confirmed-subset Applications</dt>
          <dd className="font-semibold tabular-nums">
            {coverage.confirmedApplications.toLocaleString("en-US")} /{" "}
            {coverage.representedApplications.toLocaleString("en-US")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Top 5 — share of confirmed-subset Applications
          </dt>
          <dd className="font-semibold tabular-nums" data-testid="org-concentration-top5-apps">
            {pct(topShares.top5ApplicationShareOfConfirmedSubset)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Top 5 — share of confirmed-subset contention memberships
          </dt>
          <dd className="font-semibold tabular-nums" data-testid="org-concentration-top5-cont">
            {pct(topShares.top5ContentionMembershipShareOfConfirmedSubset)}
          </dd>
        </div>
      </dl>

      {godaddyRelative ? (
        <div
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-sm"
          data-testid="org-concentration-godaddy"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            GoDaddy within Confirmed subset
          </p>
          <p className="mt-1 font-semibold text-slate-950">
            <OrgLink
              organizationKey={godaddyRelative.godaddyOrganizationKey}
              organizationName={godaddyRelative.godaddyOrganizationName}
            />
          </p>
          <p className="mt-1 text-slate-700">
            Application portfolio rank #{godaddyRelative.applicationRankAmongConfirmed} ·{" "}
            {godaddyRelative.applicationCount} Applications ·{" "}
            {pct(godaddyRelative.applicationShareOfConfirmedSubset)} of confirmed-subset Applications
          </p>
          <p className="text-slate-700">
            Contention membership rank #{godaddyRelative.contentionMembershipRankAmongConfirmed} ·{" "}
            {godaddyRelative.contentionMembershipCount} memberships ·{" "}
            {pct(godaddyRelative.contentionMembershipShareOfConfirmedSubset)} of confirmed-subset
            memberships · {godaddyRelative.distinctOfficialContentionSetsTouched} official sets touched
          </p>
          <p className="mt-1 text-slate-600">
            {godaddyRelative.distinctConfirmedCounterpartOrganizations} confirmed counterpart
            Organizations share official contention sets ·{" "}
            {godaddyRelative.totalConfirmedCounterpartMembershipsInSharedSets} counterpart memberships
            in those sets
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div data-testid="org-concentration-portfolio-table">
          <h3 className="text-sm font-semibold text-slate-900">Application portfolio concentration</h3>
          <p className="mt-1 text-xs text-slate-600">
            Share of confirmed-subset Applications ({coverage.confirmedApplications.toLocaleString("en-US")}).
            Confirmed-subset share only — not a round-wide market figure.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Organization</th>
                  <th className="py-2 pr-2 text-right">Apps</th>
                  <th className="py-2 pr-2 text-right">Confirmed-subset share</th>
                  <th className="py-2 text-right">Applicants</th>
                </tr>
              </thead>
              <tbody>
                {appTop.map((row) => (
                  <tr
                    key={row.organizationId}
                    className={
                      row.isGodaddyOrganization ? "bg-emerald-50/80 font-medium" : "border-b border-slate-100"
                    }
                    data-testid={
                      row.isGodaddyOrganization
                        ? "org-concentration-app-row-godaddy"
                        : `org-concentration-app-row-${row.organizationKey}`
                    }
                  >
                    <td className="py-1.5 pr-2 tabular-nums text-slate-500">{row.rankByApplications}</td>
                    <td className="py-1.5 pr-2">
                      <OrgLink
                        organizationKey={row.organizationKey}
                        organizationName={row.organizationName}
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{row.applicationCount}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {pct(row.applicationShareOfConfirmedSubset)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{row.confirmedApplicantCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div data-testid="org-concentration-contention-table">
          <h3 className="text-sm font-semibold text-slate-900">Contention footprint concentration</h3>
          <p className="mt-1 text-xs text-slate-600">
            Share of confirmed-subset official contention memberships (
            {coverage.confirmedContentionMemberships.toLocaleString("en-US")}). Set-touch % is independent and
            does not sum to 100%.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Organization</th>
                  <th className="py-2 pr-2 text-right">Memberships</th>
                  <th className="py-2 pr-2 text-right">Confirmed-subset share</th>
                  <th className="py-2 text-right">Sets touched</th>
                </tr>
              </thead>
              <tbody>
                {contTop.map((row) => (
                  <tr
                    key={row.organizationId}
                    className={
                      row.isGodaddyOrganization ? "bg-emerald-50/80 font-medium" : "border-b border-slate-100"
                    }
                    data-testid={
                      row.isGodaddyOrganization
                        ? "org-concentration-cont-row-godaddy"
                        : `org-concentration-cont-row-${row.organizationKey}`
                    }
                  >
                    <td className="py-1.5 pr-2 tabular-nums text-slate-500">
                      {row.rankByContentionMemberships}
                    </td>
                    <td className="py-1.5 pr-2">
                      <OrgLink
                        organizationKey={row.organizationKey}
                        organizationName={row.organizationName}
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {row.contentionMembershipCount}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {pct(row.contentionMembershipShareOfConfirmedSubset)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {row.distinctContentionSetsTouched}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Unresolved Applications remain source Applicants (
        {coverage.unresolvedApplications.toLocaleString("en-US")} Applications ·{" "}
        {coverage.unresolvedContentionMemberships.toLocaleString("en-US")} contention memberships) and are not
        ranked as Organizations. Top 10 confirmed-subset Application share:{" "}
        {pct(topShares.top10ApplicationShareOfConfirmedSubset)}.
      </p>
    </section>
  );
}

/** Contention-page Organization structure panel (crowded sets + GoDaddy counterparts). */
export function OrganizationConcentrationContentionPanel({
  model,
}: {
  model: OrganizationConcentrationModel;
}) {
  const { coverage, crowdedSets, godaddyRelative, disclosure } = model;
  const counterparts = godaddyRelative?.counterparts.slice(0, 12) ?? [];

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid="org-concentration-contention"
      aria-labelledby="org-concentration-contention-heading"
    >
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
          Organization structure in official contention
        </p>
        <h2 id="org-concentration-contention-heading" className="mt-1 text-xl font-bold text-slate-950">
          Crowded sets and GoDaddy co-membership
        </h2>
        <p className="mt-2 text-sm text-slate-700" data-testid="org-concentration-contention-coverage">
          Official initial contention remains {coverage.officialContentionSets} sets /{" "}
          {coverage.officialContentionMemberships} memberships. {disclosure.contentionCoverageSentence}{" "}
          {coverage.setsWithConfirmedOrganizationMembership}/{coverage.officialContentionSets} sets include at
          least one Confirmed Organization membership.
        </p>
      </header>

      <div data-testid="org-concentration-crowded-sets">
        <h3 className="text-sm font-semibold text-slate-900">Most crowded official contention sets</h3>
        <p className="mt-1 text-xs text-slate-600">
          Ranked by official membership count. Partially unresolved sets are not labeled as single-Organization
          overall.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-2">Set</th>
                <th className="py-2 pr-2 text-right">Memberships</th>
                <th className="py-2 pr-2 text-right">Confirmed</th>
                <th className="py-2 pr-2 text-right">Unresolved</th>
                <th className="py-2 pr-2 text-right">Confirmed Orgs</th>
                <th className="py-2 pr-2">GoDaddy</th>
                <th className="py-2">Structure</th>
              </tr>
            </thead>
            <tbody>
              {crowdedSets.map((s) => (
                <tr key={s.contentionSetId} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    <Link
                      href={`/contention?set=${encodeURIComponent(s.contentionSetId)}`}
                      className="font-semibold text-[#006a56] underline"
                    >
                      #{s.contentionSetId}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{s.officialMembershipCount}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{s.confirmedMembershipCount}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{s.unresolvedMembershipCount}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {s.distinctConfirmedOrganizations}
                  </td>
                  <td className="py-1.5 pr-2">{s.godaddyPresent ? "Yes" : "No"}</td>
                  <td className="py-1.5 text-slate-700">{s.displayStructureLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {godaddyRelative ? (
        <div data-testid="org-concentration-godaddy-counterparts">
          <h3 className="text-sm font-semibold text-slate-900">
            Confirmed counterpart Organizations sharing GoDaddy sets
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Co-membership in official contention sets with {godaddyRelative.godaddyApplicantLegalName}. Same
            Confirmed Organization is excluded from the counterpart list. This is set co-membership, not a
            competitive outcome claim.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Counterpart Organization</th>
                  <th className="py-2 pr-2 text-right">Shared sets</th>
                  <th className="py-2 pr-2 text-right">Memberships in shared sets</th>
                  <th className="py-2 text-right">Distinct Applicants</th>
                </tr>
              </thead>
              <tbody>
                {counterparts.map((c) => (
                  <tr key={c.organizationId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      <OrgLink
                        organizationKey={c.organizationKey}
                        organizationName={c.organizationName}
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {c.sharedSetCountWithGoDaddy}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {c.counterpartMembershipsWithinSharedSets}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {c.distinctCounterpartApplicantNamesWithinSharedSets}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Compact Organization profile concentration context. */
export function OrganizationConcentrationProfileContext({
  model,
  organizationKey,
}: {
  model: OrganizationConcentrationModel;
  organizationKey: string;
}) {
  const row = model.organizations.find((o) => o.organizationKey === organizationKey);
  if (!row) return null;
  return (
    <section
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
      data-testid="org-concentration-profile-context"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Confirmed-subset concentration context
      </p>
      <p className="mt-1 text-slate-800">
        Application portfolio rank #{row.rankByApplications} · {row.applicationCount} Applications ·{" "}
        {(row.applicationShareOfConfirmedSubset * 100).toFixed(1)}% of confirmed-subset Applications
      </p>
      <p className="text-slate-800">
        Contention membership rank #{row.rankByContentionMemberships} · {row.contentionMembershipCount}{" "}
        memberships · {(row.contentionMembershipShareOfConfirmedSubset * 100).toFixed(1)}% of confirmed-subset
        memberships · {row.distinctContentionSetsTouched} official sets touched
      </p>
      <p className="mt-1 text-xs text-slate-600">{model.disclosure.subsetDisclaimer}</p>
    </section>
  );
}
