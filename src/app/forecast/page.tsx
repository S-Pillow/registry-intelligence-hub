import type { Metadata } from "next";
import { RegistrationForecastContent } from "@/components/registry/registration-forecast-content";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import {
  buildExampleForecastRows,
  defaultUnavailableSuffixDemandEvidence,
} from "@/lib/registration-forecast";

export const metadata: Metadata = {
  title: "Registration forecast (experimental)",
};

export const dynamic = "force-dynamic";

export default async function RegistrationForecastPage() {
  const claim = await loadPromotedClaimActualityState();
  const registry = await loadHubRegistryData(claim);
  const demandEvidence = defaultUnavailableSuffixDemandEvidence();

  if (registry.status !== "ok" || !registry.documentV2) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8" data-testid="forecast-unavailable">
        <h1 className="text-xl font-bold">Registration forecast unavailable</h1>
        <p className="mt-2 text-sm text-slate-700">
          Active 2026 application data is required to select representative forecast strings.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          {demandEvidence.status === "unavailable" ? demandEvidence.blocker : demandEvidence.coverageNote}
        </p>
      </main>
    );
  }

  const rows = buildExampleForecastRows(registry.documentV2, null, demandEvidence);

  return (
    <RegistrationForecastContent
      rows={rows}
      demandEvidence={demandEvidence}
      applicationSnapshotId={registry.documentV2.snapshotId}
    />
  );
}
