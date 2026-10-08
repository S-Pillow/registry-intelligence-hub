"use client";

import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { CoverageDisclosureV2 } from "@/components/registry/coverage-disclosure-v2";
import { resolveHubMetricEligibility } from "@/lib/hub-metric-eligibility";
import type { ClaimActualityState } from "@/reveal-day-2026/claim-actuality";

/**
 * Bounded Command Center orientation for active 2.x — no legacy org/category/returning panels.
 */
export function CommandCenterOrientationV2({
  document,
  claimActuality,
}: {
  document: RegistryApplicationsDocumentV2;
  claimActuality: ClaimActualityState;
}) {
  const appCount = resolveHubMetricEligibility("application-count", claimActuality);
  const unique = resolveHubMetricEligibility("unique-applied-strings", claimActuality);
  const org = resolveHubMetricEligibility("organization-round-count", claimActuality);
  const returning = resolveHubMetricEligibility("returning-participant-identity", claimActuality);
  const category = resolveHubMetricEligibility("category-mix", claimActuality);

  return (
    <section data-testid="command-center-orientation-v2" className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Command Center</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">2026 Publication 2.x active</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Deeper differentiated intelligence remains gated. Orientation uses approved aggregates and
          eligibility only — not fabricated 1.1 fields.
        </p>
      </div>

      <CoverageDisclosureV2 document={document} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase text-slate-600">Official applications</p>
          <p className="mt-1 text-2xl font-bold" data-testid="cc-v2-official-apps">
            {document.officialApplications}
          </p>
          <p className="text-xs text-slate-600">
            Aggregate channel · comparison {appCount?.comparisonAllowed ? "allowed" : "gated"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase text-slate-600">Observed RIH records</p>
          <p className="mt-1 text-2xl font-bold">{document.observedApplicationRecords}</p>
          <p className="text-xs text-slate-600">Partial row coverage — not the official total</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase text-slate-600">Official applicants</p>
          <p className="mt-1 text-2xl font-bold">{document.officialApplicants}</p>
        </div>
      </div>

      <aside className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800">
        <p className="font-semibold">Still blocked</p>
        <ul className="mt-1 list-disc pl-4">
          <li data-testid="cc-v2-unique-blocked">
            Unique applied strings complete claim (
            {unique?.claimReadiness.round2026 ?? "NOT_PUBLISHED"})
          </li>
          <li>Organization portfolios ({org?.methodReadiness})</li>
          <li>Returning / new ({returning?.methodReadiness})</li>
          <li>Category / sector ({category?.methodReadiness})</li>
          <li>Complete exact-string competition</li>
        </ul>
      </aside>
    </section>
  );
}
