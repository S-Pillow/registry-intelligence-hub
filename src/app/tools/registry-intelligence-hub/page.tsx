import { CommandCenter } from "@/components/registry/command-center";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function RegistryIntelligenceHubPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state = "ready" } = await searchParams;
  const safeState = allowedStates.has(state) ? state : "ready";

  return <CommandCenter state={safeState as "ready" | "loading" | "empty" | "error"} />;
}
