import { CommandCenter } from "@/components/registry/command-center";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function BriefingWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const stateValue = typeof query.state === "string" ? query.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";

  return <CommandCenter state={state as "ready" | "loading" | "empty" | "error"} view="briefings" briefingId={id} />;
}
