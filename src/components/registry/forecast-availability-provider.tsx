"use client";

import { createContext, useContext, useMemo } from "react";
import type { ForecastAvailability } from "@/components/registry/forecast-link";

const ForecastAvailabilityContext = createContext<ForecastAvailability>({
  enabled: false,
  labels: [],
});

export function ForecastAvailabilityProvider({
  enabled,
  labels,
  children,
}: {
  enabled: boolean;
  labels: readonly string[];
  children: React.ReactNode;
}) {
  const value = useMemo<ForecastAvailability>(
    () => ({ enabled, labels }),
    [enabled, labels],
  );
  return (
    <ForecastAvailabilityContext.Provider value={value}>
      {children}
    </ForecastAvailabilityContext.Provider>
  );
}

export function useForecastAvailability(): ForecastAvailability {
  return useContext(ForecastAvailabilityContext);
}
