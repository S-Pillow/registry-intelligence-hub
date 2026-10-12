"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  ChangeIntelFeedState,
  ChangeRecord,
  PrimaryImpact,
} from "@/change-intel/types";
import { applicantProfileHref } from "@/lib/applicant-intelligence";

const IMPACT_LABEL: Record<PrimaryImpact, string> = {
  GODADDY_DIRECT: "GoDaddy direct",
  GODADDY_CONTENTION: "GoDaddy contention",
  RSP_RESEARCH_RELEVANT: "RSP research",
  MARKET_CHANGE: "Market",
};

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

function ChangeEntry({ change }: { change: ChangeRecord }) {
  return (
    <article
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid={`change-entry-${change.changeId}`}
      data-impact={change.primaryImpact}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {change.sourceType === "application" ? "Application" : "Contention"}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {CHANGE_TYPE_LABEL[change.changeType] ?? change.changeType}
          </h3>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${impactTone(change.primaryImpact)}`}
          data-testid="change-impact-label"
        >
          {IMPACT_LABEL[change.primaryImpact]}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        {change.appliedForString ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Applied-for string</dt>
            <dd className="font-semibold">.{change.appliedForString}</dd>
          </div>
        ) : null}
        {change.applicantLegalName ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Applicant</dt>
            <dd className="font-semibold">
              <Link
                href={applicantProfileHref(change.applicantLegalName)}
                className="text-[#006a56] underline-offset-2 hover:underline"
                data-testid="change-applicant-profile-link"
              >
                {change.applicantLegalName}
              </Link>
            </dd>
          </div>
        ) : null}
        {change.applicationId ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Application ID</dt>
            <dd className="font-mono text-xs">{change.applicationId}</dd>
          </div>
        ) : null}
        {change.contentionSetId ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Contention set</dt>
            <dd className="font-semibold">
              <Link
                href={`/contention?set=${encodeURIComponent(change.contentionSetId)}`}
                className="text-[#006a56] underline"
                data-testid="change-contention-set-link"
              >
                #{change.contentionSetId}
              </Link>
            </dd>
          </div>
        ) : null}
        {change.rspPublicPosture ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Public RSP posture</dt>
            <dd>{change.rspPublicPosture}</dd>
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
      {change.impactReasons.length > 0 ? (
        <p className="mt-3 text-sm text-slate-600">{change.impactReasons[0]}</p>
      ) : null}
      <p className="mt-3 flex flex-wrap gap-3 text-sm">
        {change.exploreHref ? (
          <Link href={change.exploreHref} className="font-semibold text-[#006a56] underline">
            Open in Explore
          </Link>
        ) : null}
        {change.competitiveLandscapeHref ? (
          <Link
            href={change.competitiveLandscapeHref}
            className="font-semibold text-[#006a56] underline"
          >
            Competitive Landscape
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
  feed: ChangeIntelFeedState;
  fixtureMode?: boolean;
}) {
  const [impact, setImpact] = useState<"all" | PrimaryImpact>("all");
  const [type, setType] = useState<"all" | "application" | "contention">("all");
  const [q, setQ] = useState("");

  const latest = feed.initialized ? feed.latestDiff : null;
  const history = useMemo(
    () => (feed.initialized ? feed.recentMeaningfulDiffs : []),
    [feed],
  );

  const entries = useMemo(() => {
    const source = latest && !latest.semanticUnchanged && latest.changes.length
      ? latest.changes
      : history[0]?.changes ?? [];
    return source.filter((c) => {
      if (impact !== "all" && c.primaryImpact !== impact) return false;
      if (type !== "all" && c.sourceType !== type) return false;
      if (!q.trim()) return true;
      const hay = `${c.applicantLegalName ?? ""} ${c.appliedForString ?? ""} ${c.applicationId ?? ""}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [latest, history, impact, type, q]);

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
            RSP research {summary.rspResearchRelevant}
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
          <option value="RSP_RESEARCH_RELEVANT">RSP research</option>
          <option value="MARKET_CHANGE">Market</option>
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
          <ChangeEntry key={change.changeId} change={change} />
        ))}
        {zeroLatest && history[0]?.changes?.length ? (
          <>
            <h2 className="pt-2 text-lg font-semibold text-slate-900">Recent meaningful changes</h2>
            {history[0].changes
              .filter((c) => {
                if (impact !== "all" && c.primaryImpact !== impact) return false;
                if (type !== "all" && c.sourceType !== type) return false;
                if (!q.trim()) return true;
                const hay = `${c.applicantLegalName ?? ""} ${c.appliedForString ?? ""} ${c.applicationId ?? ""}`.toLowerCase();
                return hay.includes(q.trim().toLowerCase());
              })
              .map((change) => (
                <ChangeEntry key={`hist-${change.changeId}`} change={change} />
              ))}
          </>
        ) : null}
      </div>

      <aside className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Sources: ICANN public Application data · ICANN official initial contention data. Selected RSP
        is not disclosed in public Application data. Technical hashes live in Data &amp; methodology.
      </aside>
    </section>
  );
}

export function CommandCenterRecentChangesCard({ feed }: { feed: ChangeIntelFeedState }) {
  if (!feed.initialized) {
    return (
      <section
        className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
        data-testid="cc-recent-changes"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">What changed</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight">Recent changes</h2>
        <p className="mt-2 text-sm text-slate-700">
          Change monitoring has not been initialized for this environment yet.
        </p>
      </section>
    );
  }
  const latest = feed.latestDiff;
  const count = latest && !latest.semanticUnchanged ? latest.changes.length : 0;
  const top = latest?.changes?.[0];
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-testid="cc-recent-changes"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">What changed</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight">Recent changes</h2>
      <p className="mt-2 text-sm text-slate-700">
        Last checked {formatWhen(feed.lastCheckedAt)}.{" "}
        {count === 0
          ? "No public Application or contention changes in the latest check."
          : `${count} meaningful change${count === 1 ? "" : "s"} in the latest check.`}
      </p>
      {top ? (
        <p className="mt-2 text-sm text-slate-800" data-testid="cc-recent-changes-top">
          Highest priority: {IMPACT_LABEL[top.primaryImpact]}
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
