import { Suspense } from "react";
import { CommandCenter } from "@/components/registry/command-center";
import { loadOrganizationConcentrationModel } from "@/lib/organization-concentration-server";
import { loadParticipantOverlays } from "@/lib/participant-intelligence-server";
import { presentationFromSearchParam } from "@/lib/presentation-mode";
import type { ContentionGodaddyFilter, ContentionSizeFilter } from "@/lib/contention-intelligence";

const allowedStates = new Set(["ready", "loading", "empty", "error"]);

function parseGodaddy(value: string | undefined): ContentionGodaddyFilter {
  if (value === "includes-godaddy" || value === "excludes-godaddy" || value === "all") return value;
  return "all";
}

function parseSize(value: string | undefined): ContentionSizeFilter {
  if (value === "2" || value === "3-4" || value === "5+" || value === "all") return value;
  return "all";
}

export default async function ContentionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stateValue = typeof params.state === "string" ? params.state : "ready";
  const state = allowedStates.has(stateValue) ? stateValue : "ready";
  const [overlays, organizationConcentration] = await Promise.all([
    loadParticipantOverlays(),
    loadOrganizationConcentrationModel(),
  ]);
  const viewParam = typeof params.view === "string" ? params.view : "godaddy";
  const initialView = viewParam === "all" ? "all" : "godaddy";

  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-8 text-sm">Loading contention…</main>}>
      <CommandCenter
        state={state as "ready" | "loading" | "empty" | "error"}
        view="contention"
        overlays={overlays}
        organizationConcentration={organizationConcentration}
        contentionParams={{
          initialView,
          initialQ: typeof params.q === "string" ? params.q : "",
          initialSet: typeof params.set === "string" ? params.set : "",
          initialGodaddy: parseGodaddy(typeof params.godaddy === "string" ? params.godaddy : undefined),
          initialSize: parseSize(typeof params.size === "string" ? params.size : undefined),
        }}
        presentation={presentationFromSearchParam(
          typeof params.presentation === "string" ? params.presentation : undefined,
        )}
      />
    </Suspense>
  );
}
