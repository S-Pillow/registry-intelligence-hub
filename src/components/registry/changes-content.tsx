"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  IMPACT_DISPLAY_LABEL,
  displayImpactLabel,
  displayImpactReasons,
  displayRspPostureLine,
} from "@/change-intel/impact-display";
import { changeMateriality } from "@/change-intel/materiality";
import { applicantProfileHref } from "@/lib/applicant-intelligence";
import type {
  ChangeIntelFeedState,
  ChangeIntelPresentationFeedState,
  ChangeMateriality,
  ChangeRecord,
  DerivedChangeContext,
  PrimaryImpact,
} from "@/change-intel/types";

const CHANGE_TYPE_LABEL: Record<string, string> = {
  APPLICATION_NOW_PRESENT: "Now present in the current published Application list",
  APPLICATION_NO_LONGER_PRESENT: "No longer present in the current published Application list",
  APPLICATION_FIELD_CHANGED: "Application field changed",
  CONTENTION_MEMBERSHIP_ADDED: "Official contention membership added",
  CONTENTION_MEMBERSHIP_REMOVED: "Official contention membership removed",
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " UTC";
  } catch {
    return iso;
  }
}

function impactTone(impact: PrimaryImpact): string {
  if (impact === "GODADDY_DIRECT") return "bg-emerald-100 text-[#004c3d]";
  if (impact === "GODADDY_CONTENTION") return "bg-amber-100 text-amber-950";
  if (impact === "RSP_RESEARCH_RELEVANT") return "bg-sky-100 text-sky-950";
  return "bg-slate-100 text-slate-700";
}

function materialityTone(m: ChangeMateriality): string {
  if (m === "MATERIAL") return "bg-[#004c3d] text-white";
  return "bg-slate-200 text-slate-800";
}

function isPresentationFeed(
  feed: ChangeIntelFeedState | ChangeIntelPresentationFeedState,
): feed is ChangeIntelPresentationFeedState & { initialized: true } {
  return Boolean(feed.initialized && "derivedByChangeId" in feed);
}

function resolveDerived(
  change: ChangeRecord,
  feed: ChangeIntelFeedState | ChangeIntelPresentationFeedState,
): DerivedChangeContext {
  if (isPresentationFeed(feed)) {
    const existing = feed.derivedByChangeId[change.changeId];
    if (existing) return existing;
  }
  // Client-safe fallback when enrichment was not supplied (tests / uninitialized org).
  return {
    materiality: changeMateriality(change),
    organization: {
      organizationSnapshotHash: "not-enriched",
      organizationSnapshotGeneratedAt: null,
      organizationResolutionState: "MISSING",
      confirmedOrganizationId: null,
      confirmedOrganizationKey: null,
      confirmedOrganizationName: null,
      organizationHref: null,
    },
    contentionSetIds: change.contentionSetId ? [change.contentionSetId] : [],
    links: {
      exploreHref: change.exploreHref,
      competitiveLandscapeHref: change.competitiveLandscapeHref,
      applicantHref: change.applicantLegalName
        ? applicantProfileHref(change.applicantLegalName)
        : null,
      organizationHref: null,
      contentionSets: change.contentionSetId
        ? [
            {
              contentionSetId: change.contentionSetId,
              href: `/contention?set=${encodeURIComponent(change.contentionSetId)}`,
            },
          ]
        : [],
      compareHref: null,
    },
    displayImpactLabel: displayImpactLabel(change.primaryImpact),
    displayImpactReasons: displayImpactReasons(change.impactReasons),
    displayRspPosture: displayRspPostureLine(change.rspPublicPosture, change.primaryImpact),
  };
}

