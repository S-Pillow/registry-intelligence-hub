"use client";

import Link from "next/link";
import type {
  OrganizationContentionPairModel,
  OrganizationCounterpartSummary,
} from "@/lib/organization-contention-pairs";
import { organizationProfileHref } from "@/lib/organization-intelligence";

function OrgLink({ organizationKey, organizationName }: { organizationKey: string; organizationName: string }) {
  return (
    <Link
      href={organizationProfileHref(organizationKey)}
      className="font-semibold text-[#006a56] underline-offset-2 hover:underline"
    >
      {organizationName}
    </Link>
  );
}

function SharedSetsCell({ sharedSetIds, sharedSetCount }: { sharedSetIds: string[]; sharedSetCount: number }) {
  if (sharedSetCount === 1 && sharedSetIds[0]) {
    return (
      <Link
        href={`/contention?set=${encodeURIComponent(sharedSetIds[0])}`}
        className="font-semibold text-[#006a56] underline tabular-nums"
      >
        {sharedSetCount}
      </Link>
    );
  }
  return (
    <details className="text-right">
      <summary className="cursor-pointer tabular-nums text-[#006a56]">{sharedSetCount}</summary>
      <ul className="mt-1 max-h-28 overflow-y-auto text-left text-xs">
        {sharedSetIds.slice(0, 25).map((id) => (
          <li key={id}>
            <Link href={`/contention?set=${encodeURIComponent(id)}`} className="text-[#006a56] underline">
              #{id}
            </Link>
          </li>
        ))}
        {sharedSetIds.length > 25 ? (
          <li className="text-slate-500">+{sharedSetIds.length - 25} more</li>
        ) : null}
      </ul>
    </details>
  );
}

