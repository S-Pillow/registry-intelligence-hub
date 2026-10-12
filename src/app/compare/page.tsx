import type { Metadata } from "next";
import { CompareIntelligenceContent } from "@/components/registry/compare-intelligence-content";
import { buildCompareIntelViewModel, isCompareIntelEntityType } from "@/lib/compare-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  loadOrganizationResolutionSnapshot,
  loadParticipantOverlays,
} from "@/lib/participant-intelligence-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { CommandCenter, type CompareParams } from "@/components/registry/command-center";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

export const metadata: Metadata = {
  title: "Compare",
};

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

/**
 * COMPARE-INTEL-2: Applicant / Organization comparison for promoted 2026.
 * Legacy rehearsal Compare (organizations/applications/categories) remains via CommandCenter V1.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const type = typeof params.type === "string" ? params.type : undefined;
  const ids = typeof params.ids === "string" ? params.ids : undefined;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const presentation = presentationFromSearchParam(params.presentation);

  // New intel path when type is applicant/organization, or empty (landing)
  if (!type || isCompareIntelEntityType(type)) {
    const claim = await loadPromotedClaimActualityState();
    const [registry, overlays, orgSnapshot] = await Promise.all([
      loadHubRegistryData(claim),
      loadParticipantOverlays(),
      loadOrganizationResolutionSnapshot(),
    ]);

    if (registry.status !== "ok" || !registry.documentV2) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-xl font-bold">Compare unavailable</h1>
          <p className="mt-2 text-sm text-slate-700">
            Active 2026 application data is required for Applicant and Organization comparison.
          </p>
        </main>
      );
    }

    const model = buildCompareIntelViewModel({
      document: registry.documentV2,
      overlays,
      evaluatedRsp: loadEvaluatedMainRspArtifact(),
      orgSnapshot,
      type: type ?? null,
      idsRaw: ids ?? null,
    });

    return <CompareIntelligenceContent model={model} />;
  }

  // Legacy rehearsal Compare URL shapes
  const compareParams: CompareParams = {
    type,
    ids,
    origin: typeof params.origin === "string" ? params.origin : undefined,
  };

  return (
    <CommandCenter
      state={state as "ready" | "loading" | "empty" | "error"}
      view="compare"
      compareParams={compareParams}
      presentation={presentation}
    />
  );
}
