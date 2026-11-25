import type { Metadata } from "next";
import { ForecastOverviewContent } from "@/components/registry/forecast-overview-content";
import { RegistrationForecastContent } from "@/components/registry/registration-forecast-content";
import { loadForecastCatalog } from "@/lib/forecast-catalog-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { isForecastLocalPreviewEnabled } from "@/lib/forecast-local-preview";
import {
  buildExampleForecastRows,
  defaultUnavailableSuffixDemandEvidence,
} from "@/lib/registration-forecast";

export const metadata: Metadata = {
  title: "Registration forecast (experimental)",
};

export const dynamic = "force-dynamic";

export default async function RegistrationForecastPage() {
  if (isForecastLocalPreviewEnabled()) {
    const loaded = await loadForecastCatalog();
    if (loaded.status === "ok") {
      return <ForecastOverviewContent catalog={loaded.catalog} />;
    }
    if (loaded.status === "error") {
      return (
        <main className="mx-auto max-w-3xl px-4 py-8" data-testid="forecast-catalog-unavailable">
          <h1 className="text-xl font-bold">Experimental forecast unavailable</h1>
          <p className="mt-2 text-sm text-slate-700">
            The local forecast catalog could not be loaded. Confirm the accepted preview file is
            present and matches the expected SHA-256 pin.
          </p>
          <p className="mt-2 font-mono text-xs text-slate-600">{loaded.reason}</p>
        </main>
      );
    }
  }

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
