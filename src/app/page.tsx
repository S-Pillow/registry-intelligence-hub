import { CommandCenter } from "@/components/registry/command-center";
import { loadChangeIntelFeed } from "@/change-intel/load-feed-server";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function RegistryIntelligenceHubPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; presentation?: string }>;
}) {
  const { state = "ready", presentation } = await searchParams;
  const safeState = allowedStates.has(state) ? state : "ready";
  const changeFeed = await loadChangeIntelFeed();

  return (
    <CommandCenter
      state={safeState as "ready" | "loading" | "empty" | "error"}
      changeFeed={changeFeed}
      presentation={presentationFromSearchParam(presentation)}
    />
  );
}
