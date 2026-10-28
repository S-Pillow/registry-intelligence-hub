"use client";

import { useMemo } from "react";
import { CircleAlert, Database, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildDataHealthSnapshot,
  humanizeClaimReadiness,
  humanizeMethodReadiness,
  humanizeBrowserPayloadMode,
  humanizePayloadSelectionReason,
  methodReadinessBadgeVariant,
  type CurrentStateSummaryRow,
  type PublicationChecklistItem,
} from "@/lib/data-health-report";
import { useHubClaimActualityState } from "@/components/registry/hub-claim-actuality-provider";
import {
  useHistorical2012ConfirmedPortfolios,
  useHistorical2012Payload,
} from "@/components/registry/hub-historical-2012-provider";
import { useHubRegistryData } from "@/components/registry/hub-registry-data-provider";

type ViewState = "ready" | "loading" | "empty" | "error";

function StatusBadge({ label }: { label: string }) {
  const variant = methodReadinessBadgeVariant(label);
  const className =
    variant === "ready"
      ? "bg-emerald-100 text-[#006a56]"
      : variant === "partial"
        ? "bg-amber-100 text-amber-900"
        : variant === "blocked"
          ? "bg-rose-100 text-rose-900"
          : variant === "context"
            ? "bg-sky-100 text-sky-900"
            : "bg-slate-100 text-slate-700";
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function SummaryToneBadge({ row }: { row: CurrentStateSummaryRow }) {
  const label =
    row.badgeLabel ??
    (row.tone === "ready"
      ? "On track"
      : row.tone === "partial"
        ? "Partial"
        : row.tone === "blocked"
          ? "Blocked"
          : row.tone === "context"
            ? "Rehearsal"
            : "Pending");
  const className =
    label === "Ready" || row.tone === "ready"
      ? "bg-emerald-100 text-[#006a56]"
      : label === "Gated" || label === "Locked"
        ? "bg-violet-100 text-violet-900"
        : label === "Not loaded"
          ? "bg-slate-100 text-slate-700"
          : row.tone === "partial"
            ? "bg-amber-100 text-amber-900"
            : row.tone === "blocked"
              ? "bg-rose-100 text-rose-900"
              : row.tone === "context"
                ? "bg-sky-100 text-sky-900"
                : "bg-slate-100 text-slate-700";
  return (
    <Badge variant="outline" className={`shrink-0 text-[11px] ${className}`}>
      {label}
    </Badge>
  );
}

function MethodReadinessLabel({ method }: { method: string }) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="font-medium text-slate-900">{humanizeMethodReadiness(method)}</span>
      <span className="font-mono text-[10px] uppercase tracking-tight text-slate-500">{method}</span>
    </span>
  );
}

function ClaimReadinessLabel({ round, value }: { round: "2012" | "2026"; value: string }) {
  return (
    <span className="inline-flex flex-col gap-0.5 text-left">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{round}</span>
      <span className="text-xs font-medium text-slate-900">{humanizeClaimReadiness(value)}</span>
      <span className="font-mono text-[10px] text-slate-500">{value}</span>
    </span>
  );
}

function ChecklistStatus({ item }: { item: PublicationChecklistItem }) {
  const statusLabel =
    item.status === "complete"
      ? "Complete"
      : item.status === "warning"
        ? "Fail-closed (no rehearsal)"
        : item.status === "blocked"
          ? "Blocked"
          : "Pending";
  const className =
    item.status === "complete"
      ? "text-[#006a56]"
      : item.status === "warning"
        ? "text-amber-900"
        : item.status === "blocked"
          ? "text-rose-900"
          : "text-slate-700";
  return (
    <span className={`text-xs font-semibold ${className}`} aria-label={`${item.label}: ${statusLabel}`}>
      {statusLabel}
    </span>
  );
}

