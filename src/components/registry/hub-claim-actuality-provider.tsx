"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/lib/hub-metric-eligibility";

const HubClaimActualityContext = createContext<ClaimActualityState>(DEFAULT_CLAIM_ACTUALITY_STATE);

export function HubClaimActualityProvider({
  claimActualityState,
  children,
}: {
  claimActualityState: ClaimActualityState;
  children: ReactNode;
}) {
  return (
    <HubClaimActualityContext.Provider value={claimActualityState}>
      {children}
    </HubClaimActualityContext.Provider>
  );
}

export function useHubClaimActualityState(): ClaimActualityState {
  return useContext(HubClaimActualityContext);
}
