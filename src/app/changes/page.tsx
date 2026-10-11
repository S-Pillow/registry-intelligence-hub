import { CommandCenter } from "@/components/registry/command-center";
import { loadChangeIntelFeed } from "@/change-intel/load-feed-server";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const changeFeed = await loadChangeIntelFeed();

  return (
    <CommandCenter
      state={state as "ready" | "loading" | "empty" | "error"}
      view="changes"
      changeFeed={changeFeed}
      presentation={presentationFromSearchParam(
        typeof params.presentation === "string" ? params.presentation : undefined,
      )}
    />
  );
}
