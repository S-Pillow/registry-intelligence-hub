import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import {
  buildOrganizationContentionPairs,
  type OrganizationContentionPairModel,
} from "@/lib/organization-contention-pairs";
import { loadOrganizationResolutionSnapshot } from "@/lib/participant-intelligence-server";

/**
 * Server-only Confirmed Organization contention-pair model.
 * Returns null when Active V2 is unavailable or derivation fails closed.
 */
export async function loadOrganizationContentionPairModel(): Promise<OrganizationContentionPairModel | null> {
  try {
    const claim = await loadPromotedClaimActualityState();
    const [registry, orgSnapshot] = await Promise.all([
      loadHubRegistryData(claim),
      loadOrganizationResolutionSnapshot(),
    ]);
    if (registry.status !== "ok" || !registry.documentV2) {
      return null;
    }
    return buildOrganizationContentionPairs(registry.documentV2, orgSnapshot);
  } catch {
    return null;
  }
}
