import { CommandCenter, type ExploreParams } from "@/components/registry/command-center";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { loadHistorical2012ConfirmedPortfoliosResolution } from "@/historical-2012/confirmed-portfolios-server";
import { loadHistorical2012PayloadResolution } from "@/historical-2012/payload-server";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);
const keys: (keyof ExploreParams)[] = [
  "dataset",
  "q",
  "entity",
  "category",
  "region",
  "status",
  "contention",
  "idn",
  "sort",
  "ids",
];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const exploreParams = Object.fromEntries(
    keys.flatMap((key) => typeof params[key] === "string" ? [[key, params[key]]] : [])
  ) as ExploreParams;

  const center = (
    <CommandCenter
      state={state as "ready" | "loading" | "empty" | "error"}
      view="explore"
      exploreParams={exploreParams}
      presentation={presentationFromSearchParam(params.presentation)}
    />
  );
  if (exploreParams.dataset !== "2012-historical") return center;

  const [applicationPayload, confirmedPortfolios] = await Promise.all([
    loadHistorical2012PayloadResolution(),
    loadHistorical2012ConfirmedPortfoliosResolution(),
  ]);
  return (
    <HubHistorical2012Provider
      applicationPayload={applicationPayload}
      confirmedPortfolios={confirmedPortfolios}
    >
      {center}
    </HubHistorical2012Provider>
  );
}
