import type { Metadata } from "next";
import { OrganizationProfileContent } from "@/components/registry/organization-profile-content";
import {
  buildOrganizationIntelligenceProfile,
  decodeOrganizationProfileKey,
} from "@/lib/organization-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  loadOrganizationResolutionSnapshot,
  loadParticipantOverlays,
} from "@/lib/participant-intelligence-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { loadOrganizationConcentrationModel } from "@/lib/organization-concentration-server";

export const metadata: Metadata = {
  title: "Organization profile",
};

export default async function OrganizationProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawKey = typeof params.key === "string" ? params.key : "";
  const key = decodeOrganizationProfileKey(rawKey) ?? "";

  const claim = await loadPromotedClaimActualityState();
  const [registry, overlays, orgSnapshot, organizationConcentration] = await Promise.all([
    loadHubRegistryData(claim),
    loadParticipantOverlays(),
    loadOrganizationResolutionSnapshot(),
    loadOrganizationConcentrationModel(),
  ]);

  if (registry.status !== "ok" || !registry.documentV2) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold">Organization profile unavailable</h1>
        <p className="mt-2 text-sm text-slate-700">
          Active 2026 application data is required to build Organization intelligence.
        </p>
      </main>
    );
  }

  const lookup = buildOrganizationIntelligenceProfile(
    registry.documentV2,
    overlays,
    loadEvaluatedMainRspArtifact(),
    orgSnapshot,
    key,
  );

  return (
    <OrganizationProfileContent
      lookup={lookup}
      organizationConcentration={organizationConcentration}
    />
  );
}
