import { CommandCenter } from "@/components/registry/command-center";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function BriefingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";

  return <CommandCenter state={state as "ready" | "loading" | "empty" | "error"} view="briefings" />;
}
