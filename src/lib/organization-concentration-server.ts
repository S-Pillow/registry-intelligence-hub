import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import {
  buildOrganizationConcentration,
  type OrganizationConcentrationModel,
} from "@/lib/organization-concentration";
import { loadOrganizationResolutionSnapshot } from "@/lib/participant-intelligence-server";

/**
 * Server-only Confirmed Organization concentration model.
 * Uses active promoted browser document + steward Organization snapshot.
 * Returns null when Active V2 is unavailable or derivation fails closed.
 */
export async function loadOrganizationConcentrationModel(): Promise<OrganizationConcentrationModel | null> {
  try {
    const claim = await loadPromotedClaimActualityState();
    const [registry, orgSnapshot] = await Promise.all([
      loadHubRegistryData(claim),
      loadOrganizationResolutionSnapshot(),
    ]);
    if (registry.status !== "ok" || !registry.documentV2) {
      return null;
    }
    return buildOrganizationConcentration(registry.documentV2, orgSnapshot);
  } catch {
    return null;
  }
}
