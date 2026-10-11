"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHubRegistryData } from "@/components/registry/hub-registry-data-provider";
import {
  ApplicantIdentityEvidencePanel,
  OrganizationMappingBadge,
  OrganizationMappingExplainer,
} from "@/components/registry/organization-mapping-display";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import type { ParticipantOverlays } from "@/lib/participant-intelligence";
import {
  buildContentionIntelligence,
  contentionPageHref,
  filterContentionSets,
  type ContentionGodaddyFilter,
  type ContentionSetRow,
  type ContentionSizeFilter,
} from "@/lib/contention-intelligence";

function Metric({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function SetDetailPanel({
  set,
  onClose,
}: {
  set: ContentionSetRow;
  onClose: () => void;
}) {
  const counterparts = set.members.filter((m) => !m.isGodaddyApplicant);
  const uniqueCounterpartNames = [...new Set(counterparts.map((m) => m.applicantLegalName))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contention-set-detail-title"
      data-testid="contention-set-detail"
    >
      <button type="button" className="flex-1 cursor-default" aria-label="Close detail" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">Initial contention set</p>
            <h2 id="contention-set-detail-title" className="mt-1 text-lg font-bold text-slate-950">
              Set #{set.setId}
              {set.appliedForStrings[0] ? (
                <span className="ml-2 font-semibold text-slate-700">.{set.appliedForStrings[0]}</span>
              ) : null}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-4">
          <section aria-labelledby="set-summary-heading">
            <h3 id="set-summary-heading" className="text-sm font-bold text-slate-950">
              Set summary
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs uppercase text-slate-500">Applications</dt>
                <dd className="font-semibold tabular-nums" data-testid="detail-total-apps">
                  {set.totalApplications}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs uppercase text-slate-500">Distinct Applicants</dt>
                <dd className="font-semibold tabular-nums" data-testid="detail-distinct-applicants">
                  {set.distinctApplicants}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs uppercase text-slate-500">GoDaddy Applications</dt>
                <dd className="font-semibold tabular-nums">{set.godaddyApplications}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs uppercase text-slate-500">Counterpart Applicants</dt>
                <dd className="font-semibold tabular-nums">{set.distinctCounterpartApplicants}</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm text-slate-700">
              {set.includesGodaddy ? (
                <Badge className="bg-emerald-100 text-[#006a56]" data-testid="detail-godaddy-present">
                  Includes Registry Services, LLC
                </Badge>
              ) : (
                <Badge variant="outline" data-testid="detail-godaddy-absent">
                  No GoDaddy Applicant
                </Badge>
              )}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Official initial identical-string contention memberships — not a prediction of final outcome.
            </p>
          </section>

          {set.includesGodaddy && uniqueCounterpartNames.length > 0 ? (
            <section aria-labelledby="counterparts-heading" data-testid="set-counterpart-context">
              <h3 id="counterparts-heading" className="text-sm font-bold text-slate-950">
                Counterpart Applicants
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {uniqueCounterpartNames.map((name) => {
                  const sample = counterparts.find((m) => m.applicantLegalName === name)!;
                  return (
                    <li key={name} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={sample.exploreApplicantHref} className="font-semibold text-[#006a56] underline">
                          {name}
                        </Link>
                        <OrganizationMappingBadge
                          status={sample.organizationResolutionStatus}
                          name={sample.confirmedOrganizationName}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{sample.rspPublicPostureLabel}</p>
                      {sample.rspPublicPostureLabel === "No public Main-RSP capability found" ? (
                        <p className="mt-0.5 text-xs text-slate-500">Relevant for RSP research</p>
                      ) : null}
                      <p className="mt-1">
                        <Link
                          href={sample.competitiveLandscapeHref}
                          className="text-xs font-semibold text-[#006a56] underline"
                        >
                          Competitive Landscape
                        </Link>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="members-heading">
            <h3 id="members-heading" className="text-sm font-bold text-slate-950">
              Members
            </h3>
            <ul className="mt-2 space-y-2" data-testid="set-members-list">
              {set.members.map((m) => (
                <li
                  key={`${set.setId}-${m.applicationId}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  data-testid={`member-${m.applicationId}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">.{m.appliedForString || "—"}</span>
                    {m.isGodaddyApplicant ? (
                      <Badge className="bg-emerald-100 text-[#006a56]" data-testid="godaddy-member-badge">
                        GoDaddy Applicant
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-600">{m.applicationId}</p>
                  <p className="mt-1 text-slate-800">{m.applicantLegalName}</p>
                  {m.region ? <p className="text-xs text-slate-500">Region: {m.region}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <OrganizationMappingBadge
                      status={m.organizationResolutionStatus}
                      name={m.confirmedOrganizationName}
                    />
                    <span className="text-xs text-slate-600">{m.rspPublicPostureLabel}</span>
                  </div>
                  <ApplicantIdentityEvidencePanel
                    applicantLegalName={m.applicantLegalName}
                    organizationStatus={m.organizationResolutionStatus}
                    confirmedOrganizationName={m.confirmedOrganizationName}
                    applicantWebsiteHost={m.applicantWebsiteHost}
                    applicantWebsiteUrl={m.applicantWebsiteUrl}
                    directParentLegalName={m.directParentLegalName}
                    ultimateParentLegalName={m.ultimateParentLegalName}
                    ultimateControlLegalName={m.ultimateControlLegalName}
                    evidenceExplanationLines={m.evidenceExplanationLines}
                    brandApplicationCount={m.brandApplicationCount}
                    applicationCount={m.applicationCount}
                  />
                  <p className="mt-2 flex flex-wrap gap-3 text-xs">
                    <Link href={m.exploreApplicationHref} className="font-semibold text-[#006a56] underline">
                      Explore Application
                    </Link>
                    <Link href={m.exploreApplicantHref} className="font-semibold text-[#006a56] underline">
                      Applicant in Explore
                    </Link>
                    <Link href={m.competitiveLandscapeHref} className="font-semibold text-[#006a56] underline">
                      Competitive Landscape
                    </Link>
                    <Link href="/changes" className="font-semibold text-[#006a56] underline">
                      Recent changes
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <OrganizationMappingExplainer />
        </div>
      </aside>
    </div>
  );
}

export function ContentionContent({
  overlays,
  initialView = "godaddy",
  initialQ = "",
  initialSet = "",
  initialGodaddy = "all",
  initialSize = "all",
}: {
  overlays: ParticipantOverlays;
  initialView?: "godaddy" | "all";
  initialQ?: string;
  initialSet?: string;
  initialGodaddy?: ContentionGodaddyFilter;
  initialSize?: ContentionSizeFilter;
}) {
  const resolution = useHubRegistryData();
  const router = useRouter();
  const [view, setView] = useState<"godaddy" | "all">(initialView);
  const [q, setQ] = useState(initialQ);
  const [godaddyFilter, setGodaddyFilter] = useState<ContentionGodaddyFilter>(initialGodaddy);
  const [sizeFilter, setSizeFilter] = useState<ContentionSizeFilter>(initialSize);
  const [selectedSetId, setSelectedSetId] = useState(initialSet);
  const [, startTransition] = useTransition();

  const intel = useMemo(() => {
    if (resolution.status !== "ok" || !resolution.documentV2) return null;
    return buildContentionIntelligence(resolution.documentV2, overlays, loadEvaluatedMainRspArtifact());
  }, [resolution, overlays]);

  const syncUrl = (next: {
    view?: "godaddy" | "all";
    q?: string;
    set?: string;
    godaddy?: ContentionGodaddyFilter;
    size?: ContentionSizeFilter;
  }) => {
    const href = contentionPageHref({
      view: next.view ?? view,
      q: next.q ?? q,
      set: next.set === undefined ? selectedSetId : next.set,
      godaddy: next.godaddy ?? godaddyFilter,
      size: next.size ?? sizeFilter,
    });
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  if (resolution.status !== "ok" || !intel) {
    return (
      <main className="mx-auto max-w-[1480px] px-4 py-8">
        <h1 className="text-xl font-bold">Contention unavailable</h1>
        <p className="mt-2 text-sm text-slate-700">Official initial contention data is not ready in this session.</p>
      </main>
    );
  }

  const { metrics } = intel;
  const baseSets = view === "godaddy" ? intel.godaddySets : intel.sets;
  const filtered = filterContentionSets(baseSets, {
    view,
    q,
    godaddy: view === "all" ? godaddyFilter : "all",
    size: sizeFilter,
  });
  const selected = selectedSetId
    ? intel.sets.find((s) => s.setId === selectedSetId) ?? null
    : null;

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-8" data-testid="contention-page">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Contention</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950" data-testid="contention-heading">
          2026 contention landscape
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Explore official initial contention sets, see where GoDaddy&apos;s Applications are involved, and investigate
          the Applicants sharing those sets.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-600" data-testid="contention-initial-disclosure">
          These are ICANN&apos;s current initial contention memberships and may change as the program progresses.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Contention metrics">
        <Metric label="Official initial sets" value={metrics.officialSets} testId="metric-official-sets" />
        <Metric label="Official memberships" value={metrics.officialMemberships} testId="metric-official-memberships" />
        <Metric
          label="GoDaddy contention memberships"
          value={metrics.godaddyMemberships}
          testId="metric-godaddy-memberships"
        />
        <Metric
          label="Unique GoDaddy sets"
          value={metrics.uniqueGodaddySets}
          testId="metric-unique-godaddy-sets"
        />
        <Metric
          label="Counterpart Applicants"
          value={metrics.uniqueCounterpartApplicants}
          testId="metric-counterpart-applicants"
        />
        <Metric
          label="Counterpart memberships in GoDaddy sets"
          value={metrics.counterpartMembershipsInGodaddySets}
          testId="metric-counterpart-memberships"
        />
        <Metric
          label="Largest set"
          value={metrics.largestSetSize}
          testId="metric-largest-set"
        />
        <Metric
          label="Largest GoDaddy set"
          value={metrics.largestGodaddySetSize}
          testId="metric-largest-godaddy-set"
        />
      </section>

      <div
        className="mt-6 inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1"
        role="tablist"
        aria-label="Contention views"
        data-testid="contention-view-tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "godaddy"}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            view === "godaddy" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
          }`}
          data-testid="view-godaddy-exposure"
          onClick={() => {
            setView("godaddy");
            syncUrl({ view: "godaddy" });
          }}
        >
          GoDaddy exposure
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "all"}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            view === "all" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
          }`}
          data-testid="view-all-sets"
          onClick={() => {
            setView("all");
            syncUrl({ view: "all" });
          }}
        >
          All contention sets
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-600" data-testid="godaddy-exposure-definition">
        GoDaddy exposure means official initial contention sets containing Registry Services, LLC Applications — not
        financial or legal exposure.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search contention</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="contention-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              syncUrl({ q: e.target.value });
            }}
            placeholder="Search string, Applicant, Application ID, or set ID"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm"
          />
        </label>
        {view === "all" ? (
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">GoDaddy involvement</span>
            <select
              data-testid="filter-godaddy"
              value={godaddyFilter}
              onChange={(e) => {
                const v = e.target.value as ContentionGodaddyFilter;
                setGodaddyFilter(v);
                syncUrl({ godaddy: v });
              }}
              className="h-10 rounded-lg border border-slate-300 bg-white px-2"
            >
              <option value="all">All</option>
              <option value="includes-godaddy">Includes GoDaddy</option>
              <option value="excludes-godaddy">Excludes GoDaddy</option>
            </select>
          </label>
        ) : null}
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Set size</span>
          <select
            data-testid="filter-size"
            value={sizeFilter}
            onChange={(e) => {
              const v = e.target.value as ContentionSizeFilter;
              setSizeFilter(v);
              syncUrl({ size: v });
            }}
            className="h-10 rounded-lg border border-slate-300 bg-white px-2"
          >
            <option value="all">All sizes</option>
            <option value="2">2 Applications</option>
            <option value="3-4">3–4 Applications</option>
            <option value="5+">5+ Applications</option>
          </select>
        </label>
      </div>

      <Card className="mt-5 border-slate-300 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {view === "godaddy" ? "GoDaddy exposure sets" : "All official initial contention sets"}{" "}
            <span className="font-normal text-slate-500">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600" data-testid="contention-empty-filter">
              No contention sets match the current filters.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm" data-testid="contention-sets-table">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Set ID</th>
                  <th className="px-3 py-2 font-semibold">String(s)</th>
                  <th className="px-3 py-2 font-semibold">Applications</th>
                  <th className="px-3 py-2 font-semibold">GoDaddy apps</th>
                  <th className="px-3 py-2 font-semibold">Non-GoDaddy apps</th>
                  <th className="px-3 py-2 font-semibold">Counterpart Applicants</th>
                  <th className="px-3 py-2 font-semibold">Public RSP context</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((set) => (
                  <tr
                    key={set.setId}
                    className="cursor-pointer border-b border-slate-100 hover:bg-emerald-50/40"
                    data-testid={`contention-row-${set.setId}`}
                    onClick={() => {
                      setSelectedSetId(set.setId);
                      syncUrl({ set: set.setId });
                    }}
                  >
                    <td className="px-3 py-2 font-semibold text-[#006a56]">#{set.setId}</td>
                    <td className="px-3 py-2">
                      {set.appliedForStrings.map((s) => `.${s}`).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{set.totalApplications}</td>
                    <td className="px-3 py-2 tabular-nums">{set.godaddyApplications}</td>
                    <td className="px-3 py-2 tabular-nums">{set.nonGodaddyApplications}</td>
                    <td className="px-3 py-2 tabular-nums">{set.distinctCounterpartApplicants}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{set.publicRspContextSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-slate-600">
        Average members per set: {metrics.averageMembersPerSet.toFixed(2)}. As-of snapshot{" "}
        <span className="font-mono">{intel.asOf.contentionSnapshotId ?? intel.asOf.snapshotId}</span>.
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Applicant-centric shared-set rankings remain on{" "}
        <Link href="/competitive-landscape" className="font-semibold text-[#006a56] underline">
          Competitive Landscape
        </Link>
        ; this page is set-centric.
      </p>

      {selected ? (
        <SetDetailPanel
          set={selected}
          onClose={() => {
            setSelectedSetId("");
            syncUrl({ set: "" });
          }}
        />
      ) : null}
    </main>
  );
}

export function CommandCenterContentionCard({
  officialSets,
  officialMemberships,
  uniqueGodaddySets,
}: {
  officialSets: number;
  officialMemberships: number;
  uniqueGodaddySets: number;
}) {
  return (
    <Card className="border-slate-300 shadow-sm" data-testid="cc-contention-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Contention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-3 gap-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Sets</dt>
            <dd className="font-bold tabular-nums" data-testid="cc-contention-sets">
              {officialSets}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Memberships</dt>
            <dd className="font-bold tabular-nums" data-testid="cc-contention-memberships">
              {officialMemberships}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">GoDaddy sets</dt>
            <dd className="font-bold tabular-nums" data-testid="cc-contention-godaddy-sets">
              {uniqueGodaddySets}
            </dd>
          </div>
        </dl>
        <Link
          href="/contention"
          className="inline-flex items-center rounded-lg bg-[#007d65] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#006a56]"
          data-testid="cc-explore-contention-cta"
        >
          Explore contention
        </Link>
      </CardContent>
    </Card>
  );
}
