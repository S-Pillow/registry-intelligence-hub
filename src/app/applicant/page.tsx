import type { Metadata } from "next";
import { ApplicantProfileContent } from "@/components/registry/applicant-profile-content";
import {
  buildApplicantIntelligenceProfile,
  decodeApplicantProfileName,
} from "@/lib/applicant-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { loadParticipantOverlays } from "@/lib/participant-intelligence-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";

export const metadata: Metadata = {
  title: "Applicant profile",
};

export default async function ApplicantProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawName = typeof params.name === "string" ? params.name : "";
  const name = decodeApplicantProfileName(rawName) ?? "";

  const claim = await loadPromotedClaimActualityState();
  const [registry, overlays] = await Promise.all([
    loadHubRegistryData(claim),
    loadParticipantOverlays(),
  ]);

  if (registry.status !== "ok" || !registry.documentV2) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold">Applicant profile unavailable</h1>
        <p className="mt-2 text-sm text-slate-700">
          Active 2026 application data is required to build Applicant intelligence.
        </p>
      </main>
    );
  }

  const lookup = buildApplicantIntelligenceProfile(
    registry.documentV2,
    overlays,
    loadEvaluatedMainRspArtifact(),
    name,
  );

  return <ApplicantProfileContent lookup={lookup} />;
}
