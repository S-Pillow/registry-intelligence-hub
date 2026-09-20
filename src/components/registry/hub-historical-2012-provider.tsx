"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Historical2012PayloadResolution } from "@/historical-2012/payload-shared";

const defaultResolution: Historical2012PayloadResolution = {
  status: "not-loaded",
  reason: "not-configured",
  errorMessage:
    "2012 historical application payload is not configured. Set REGISTRY_HUB_2012_APPLICATION_PAYLOAD_PATH or REGISTRY_HUB_2012_APPLICATION_PAYLOAD_JSON.",
};

const HubHistorical2012Context = createContext<Historical2012PayloadResolution>(defaultResolution);

export function HubHistorical2012Provider({
  resolution,
  children,
}: {
  resolution: Historical2012PayloadResolution;
  children: ReactNode;
}) {
  return (
    <HubHistorical2012Context.Provider value={resolution}>{children}</HubHistorical2012Context.Provider>
  );
}

export function useHistorical2012Payload(): Historical2012PayloadResolution {
  return useContext(HubHistorical2012Context);
}