export function DataHealthContent({
  state = "ready",
  changeFeed,
}: {
  state?: ViewState;
  changeFeed?: {
    initialized: boolean;
    lastCheckedAt?: string | null;
    currentObservationId?: string | null;
    previousObservationId?: string | null;
    latestDiff?: {
      summary: { applicationChanges: number; contentionChanges: number };
      changes: unknown[];
    } | null;
    applicationSource?: { contentSha256?: string } | null;
    contentionSource?: { contentSha256?: string } | null;
  };
}) {
  const claimActuality = useHubClaimActualityState();
  const registryResolution = useHubRegistryData();
  const historical2012 = useHistorical2012Payload();
  const confirmedPortfolios = useHistorical2012ConfirmedPortfolios();
  const snapshot = useMemo(
    () =>
      buildDataHealthSnapshot(
        claimActuality,
        registryResolution,
        historical2012,
        confirmedPortfolios,
        changeFeed,
      ),
    [claimActuality, registryResolution, historical2012, confirmedPortfolios, changeFeed],
  );

  if (state === "loading") {
    return (
      <main className="mx-auto max-w-[1480px] space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-900">
              <CircleAlert className="size-5" /> Data Health unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-rose-800">
            Hub registry or claim actuality context could not be loaded. Retry from Command Center.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { browserDataState, publicationReadiness } = snapshot;

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-100 text-[#006a56]">
            <ShieldCheck className="size-3.5" /> Intelligence readiness
          </Badge>
          <span className="text-xs text-slate-600">Catalog {snapshot.catalogVersion}</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
          Technical data health &amp; methodology
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Data Health</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Operator-facing view of what the Hub holds, what is trustworthy, what is rehearsal versus historical, and
          what unlocks cross-round intelligence. Gates come from the central eligibility catalog and claim actuality —
          not screen-local rules.
        </p>
      </div>

      <section aria-labelledby="current-state-heading" className="mb-10">
        <h2 id="current-state-heading" className="mb-3 text-lg font-semibold">
          Current state
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-slate-600">
          At-a-glance runtime posture for browser payload, 2012 aggregates, entity browsing, 2026 publication, and
          cross-round comparison gates.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.currentStateSummary.map((row) => (
            <li key={row.id}>
              <Card className="h-full">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <h3 className="font-heading text-sm font-semibold text-slate-800">{row.title}</h3>
                  <SummaryToneBadge row={row} />
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium leading-snug text-slate-900">{row.primary}</p>
                  {row.secondary ? (
                    <p className="text-xs leading-snug text-slate-500">{row.secondary}</p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="source-health-heading" className="mb-10">
        <h2 id="source-health-heading" className="mb-2 text-lg font-semibold">
          Source Health
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-slate-600">
          Dataset names include the round year (2012 / 2026). The <strong className="font-semibold text-slate-800">Pack / method ID</strong>{" "}
          column is a technical bundle or parser identifier — not a calendar year.
        </p>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Dataset</th>
                <th className="px-4 py-3 font-semibold">Classification</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="block normal-case text-[11px] font-normal text-slate-500">Technical</span>
                  Pack / method ID
                </th>
                <th className="px-4 py-3 font-semibold">Coverage</th>
                <th className="px-4 py-3 font-semibold">Readiness</th>
                <th className="px-4 py-3 font-semibold">Limitation</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sourceHealth.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-700">{row.classification}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.snapshotOrVersion ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.coverage ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={row.readiness} />
                  </td>
                  <td className="max-w-md px-4 py-3 text-slate-600">{row.limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="intelligence-readiness-heading" className="mb-10">
        <h2 id="intelligence-readiness-heading" className="mb-4 text-lg font-semibold">
          Intelligence Readiness
        </h2>
        <div className="grid gap-3">
          {snapshot.intelligenceReadiness.map((row) => (
            <Card key={row.metricId}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{row.label}</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <MethodReadinessLabel method={row.methodReadiness} />
                    <ClaimReadinessLabel round="2012" value={row.round2012} />
                    <ClaimReadinessLabel round="2026" value={row.round2026} />
                    {row.comparisonAllowed ? (
                      <Badge className="bg-emerald-100 text-[#006a56]">Comparison allowed</Badge>
                    ) : (
                      <Badge variant="secondary">Comparison gated</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>{row.explanation}</p>
                <p className="font-mono text-[10px] text-slate-500">{row.metricId}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="browser-state-heading" className="mb-10">
        <h2 id="browser-state-heading" className="mb-4 text-lg font-semibold">
          Browser Data State
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <h3 className="font-heading text-base font-medium text-slate-900">2012 historical round</h3>
              <p className="text-xs text-slate-600">Approved baseline aggregates only — not entity-level Explore rows.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <dl className="grid gap-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aggregates in browser</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {browserDataState.approved2012Aggregates.applications} applications ·{" "}
                    {browserDataState.approved2012Aggregates.uniqueStrings} unique strings ·{" "}
                    {browserDataState.approved2012Aggregates.idnApplications} IDN applications
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entity-level browser payload</dt>
                  <dd className="mt-0.5">
                    <StatusBadge label="Browser not loaded" />
                    <p className="mt-1 text-slate-600">{browserDataState.entityLevel2012Message}</p>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offline normalized corpus</dt>
                  <dd className="mt-0.5 text-slate-700">{browserDataState.offlineNormalizedCorpus}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-sky-200 bg-sky-50/30">
            <CardHeader className="pb-2">
              <h3 className="font-heading text-base font-medium text-slate-900">2026 browser entities</h3>
              <p className="text-xs text-slate-600">
                What Explore loads today — rehearsal drill or promoted payload, separate from 2012 historical facts.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <dl className="grid gap-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active entity dataset</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{browserDataState.browserEntityDataset}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payload resolution</dt>
                  <dd className="mt-0.5">
                    {humanizeBrowserPayloadMode(publicationReadiness.browserPayloadMode)}
                    <span className="mt-1 block text-xs text-slate-600">
                      {humanizePayloadSelectionReason(publicationReadiness.browserPayloadSelectionReason)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Real 2026 publication</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {browserDataState.real2026Publication === "REAL_SOURCE_READY"
                      ? "Approved source ready"
                      : browserDataState.real2026Publication}
                  </dd>
                </div>
              </dl>
              <div
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950"
                role="note"
                aria-label="Synthetic rehearsal entities warning"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Synthetic rehearsal only</p>
                <p className="mt-1 text-sm leading-snug">{browserDataState.rehearsalEntityWarning}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="coverage-heading" className="mb-10">
        <h2 id="coverage-heading" className="mb-4 text-lg font-semibold">
          Coverage / Known Limitations
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          {snapshot.coverageLimitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="change-intel-heading" className="mb-10" data-testid="data-health-change-intel">
        <h2 id="change-intel-heading" className="mb-4 text-lg font-semibold">
          Change Intelligence (technical)
        </h2>
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm text-slate-700">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Initialized</dt>
                <dd className="mt-1 font-medium">{snapshot.changeIntelligence.initialized ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validation state</dt>
                <dd className="mt-1 font-medium">{snapshot.changeIntelligence.validationState}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last checked</dt>
                <dd className="mt-1 font-medium">{snapshot.changeIntelligence.lastCheckedAt ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current observation</dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {snapshot.changeIntelligence.currentObservationId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Previous observation</dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {snapshot.changeIntelligence.previousObservationId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest diff counts</dt>
                <dd className="mt-1 font-medium">
                  {snapshot.changeIntelligence.latestDiffCounts
                    ? `Application ${snapshot.changeIntelligence.latestDiffCounts.applicationChanges} · Contention ${snapshot.changeIntelligence.latestDiffCounts.contentionChanges} · Total ${snapshot.changeIntelligence.latestDiffCounts.total}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Application source hash</dt>
                <dd className="mt-1 break-all font-mono text-[10px]">
                  {snapshot.changeIntelligence.applicationSourceHash ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contention source hash</dt>
                <dd className="mt-1 break-all font-mono text-[10px]">
                  {snapshot.changeIntelligence.contentionSourceHash ?? "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="publication-heading">
        <h2 id="publication-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Database className="size-5 text-[#007d65]" aria-hidden /> Publication Readiness (informational)
        </h2>
        <Card>
          <CardContent className="space-y-6 pt-6 text-sm text-slate-700">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-slate-50/80 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">2026 application actuality</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {humanizeClaimReadiness(publicationReadiness.round2026ApplicationActuality)}
                </dd>
                <dd className="font-mono text-[10px] text-slate-500">{publicationReadiness.round2026ApplicationActuality}</dd>
                {publicationReadiness.claimActualityPromotedAt ? (
                  <dd className="mt-1 text-xs text-slate-600">Promoted {publicationReadiness.claimActualityPromotedAt}</dd>
                ) : null}
              </div>
              <div className="rounded-lg border bg-slate-50/80 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cross-round unlock</dt>
                <dd className="mt-1 font-medium text-slate-900">{publicationReadiness.unlockSummary}</dd>
              </div>
            </dl>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Prerequisite checklist (informational — no actions here)</h3>
              <ul className="divide-y rounded-xl border bg-white">
                {publicationReadiness.checklist.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-slate-600">{item.detail}</p>
                    </div>
                    <ChecklistStatus item={item} />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Operator notes</h3>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                {publicationReadiness.prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="sources-licensing-heading"
        className="mt-10"
        data-testid="data-health-sources-licensing"
      >
        <h2 id="sources-licensing-heading" className="mb-4 text-lg font-semibold">
          Sources, licensing &amp; third-party materials
        </h2>
        <Card>
          <CardContent className="space-y-5 pt-6 text-sm leading-6 text-slate-700">
            <p>
              Registry Intelligence Hub combines and analyzes information derived from public sources,
              including ICANN application and contention publications, IANA registry information, ICANN
              Monthly Registry Reports, and other identified public-source materials.
            </p>
            <p>
              RIH&apos;s software, analysis logic, normalization methods, evidence models, and original
              presentation are separate from the underlying third-party source material. Public
              availability of a source does not mean that RIH owns that material or that the source
              material is licensed under the same terms as RIH software.
            </p>
            <p data-testid="data-health-apache-license">
              Original RIH source code is licensed under Apache-2.0. Third-party source materials
              retain their respective terms.
            </p>
            <p>
              Third-party datasets, source documents, trademarks, logos, screenshots, HTML fixtures, and
              other source materials remain subject to their respective ownership, copyright, licensing,
              attribution requirements, and terms of use. Inclusion, reference, transformation, or
              analysis within RIH does not transfer ownership or relicense third-party materials.
            </p>
            <p data-testid="data-health-evidence-maturity">
              Where RIH publishes derived metrics or intelligence, the underlying source, coverage,
              provenance, and evidence maturity should be considered alongside the result. RIH
              distinguishes unavailable, partial, inferred, confirmed, and source-published facts and
              does not treat missing source data as zero.
            </p>
            <p data-testid="data-health-independence">
              Registry Intelligence Hub is an independent project and is not affiliated with or
              endorsed by ICANN, IANA, or any other referenced registry-industry organization unless
              expressly stated otherwise.
            </p>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Primary source classes</h3>
              <p className="mb-3 text-xs text-slate-600">
                This table summarizes primary source classes used by RIH. It is not an exhaustive legal
                inventory of every third-party material that may appear in documentation, fixtures, or
                screenshots.
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-3 py-2">
                        Source
                      </th>
                      <th scope="col" className="px-3 py-2">
                        RIH use
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Rights posture
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                    <tr>
                      <th scope="row" className="px-3 py-3 align-top font-semibold text-slate-900">
                        ICANN / APS
                      </th>
                      <td className="px-3 py-3 align-top">
                        Application, Applicant, designation, contention, and public program evidence
                      </td>
                      <td className="px-3 py-3 align-top">
                        Third-party public source; original terms retained
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="px-3 py-3 align-top font-semibold text-slate-900">
                        IANA
                      </th>
                      <td className="px-3 py-3 align-top">
                        TLD / root-zone / delegation context
                      </td>
                      <td className="px-3 py-3 align-top">
                        Third-party public source; original terms retained
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="px-3 py-3 align-top font-semibold text-slate-900">
                        ICANN Monthly Registry Reports
                      </th>
                      <td className="px-3 py-3 align-top">
                        Registry Market operational baselines and derived metrics
                      </td>
                      <td className="px-3 py-3 align-top">
                        Third-party source; RIH publishes derived intelligence and provenance rather
                        than asserting ownership of underlying reports
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="px-3 py-3 align-top font-semibold text-slate-900">
                        Other identified public sources
                      </th>
                      <td className="px-3 py-3 align-top">
                        Evidence or corroboration where explicitly cited
                      </td>
                      <td className="px-3 py-3 align-top">
                        Original ownership and source terms retained
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
