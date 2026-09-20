import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";

export default async function RegistryIntelligenceHubLayout({ children }: { children: React.ReactNode }) {
  const claimActualityState = await loadPromotedClaimActualityState();
  const registryData = await loadHubRegistryData(claimActualityState);
  return (
    <HubClaimActualityProvider claimActualityState={claimActualityState}>
      <HubRegistryDataProvider resolution={registryData}>
        {children}
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>
  );
}
