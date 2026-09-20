import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";

export default async function RegistryIntelligenceHubLayout({ children }: { children: React.ReactNode }) {
  const claimActualityState = await loadPromotedClaimActualityState();
  return (
    <HubClaimActualityProvider claimActualityState={claimActualityState}>
      {children}
    </HubClaimActualityProvider>
  );
}
