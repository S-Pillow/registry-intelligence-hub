import type { ClaimActualityState } from "@/reveal-day-2026/claim-actuality";
import {
  resolveActiveRegistryApplicationsDocument,
  type HubRegistryDataResolution,
} from "@/lib/registry-application-payload-shared";
import { loadConfiguredApplicationPayload } from "@/lib/registry-application-payload-server";

export async function loadHubRegistryData(
  claimActualityState: ClaimActualityState,
): Promise<HubRegistryDataResolution> {
  const configuredPayload = await loadConfiguredApplicationPayload();
  return resolveActiveRegistryApplicationsDocument(claimActualityState, configuredPayload);
}
