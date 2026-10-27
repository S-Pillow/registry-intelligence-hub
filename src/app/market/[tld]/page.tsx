import { notFound } from "next/navigation";
import { CommandCenter } from "@/components/registry/command-center";
import { loadRegistryMarketTldDetail } from "@/lib/market-baseline-ui-server";
import { presentationFromSearchParam } from "@/lib/presentation-mode";

export const dynamic = "force-dynamic";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

export default async function RegistryMarketTldPage({
  params,
  searchParams,
}: {
  params: Promise<{ tld: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tld } = await params;
  const query = await searchParams;
  const stateValue = typeof query.state === "string" ? query.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const marketDetail = await loadRegistryMarketTldDetail(tld);

  if (marketDetail.status === "TLD_NOT_FOUND") {
    notFound();
  }

  return (
    <CommandCenter
      state={state as "ready" | "loading" | "empty" | "error"}
      view="market"
      marketDetail={marketDetail}
      presentation={presentationFromSearchParam(query.presentation)}
    />
  );
}
