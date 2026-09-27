import { CommandCenter } from "@/components/registry/command-center";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function RegistryIntelligenceHubPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; presentation?: string }>;
}) {
  const { state = "ready", presentation } = await searchParams;
  const safeState = allowedStates.has(state) ? state : "ready";

  return (
    <CommandCenter
      state={safeState as "ready" | "loading" | "empty" | "error"}
      presentation={presentationFromSearchParam(presentation)}
    />
  );
}