/** Primary Contention surface: repeated Confirmed Organization co-membership. */
export function OrganizationContentionPairsPanel({
  model,
}: {
  model: OrganizationContentionPairModel;
}) {
  const { coverage, topPairs, widestCounterpartBreadth, disclosure } = model;
  const top = topPairs.slice(0, 15);
  const breadth = widestCounterpartBreadth.slice(0, 10);

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid="org-contention-pairs"
      aria-labelledby="org-contention-pairs-heading"
    >
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
          Confirmed Organization repeated co-membership
        </p>
        <h2 id="org-contention-pairs-heading" className="mt-1 text-xl font-bold text-slate-950">
          Structural overlap in official contention sets
        </h2>
        <p className="mt-2 text-sm text-slate-700" data-testid="org-contention-pairs-coverage">
          {disclosure.confirmedOnlySentence} {disclosure.membershipCoverageSentence}{" "}
          {disclosure.pairableSetsSentence} {disclosure.nonConfirmedSentence}
        </p>
      </header>

      <dl
        className="grid gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4"
        data-testid="org-contention-pairs-summary"
      >
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Unique Confirmed pairs</dt>
          <dd className="font-semibold tabular-nums">{coverage.uniqueConfirmedOrganizationPairs}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Recurring pairs (&gt;1 set)</dt>
          <dd className="font-semibold tabular-nums">{coverage.recurringConfirmedOrganizationPairs}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Pairable official sets</dt>
          <dd className="font-semibold tabular-nums">
            {coverage.pairableOfficialSets} / {coverage.officialContentionSets}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Orgs with a Confirmed counterpart</dt>
          <dd className="font-semibold tabular-nums">
            {coverage.confirmedOrganizationsWithPair} / {coverage.confirmedOrganizations}
          </dd>
        </div>
      </dl>

      <div data-testid="org-contention-pairs-table">
        <h3 className="text-sm font-semibold text-slate-900">Top repeated Organization pairings</h3>
        <p className="mt-1 text-xs text-slate-600">
          Ranked by shared official sets, then membership interactions. Co-membership is structural overlap —
          not a commercial-outcome claim.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-2">Organization A</th>
                <th className="py-2 pr-2">Organization B</th>
                <th className="py-2 pr-2 text-right">Shared official sets</th>
                <th className="py-2 pr-2 text-right">Membership interactions</th>
                <th className="py-2 text-right">Largest shared set</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row) => (
                <tr key={row.pairKey} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    <OrgLink
                      organizationKey={row.organizationAKey}
                      organizationName={row.organizationAName}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <OrgLink
                      organizationKey={row.organizationBKey}
                      organizationName={row.organizationBName}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <SharedSetsCell
                      sharedSetIds={row.sharedSetIds}
                      sharedSetCount={row.sharedSetCount}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{row.membershipInteractions}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.largestOfficialSharedSetSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div data-testid="org-contention-pairs-breadth">
        <h3 className="text-sm font-semibold text-slate-900">Confirmed counterpart breadth</h3>
        <p className="mt-1 text-xs text-slate-600">
          Distinct Confirmed counterparts — how many other Confirmed Organizations share at least one official
          set. Not market reach or influence.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-2">Organization</th>
                <th className="py-2 pr-2 text-right">Distinct Confirmed counterparts</th>
                <th className="py-2 text-right">Recurring counterparts</th>
              </tr>
            </thead>
            <tbody>
              {breadth.map((row) => (
                <tr
                  key={row.organizationId}
                  className={
                    row.isGodaddyOrganization
                      ? "bg-emerald-50/80 font-medium"
                      : "border-b border-slate-100"
                  }
                >
                  <td className="py-1.5 pr-2">
                    <OrgLink
                      organizationKey={row.organizationKey}
                      organizationName={row.organizationName}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {row.distinctConfirmedCounterpartCount}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{row.recurringCounterpartCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** Compact Landscape teaser. */
export function OrganizationContentionPairsLandscapeTeaser({
  model,
}: {
  model: OrganizationContentionPairModel;
}) {
  const topPairs = model.topPairs.slice(0, 5);
  const breadth = model.widestCounterpartBreadth.slice(0, 5);
  return (
    <section
      className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid="org-contention-pairs-landscape"
    >
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
          Repeated Organization pairings
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-950">Confirmed co-membership highlights</h2>
        <p className="mt-1 text-sm text-slate-700">{model.disclosure.confirmedOnlySentence}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Top 5 repeated pairs</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {topPairs.map((p) => (
              <li key={p.pairKey}>
                <OrgLink organizationKey={p.organizationAKey} organizationName={p.organizationAName} />
                {" · "}
                <OrgLink organizationKey={p.organizationBKey} organizationName={p.organizationBName} />
                <span className="tabular-nums text-slate-600"> — {p.sharedSetCount} sets</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Widest Confirmed counterpart breadth</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {breadth.map((o) => (
              <li key={o.organizationId}>
                <OrgLink organizationKey={o.organizationKey} organizationName={o.organizationName} />
                <span className="tabular-nums text-slate-600">
                  {" "}
                  — {o.distinctConfirmedCounterpartCount} counterparts
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-sm">
        <Link href="/contention" className="font-semibold text-[#006a56] underline">
          Open Contention for full co-membership tables
        </Link>
      </p>
    </section>
  );
}

/** Organization profile frequent counterparts. */
export function OrganizationContentionPairsProfileContext({
  summary,
}: {
  summary: OrganizationCounterpartSummary | null;
}) {
  if (!summary) return null;
  const top = summary.counterparts.slice(0, 10);
  return (
    <section
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
      data-testid="org-contention-pairs-profile"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Frequent contention counterparts
      </p>
      {summary.distinctConfirmedCounterpartCount === 0 ? (
        <p className="mt-2 text-slate-700" data-testid="org-contention-pairs-profile-zero">
          No Confirmed Organization counterpart is present in the current official contention data. Unresolved
          or non-Confirmed memberships may still exist in official sets.
        </p>
      ) : (
        <>
          <p className="mt-1 text-slate-800">
            Distinct Confirmed counterparts:{" "}
            <span className="font-semibold tabular-nums">{summary.distinctConfirmedCounterpartCount}</span>
            {" · "}
            Recurring counterparts:{" "}
            <span className="font-semibold tabular-nums">{summary.recurringCounterpartCount}</span>
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1.5 pr-2">Counterpart</th>
                  <th className="py-1.5 pr-2 text-right">Shared sets</th>
                  <th className="py-1.5 pr-2 text-right">Membership interactions</th>
                  <th className="py-1.5 text-right">Largest shared set</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c) => (
                  <tr key={c.organizationId} className="border-b border-slate-100">
                    <td className="py-1 pr-2">
                      <OrgLink
                        organizationKey={c.organizationKey}
                        organizationName={c.organizationName}
                      />
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <SharedSetsCell
                        sharedSetIds={c.sharedSetIds}
                        sharedSetCount={c.sharedSetCount}
                      />
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{c.membershipInteractions}</td>
                    <td className="py-1 text-right tabular-nums">{c.largestOfficialSharedSetSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-2 text-xs text-slate-600">
        Co-membership in official contention sets only — not a commercial-outcome claim.
      </p>
    </section>
  );
}
