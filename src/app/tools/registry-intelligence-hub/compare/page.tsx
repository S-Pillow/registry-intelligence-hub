import { CommandCenter, type CompareParams } from "@/components/registry/command-center";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const compareParams: CompareParams = {
    type: typeof params.type === "string" ? params.type : undefined,
    ids: typeof params.ids === "string" ? params.ids : undefined,
    origin: typeof params.origin === "string" ? params.origin : undefined,
  };

  return <CommandCenter state={state as "ready" | "loading" | "empty" | "error"} view="compare" compareParams={compareParams} />;
}
