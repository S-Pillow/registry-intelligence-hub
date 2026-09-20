import { CommandCenter, type ExploreParams } from "@/components/registry/command-center";

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

  return <CommandCenter state={state as "ready" | "loading" | "empty" | "error"} view="explore" exploreParams={exploreParams} />;
}
