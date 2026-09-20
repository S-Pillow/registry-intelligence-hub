"use client";

import { useMemo } from "react";
import { CircleAlert, Database, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildDataHealthSnapshot, methodReadinessBadgeVariant } from "@/lib/data-health-report";
import { useHubClaimActualityState } from "@/components/registry/hub-claim-actuality-provider";
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

function MethodBadge({ method }: { method: string }) {
  return (
    <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-tight">
      {method}
    </Badge>
  );
}

export function DataHealthContent({ state = "ready" }: { state?: ViewState }) {
  const claimActuality = useHubClaimActualityState();
  const registryResolution = useHubRegistryData();
  const snapshot = useMemo(
    () => buildDataHealthSnapshot(claimActuality, registryResolution),
    [claimActuality, registryResolution],
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
          <span className="text-xs text-slate-600">{snapshot.catalogVersion}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Data Health</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Operator-facing view of what the Hub holds, what is trustworthy, what is rehearsal versus historical, and
          what unlocks cross-round intelligence. Gates come from the central eligibility catalog and claim actuality —
          not screen-local rules.
        </p>
      </div>

      <section aria-labelledby="source-health-heading" className="mb-10">
        <h2 id="source-health-heading" className="mb-4 text-lg font-semibold">
          Source Health
        </h2>
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Dataset</th>
                <th className="px-4 py-3 font-semibold">Classification</th>
                <th className="px-4 py-3 font-semibold">Snapshot / version</th>
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
                  <td className="px-4 py-3 text-slate-600">{row.snapshotOrVersion ?? "—"}</td>
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base">{row.label}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <MethodBadge method={row.methodReadiness} />
                    <Badge variant="outline" className="text-xs">
                      2012: {row.round2012}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      2026: {row.round2026}
                    </Badge>
                    {row.comparisonAllowed ? (
                      <Badge className="bg-emerald-100 text-[#006a56]">Comparison allowed</Badge>
                    ) : (
                      <Badge variant="secondary">Comparison gated</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">{row.explanation}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="browser-state-heading" className="mb-10">
        <h2 id="browser-state-heading" className="mb-4 text-lg font-semibold">
          Browser Data State
        </h2>
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm leading-6 text-slate-700">
            <p>
              <strong className="text-slate-900">2012 aggregates in browser:</strong>{" "}
              {browserDataState.approved2012Aggregates.applications} applications /{" "}
              {browserDataState.approved2012Aggregates.uniqueStrings} unique strings /{" "}
              {browserDataState.approved2012Aggregates.idnApplications} IDN applications (approved baseline constants).
            </p>
            <p>
              <strong className="text-slate-900">2012 entity-level browser payload:</strong> not loaded —{" "}
              {browserDataState.entityLevel2012Message}
            </p>
            <p>
              <strong className="text-slate-900">Offline normalized 2012 corpus:</strong>{" "}
              {browserDataState.offlineNormalizedCorpus}
            </p>
            <p>
              <strong className="text-slate-900">Browser entity dataset:</strong> {browserDataState.browserEntityDataset}
            </p>
            <p>
              <strong className="text-slate-900">Real 2026 publication:</strong> {browserDataState.real2026Publication}
            </p>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
              {browserDataState.rehearsalEntityWarning}
            </p>
          </CardContent>
        </Card>
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
          <Database className="size-5 text-[#007d65]" /> Publication Readiness (informational)
        </h2>
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm text-slate-700">
            <p>
              <strong className="text-slate-900">2026 application actuality:</strong>{" "}
              {publicationReadiness.round2026ApplicationActuality}
              {publicationReadiness.claimActualityPromotedAt
                ? ` (promoted ${publicationReadiness.claimActualityPromotedAt})`
                : ""}
            </p>
            <p>
              <strong className="text-slate-900">Browser payload:</strong> mode {publicationReadiness.browserPayloadMode}{" "}
              — {publicationReadiness.browserPayloadSelectionReason}
            </p>
            <p>
              <strong className="text-slate-900">Cross-round unlock:</strong> {publicationReadiness.unlockSummary}
            </p>
            <div>
              <p className="mb-2 font-medium text-slate-900">What would need to happen (no actions on this page):</p>
              <ul className="list-disc space-y-1 pl-5">
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
