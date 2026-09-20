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
import { useHistorical2012Payload } from "@/components/registry/hub-historical-2012-provider";
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
        ? "Fail-closed fallback"
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

export function DataHealthContent({ state = "ready" }: { state?: ViewState }) {
  const claimActuality = useHubClaimActualityState();
  const registryResolution = useHubRegistryData();
  const historical2012 = useHistorical2012Payload();
  const snapshot = useMemo(
    () => buildDataHealthSnapshot(claimActuality, registryResolution, historical2012),
    [claimActuality, registryResolution, historical2012],
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
        <h1 className="text-3xl font-semibold tracking-tight">Data Health</h1>
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
    </main>
  );
}
