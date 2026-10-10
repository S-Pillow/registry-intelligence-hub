import { CommandCenter } from "@/components/registry/command-center";
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
  const overlays = await loadParticipantOverlays();

  return (
    <CommandCenter
      state={state as "ready" | "loading" | "empty" | "error"}
      view="competitive-landscape"
      overlays={overlays}
      presentation={presentationFromSearchParam(params.presentation)}
    />
  );
}
