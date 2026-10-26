import { CommandCenter } from "@/components/registry/command-center";
import { loadOrganizationConcentrationModel } from "@/lib/organization-concentration-server";
import { loadOrganizationContentionPairModel } from "@/lib/organization-contention-pairs-server";
import { loadParticipantOverlays } from "@/lib/participant-intelligence-server";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function CompetitiveLandscapePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const [overlays, organizationConcentration, organizationContentionPairs] = await Promise.all([
    loadParticipantOverlays(),
    loadOrganizationConcentrationModel(),
    loadOrganizationContentionPairModel(),
  ]);

  return (
    <CommandCenter
      state={state as "ready" | "loading" | "empty" | "error"}
      view="competitive-landscape"
      overlays={overlays}
      organizationConcentration={organizationConcentration}
      organizationContentionPairs={organizationContentionPairs}
      presentation={presentationFromSearchParam(params.presentation)}
    />
  );
}
