import { CommandCenter, type SavedParams } from "@/components/registry/command-center";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const savedParams: SavedParams = {
    tab: typeof params.tab === "string" ? params.tab : undefined,
    open: typeof params.open === "string" ? params.open : undefined,
  };

  return <CommandCenter state={state as "ready" | "loading" | "empty" | "error"} view="saved" savedParams={savedParams} />;
}