function ChangeEntry({
  change,
  derived,
}: {
  change: ChangeRecord;
  derived: DerivedChangeContext;
}) {
  const org = derived.organization;
  const contentionLinks =
    derived.links.contentionSets.length > 0
      ? derived.links.contentionSets
      : change.contentionSetId
        ? [
            {
              contentionSetId: change.contentionSetId,
              href: `/contention?set=${encodeURIComponent(change.contentionSetId)}`,
            },
          ]
        : [];

  return (
    <article
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid={`change-entry-${change.changeId}`}
      data-impact={change.primaryImpact}
      data-materiality={derived.materiality}
      data-org-state={org.organizationResolutionState}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {change.sourceType === "application" ? "Application" : "Contention"}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950" data-testid="change-what">
            {CHANGE_TYPE_LABEL[change.changeType] ?? change.changeType}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${materialityTone(derived.materiality)}`}
            data-testid="change-materiality-chip"
          >
            {derived.materiality === "MATERIAL" ? "Material" : "Contextual"}
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${impactTone(change.primaryImpact)}`}
            data-testid="change-impact-label"
          >
            {derived.displayImpactLabel}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        {change.appliedForString ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Applied-for string</dt>
            <dd className="font-semibold">.{change.appliedForString}</dd>
          </div>
        ) : null}

        {change.applicantLegalName ? (
          <div data-testid="change-applicant-row">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Applicant</dt>
            <dd className="font-semibold">
              <Link
                href={derived.links.applicantHref ?? applicantProfileHref(change.applicantLegalName)}
                className="text-[#006a56] underline-offset-2 hover:underline"
                data-testid="change-applicant-profile-link"
              >
                {change.applicantLegalName}
              </Link>
            </dd>
          </div>
        ) : null}

        {org.organizationResolutionState === "CONFIRMED" && org.confirmedOrganizationName ? (
          <div data-testid="change-organization-row">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Organization</dt>
            <dd className="font-semibold">
              {org.organizationHref ? (
                <Link
                  href={org.organizationHref}
                  className="text-[#006a56] underline-offset-2 hover:underline"
                  data-testid="change-organization-profile-link"
                >
                  {org.confirmedOrganizationName}
                </Link>
              ) : (
                org.confirmedOrganizationName
              )}
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Current RIH Confirmed Organization · snapshot {org.organizationSnapshotHash.slice(0, 12)}…
              </span>
            </dd>
          </div>
        ) : change.applicantLegalName ? (
          <div data-testid="change-organization-row">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Organization</dt>
            <dd className="text-slate-600" data-testid="change-organization-unresolved">
              Organization not yet resolved
            </dd>
          </div>
        ) : null}

        {change.applicationId ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Application ID</dt>
            <dd className="font-mono text-xs">{change.applicationId}</dd>
          </div>
        ) : null}

        {contentionLinks.length > 0 ? (
          <div data-testid="change-contention-row">
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Contention set{contentionLinks.length > 1 ? "s" : ""}
            </dt>
            <dd className="font-semibold">
              {contentionLinks.map((c, i) => (
                <span key={c.contentionSetId}>
                  {i > 0 ? ", " : null}
                  <Link
                    href={c.href}
                    className="text-[#006a56] underline"
                    data-testid="change-contention-set-link"
                  >
                    #{c.contentionSetId}
                  </Link>
                </span>
              ))}
            </dd>
          </div>
        ) : null}

        {derived.displayRspPosture ? (
          <div className="sm:col-span-2" data-testid="change-rsp-posture">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Public RSP posture</dt>
            <dd>{derived.displayRspPosture}</dd>
          </div>
        ) : null}
      </dl>

      {change.fieldChanges.length > 0 ? (
        <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm" data-testid="change-field-diffs">
          {change.fieldChanges.map((fc) => (
            <li key={fc.field}>
              <span className="font-semibold text-slate-800">{fc.field}</span>:{" "}
              <span className="text-slate-600">{String(fc.before)}</span>
              {" → "}
              <span className="text-slate-900">{String(fc.after)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {derived.displayImpactReasons.length > 0 ? (
        <ul
          className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600"
          data-testid="change-impact-reasons"
        >
          {derived.displayImpactReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 flex flex-wrap gap-3 text-sm">
        {derived.links.exploreHref ?? change.exploreHref ? (
          <Link
            href={derived.links.exploreHref ?? change.exploreHref!}
            className="font-semibold text-[#006a56] underline"
            data-testid="change-explore-link"
          >
            Open in Explore
          </Link>
        ) : null}
        {derived.links.competitiveLandscapeHref ?? change.competitiveLandscapeHref ? (
          <Link
            href={derived.links.competitiveLandscapeHref ?? change.competitiveLandscapeHref!}
            className="font-semibold text-[#006a56] underline"
            data-testid="change-landscape-link"
          >
            Competitive Landscape
          </Link>
        ) : null}
        {derived.links.applicantHref ? (
          <Link
            href={derived.links.applicantHref}
            className="font-semibold text-[#006a56] underline"
            data-testid="change-applicant-link"
          >
            Applicant
          </Link>
        ) : null}
        {derived.links.organizationHref ? (
          <Link
            href={derived.links.organizationHref}
            className="font-semibold text-[#006a56] underline"
            data-testid="change-organization-link"
          >
            Organization
          </Link>
        ) : null}
      </p>
    </article>
  );
}

export function ChangesContent({
  feed,
  fixtureMode = false,
}: {
  feed: ChangeIntelFeedState | ChangeIntelPresentationFeedState;
  fixtureMode?: boolean;
}) {
  const [impact, setImpact] = useState<"all" | PrimaryImpact>("all");
  const [type, setType] = useState<"all" | "application" | "contention">("all");
  const [materiality, setMateriality] = useState<"all" | ChangeMateriality>("all");
  const [q, setQ] = useState("");

  const latest = feed.initialized ? feed.latestDiff : null;
  const history = useMemo(
    () => (feed.initialized ? feed.recentMeaningfulDiffs : []),
    [feed],
  );

  const entries = useMemo(() => {
    const source =
      latest && !latest.semanticUnchanged && latest.changes.length
        ? latest.changes
        : history[0]?.changes ?? [];
    return source.filter((c) => {
      if (impact !== "all" && c.primaryImpact !== impact) return false;
      if (type !== "all" && c.sourceType !== type) return false;
      const derived = resolveDerived(c, feed);
      if (materiality !== "all" && derived.materiality !== materiality) return false;
      if (!q.trim()) return true;
      const orgName = derived.organization.confirmedOrganizationName ?? "";
      const hay =
        `${c.applicantLegalName ?? ""} ${c.appliedForString ?? ""} ${c.applicationId ?? ""} ${orgName}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [latest, history, impact, type, materiality, q, feed]);

  if (!feed.initialized) {
    return (
      <section data-testid="changes-not-initialized" className="space-y-4">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Changes</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">What changed in the 2026 round</h1>
        </header>
        <div className="rounded-xl border border-slate-300 bg-white px-4 py-6 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">
            Change monitoring has not been initialized for this environment yet.
          </p>
          <p className="mt-2">
            Monitoring history begins when Change Intelligence is bootstrapped from the accepted
            public Application and contention sources. No fabricated history is shown.
          </p>
        </div>
      </section>
    );
  }

  const zeroLatest = Boolean(latest?.semanticUnchanged || (latest && latest.changes.length === 0));
  const summary = latest?.summary;

  return (
    <section data-testid="changes-content" className="space-y-6" data-fixture={fixtureMode ? "true" : undefined}>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Changes</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">What changed in the 2026 round</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Public Application and official initial contention changes since the prior source
          observation — prioritized for GoDaddy Registry impact.
        </p>
        {isPresentationFeed(feed) ? (
          <p className="mt-1 text-xs text-slate-500" data-testid="changes-org-snapshot-hash">
            Organization context from current RIH snapshot{" "}
            <span className="font-mono">{feed.organizationSnapshotHash.slice(0, 16)}…</span>
          </p>
        ) : null}
      </header>

      <div
        className="grid gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm sm:grid-cols-3"
        data-testid="changes-orientation"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Last checked</p>
          <p className="mt-1 font-semibold" data-testid="changes-last-checked">
            {formatWhen(feed.lastCheckedAt)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Compared with</p>
          <p className="mt-1 font-semibold" data-testid="changes-compared-with">
            {formatWhen(feed.comparedWithObservedAt)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Latest change detected</p>
          <p className="mt-1 font-semibold" data-testid="changes-last-meaningful">
            {formatWhen(feed.lastMeaningfulChangeAt)}
          </p>
        </div>
      </div>

      {summary && !zeroLatest ? (
        <ul
          className="flex flex-wrap gap-2 text-xs font-semibold"
          data-testid="changes-summary-counts"
        >
          <li className="rounded-md bg-slate-100 px-2 py-1">Application {summary.applicationChanges}</li>
          <li className="rounded-md bg-slate-100 px-2 py-1">Contention {summary.contentionChanges}</li>
          <li className="rounded-md bg-emerald-100 px-2 py-1 text-[#004c3d]">
            GoDaddy direct {summary.godaddyDirect}
          </li>
          <li className="rounded-md bg-amber-100 px-2 py-1 text-amber-950">
            GoDaddy contention {summary.godaddyContention}
          </li>
          <li className="rounded-md bg-sky-100 px-2 py-1 text-sky-950">
            Public Main-RSP unmatched {summary.rspResearchRelevant}
          </li>
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2" data-testid="changes-filters">
        <select
          aria-label="Filter by impact"
          value={impact}
          onChange={(e) => setImpact(e.target.value as typeof impact)}
          className="h-10 rounded-lg border border-slate-400 px-2 text-sm"
          data-testid="changes-filter-impact"
        >
          <option value="all">Impact: all</option>
          <option value="GODADDY_DIRECT">GoDaddy direct</option>
          <option value="GODADDY_CONTENTION">GoDaddy contention</option>
          <option value="RSP_RESEARCH_RELEVANT">Public Main-RSP unmatched</option>
          <option value="MARKET_CHANGE">Market</option>
        </select>
        <select
          aria-label="Filter by materiality"
          value={materiality}
          onChange={(e) => setMateriality(e.target.value as typeof materiality)}
          className="h-10 rounded-lg border border-slate-400 px-2 text-sm"
          data-testid="changes-filter-materiality"
        >
          <option value="all">Materiality: all</option>
          <option value="MATERIAL">Material</option>
          <option value="CONTEXTUAL">Contextual</option>
        </select>
        <select
          aria-label="Filter by change type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="h-10 rounded-lg border border-slate-400 px-2 text-sm"
          data-testid="changes-filter-type"
        >
          <option value="all">Type: all</option>
          <option value="application">Application</option>
          <option value="contention">Contention</option>
        </select>
        <input
          aria-label="Search changes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Applicant, string, or Application ID"
          className="h-10 min-w-[14rem] flex-1 rounded-lg border border-slate-400 px-3 text-sm"
          data-testid="changes-search"
        />
      </div>

      {zeroLatest ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950"
          data-testid="changes-zero-state"
        >
          <p className="font-semibold">
            No public Application or official contention changes were detected in the latest check.
          </p>
          <p className="mt-1">
            Last checked {formatWhen(feed.lastCheckedAt)}. Prior meaningful changes remain below when
            available.
          </p>
        </div>
      ) : null}

      <div className="space-y-3" data-testid="changes-feed">
        {entries.length === 0 && !zeroLatest ? (
          <p className="text-sm text-slate-600">No changes match the current filters.</p>
        ) : null}
        {entries.map((change) => (
          <ChangeEntry
            key={change.changeId}
            change={change}
            derived={resolveDerived(change, feed)}
          />
        ))}
        {zeroLatest && history[0]?.changes?.length ? (
          <>
            <h2 className="pt-2 text-lg font-semibold text-slate-900">Recent meaningful changes</h2>
            {history[0].changes
              .filter((c) => {
                if (impact !== "all" && c.primaryImpact !== impact) return false;
                if (type !== "all" && c.sourceType !== type) return false;
                const derived = resolveDerived(c, feed);
                if (materiality !== "all" && derived.materiality !== materiality) return false;
                if (!q.trim()) return true;
                const orgName = derived.organization.confirmedOrganizationName ?? "";
                const hay =
                  `${c.applicantLegalName ?? ""} ${c.appliedForString ?? ""} ${c.applicationId ?? ""} ${orgName}`.toLowerCase();
                return hay.includes(q.trim().toLowerCase());
              })
              .map((change) => (
                <ChangeEntry
                  key={`hist-${change.changeId}`}
                  change={change}
                  derived={resolveDerived(change, feed)}
                />
              ))}
          </>
        ) : null}
      </div>

      <aside className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Sources: ICANN public Application data · ICANN official initial contention data. Selected RSP
        is not disclosed in public Application data. Organization context is current RIH Confirmed
        identity intelligence applied at read time — not a historical claim about the observation.
        Technical hashes live in Data &amp; methodology.
      </aside>
    </section>
  );
}

export function CommandCenterRecentChangesCard({
  feed,
}: {
  feed: ChangeIntelFeedState | ChangeIntelPresentationFeedState;
}) {
  if (!feed.initialized) {
    return (
      <section
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
        data-testid="cc-recent-changes"
        data-change-state="uninitialized"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Recent changes</h2>
          <p className="text-xs text-slate-600">
            Change monitoring has not been initialized for this environment yet.
          </p>
        </div>
      </section>
    );
  }
  const latest = feed.latestDiff;
  const count = latest && !latest.semanticUnchanged ? latest.changes.length : 0;
  const top = latest?.changes?.[0];

  if (count === 0) {
    return (
      <section
        className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
        data-testid="cc-recent-changes"
        data-change-state="zero"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-slate-800">
            <span className="font-semibold text-slate-900">Recent changes</span>
            <span className="mx-1.5 text-slate-400" aria-hidden>
              ·
            </span>
            <span data-testid="cc-recent-changes-status">
              Last checked {formatWhen(feed.lastCheckedAt)} · No public Application or contention
              changes.
            </span>
          </p>
          <Link
            href="/changes"
            className="text-sm font-semibold text-[#006a56] underline-offset-2 hover:underline"
            data-testid="cc-view-changes-cta"
          >
            View changes
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid="cc-recent-changes"
      data-change-state="nonzero"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">What changed</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight">Recent changes</h2>
      <p className="mt-2 text-sm text-slate-700" data-testid="cc-recent-changes-status">
        Last checked {formatWhen(feed.lastCheckedAt)}. {count} meaningful change
        {count === 1 ? "" : "s"} in the latest check.
      </p>
      {top ? (
        <p className="mt-2 text-sm text-slate-800" data-testid="cc-recent-changes-top">
          Highest priority: {IMPACT_DISPLAY_LABEL[top.primaryImpact]}
          {top.applicantLegalName ? ` · ${top.applicantLegalName}` : ""}
          {top.appliedForString ? ` · .${top.appliedForString}` : ""}
        </p>
      ) : null}
      <p className="mt-3">
        <Link
          href="/changes"
          className="font-semibold text-[#006a56] underline"
          data-testid="cc-view-changes-cta"
        >
          View changes
        </Link>
      </p>
    </section>
  );
}
