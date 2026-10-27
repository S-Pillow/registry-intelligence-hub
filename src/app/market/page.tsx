import { CommandCenter } from "@/components/registry/command-center";
import { loadRegistryMarketOverview } from "@/lib/market-baseline-ui-server";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

export const dynamic = "force-dynamic";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function RegistryMarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const marketOverview = await loadRegistryMarketOverview();

  return (
    <CommandCenter
      state={state as "ready" | "loading" | "empty" | "error"}
      view="market"
      marketOverview={marketOverview}
      presentation={presentationFromSearchParam(params.presentation)}
    />
  );
}
