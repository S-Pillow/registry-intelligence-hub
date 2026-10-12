import type { Metadata } from "next";
import { CrossRoundStructuralContent } from "@/components/registry/cross-round-structural-content";
import { buildCrossRoundStructuralIntelligence } from "@/lib/cross-round-structural-intelligence";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "2012 vs 2026",
};

export default async function CrossRoundStructuralPage() {
  const claim = await loadPromotedClaimActualityState();
  const registry = await loadHubRegistryData(claim);

  if (registry.status !== "ok" || !registry.documentV2) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold">2012 vs 2026 unavailable</h1>
        <p className="mt-2 text-sm text-slate-700">
          Active 2026 application data is required to build structural cross-round intelligence.
        </p>
      </main>
    );
  }

  const intelligence = buildCrossRoundStructuralIntelligence({
    document: registry.documentV2,
    claimActuality: claim,
  });

  return <CrossRoundStructuralContent intelligence={intelligence} />;
}
